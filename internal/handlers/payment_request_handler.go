package handlers

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"altoai_mvp/internal/repository"
	"altoai_mvp/internal/services"
	"altoai_mvp/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// PaymentRequestHandler takes "contact me to pay" requests from the checkout
// and lists them for the admin panel.
//
// Card payments are not available yet, so paid plans are sold by hand. The
// checkout collects a name, a phone, the plan, the visa interview date and how
// the person wants to be reached; an admin then contacts them.
//
// Each new request is also sent to the admin's Telegram when a bot is set up
// (see services.Telegram); without one the table in the panel is the only
// place it shows up.
type PaymentRequestHandler struct {
	repo     repository.PaymentRequestRepo
	users    services.UserService
	telegram *services.Telegram
}

func NewPaymentRequestHandler(
	repo repository.PaymentRequestRepo, users services.UserService, telegram *services.Telegram,
) *PaymentRequestHandler {
	return &PaymentRequestHandler{repo: repo, users: users, telegram: telegram}
}

// paidPlanPrices mirrors the paid plans in frontend/src/constants/pricing.js.
// The price is taken from here, never from the request body, so the admin sees
// what the plan actually costs whatever the page sent.
var paidPlanPrices = map[string]int{
	"quick":    999,
	"full":     1999,
	"complete": 8500,
}

// PaidPlanSets is how many practice rounds each plan adds to the account when
// an admin marks it bought - the "interviews" figure on the pricing page.
var PaidPlanSets = map[string]int{
	"quick":    3,
	"full":     10,
	"complete": 100,
}

var paidPlanNames = map[string]string{
	"quick":    "Быстрая подготовка",
	"full":     "Полная подготовка",
	"complete": "Максимум",
}

var (
	phoneChars       = regexp.MustCompile(`^\+?[0-9 ()\-]+$`)
	telegramUsername = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_]{4,31}$`)
)

// normalizeTelegram accepts "@name", "name" or a t.me link and returns the bare
// username, or "" when it is not a valid one.
func normalizeTelegram(raw string) string {
	u := strings.TrimSpace(raw)
	for _, prefix := range []string{"https://t.me/", "http://t.me/", "t.me/", "@"} {
		if strings.HasPrefix(strings.ToLower(u), prefix) {
			u = u[len(prefix):]
		}
	}
	u = strings.TrimSuffix(u, "/")
	if !telegramUsername.MatchString(u) {
		return ""
	}
	return u
}

// normalizePhone keeps a typed number as written (trimmed, inner spaces
// collapsed) but rejects anything that is not 7-15 digits once the
// punctuation is removed - the range E.164 allows.
func normalizePhone(raw string) (string, bool) {
	p := strings.Join(strings.Fields(raw), " ")
	if p == "" || len(p) > 32 || !phoneChars.MatchString(p) {
		return "", false
	}
	digits := 0
	for _, r := range p {
		if r >= '0' && r <= '9' {
			digits++
		}
	}
	return p, digits >= 7 && digits <= 15
}

// Create records one request. Signed-in only: the checkout sits behind
// sign-in, so every request is tied to an account the admin can look up.
func (h *PaymentRequestHandler) Create(c *gin.Context) {
	var body struct {
		Name          string `json:"name"`
		Phone         string `json:"phone"`
		Plan          string `json:"plan"`
		InterviewDate string `json:"interview_date"`
		Contact       string `json:"contact"`
		Telegram      string `json:"telegram"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request body")
		return
	}

	details := map[string]string{}

	name := strings.Join(strings.Fields(body.Name), " ")
	if n := utf8.RuneCountInString(name); n < 2 || n > 120 {
		details["name"] = "Укажите имя."
	}

	phone, ok := normalizePhone(body.Phone)
	if !ok {
		details["phone"] = "Укажите номер телефона с кодом страны."
	}

	price, ok := paidPlanPrices[body.Plan]
	if !ok {
		details["plan"] = "Выберите тариф."
	}

	date := strings.TrimSpace(body.InterviewDate)
	if date != "" {
		t, err := time.Parse("2006-01-02", date)
		today := time.Now().UTC().Truncate(24 * time.Hour)
		if err != nil || t.Before(today.AddDate(0, 0, -1)) || t.After(today.AddDate(2, 0, 0)) {
			details["interview_date"] = "Проверьте дату собеседования."
		}
	}

	contact := body.Contact
	telegram := ""
	switch contact {
	case "whatsapp":
	case "telegram":
		telegram = normalizeTelegram(body.Telegram)
		if telegram == "" {
			details["telegram"] = "Укажите юзернейм в Telegram, например @username."
		}
	default:
		details["contact"] = "Выберите WhatsApp или Telegram."
	}

	if len(details) > 0 {
		response.ValidationError(c, details)
		return
	}

	req := repository.PaymentRequest{
		Name:          name,
		Phone:         phone,
		Plan:          body.Plan,
		Price:         price,
		InterviewDate: date,
		Contact:       contact,
		Telegram:      telegram,
	}
	if claims, ok := currentClaims(c); ok && claims != nil {
		req.Email = claims.Email
		if user, err := h.users.GetByEmail(c.Request.Context(), claims.Email); err == nil {
			req.UserID = user.ID
		}
	}

	saved, err := h.repo.Create(req)
	if err != nil {
		log.Printf("payment request: %v", err)
		response.Error(c, http.StatusInternalServerError, "Не удалось отправить заявку. Попробуйте ещё раз.")
		return
	}
	h.notify(c, saved)
	response.Created(c, gin.H{"id": saved.ID})
}

// notify sends the request to the admin's Telegram. It runs before the
// response rather than in a goroutine: on a serverless host the process can be
// frozen the moment the response is written. A failure is logged, never shown
// to the visitor - their request is already saved.
func (h *PaymentRequestHandler) notify(c *gin.Context, r repository.PaymentRequest) {
	if h.telegram == nil {
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
	msg := services.PaymentRequestMessage(r, paidPlanNames[r.Plan], siteBase()+"/admin")
	err := h.telegram.Send(ctx, msg)
	if err != nil && !errors.Is(err, services.ErrTelegramNotConfigured) {
		log.Printf("payment request %s: telegram: %v", r.ID, err)
	}
}

// List is the admin view, newest first.
func (h *PaymentRequestHandler) List(c *gin.Context) {
	limit, offset := pageParams(c)
	items, total, err := h.repo.List(limit, offset)
	if err != nil {
		log.Printf("payment requests: %v", err)
		response.Error(c, http.StatusInternalServerError, "could not load payment requests")
		return
	}
	response.OK(c, gin.H{"items": items, "total": total})
}

// Update edits one row from the admin table: reached out or not, the
// outcome, and a free-text note.
func (h *PaymentRequestHandler) Update(c *gin.Context) {
	var body struct {
		Contacted *bool   `json:"contacted"`
		Outcome   *string `json:"outcome"`
		Notes     *string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Outcome != nil && !repository.PaymentRequestOutcomes[*body.Outcome] {
		response.Error(c, http.StatusBadRequest, "outcome must be pending, bought or declined")
		return
	}
	if body.Notes != nil && utf8.RuneCountInString(*body.Notes) > 2000 {
		response.Error(c, http.StatusBadRequest, "notes must be 2000 characters or fewer")
		return
	}
	id := c.Param("id")
	if _, err := uuid.Parse(id); err != nil {
		response.Error(c, http.StatusNotFound, "request not found")
		return
	}
	updated, err := h.repo.Update(id, repository.PaymentRequestUpdate{
		Contacted: body.Contacted, Outcome: body.Outcome, Notes: body.Notes,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.Error(c, http.StatusNotFound, "request not found")
			return
		}
		if errors.Is(err, repository.ErrPaymentNoAccount) || errors.Is(err, repository.ErrPaymentUnknownPlan) {
			response.Error(c, http.StatusConflict, "Can't activate the plan: "+err.Error()+".")
			return
		}
		log.Printf("payment request update: %v", err)
		response.Error(c, http.StatusInternalServerError, "could not update the request")
		return
	}
	response.OK(c, updated)
}

// ---------------------------------------------------------------- telegram --

// TelegramStatus reports whether the bot is set up and who it sends to.
func (h *PaymentRequestHandler) TelegramStatus(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()
	response.OK(c, h.telegram.Status(ctx))
}

// TelegramLink returns a one-time t.me link that connects the admin's chat.
func (h *PaymentRequestHandler) TelegramLink(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()
	link, err := h.telegram.StartLink(ctx)
	if err != nil {
		h.telegramError(c, err)
		return
	}
	response.OK(c, gin.H{"url": link})
}

// TelegramConnect checks whether the admin pressed Start on that link.
func (h *PaymentRequestHandler) TelegramConnect(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()
	name, err := h.telegram.Connect(ctx)
	if err != nil {
		h.telegramError(c, err)
		return
	}
	response.OK(c, gin.H{"connected": true, "chat_name": name})
}

// TelegramTest sends a sample message so the admin can see the format.
func (h *PaymentRequestHandler) TelegramTest(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()
	sample := repository.PaymentRequest{
		Name: "Тестовая заявка", Phone: "+996 555 123 456", Plan: "full", Price: paidPlanPrices["full"],
		Contact: "telegram", Telegram: "username", InterviewDate: time.Now().AddDate(0, 0, 14).Format("2006-01-02"),
	}
	msg := "🧪 Это тестовое сообщение.\n\n" +
		services.PaymentRequestMessage(sample, paidPlanNames["full"], siteBase()+"/admin")
	if err := h.telegram.Send(ctx, msg); err != nil {
		h.telegramError(c, err)
		return
	}
	response.OK(c, gin.H{"sent": true})
}

// TelegramDisconnect forgets the chat connected from the panel.
func (h *PaymentRequestHandler) TelegramDisconnect(c *gin.Context) {
	if err := h.telegram.Disconnect(); err != nil {
		response.Error(c, http.StatusInternalServerError, "could not disconnect")
		return
	}
	response.OK(c, gin.H{"connected": false})
}

func (h *PaymentRequestHandler) telegramError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, services.ErrTelegramNotConfigured):
		response.Error(c, http.StatusConflict, "TELEGRAM_BOT_TOKEN is not set on the server.")
	case errors.Is(err, services.ErrTelegramNoChat):
		response.Error(c, http.StatusConflict, "Connect a Telegram chat first.")
	case errors.Is(err, services.ErrTelegramStartNotFound):
		response.Error(c, http.StatusConflict, "The bot hasn't received your Start yet. Open the link, press Start, then try again.")
	default:
		log.Printf("telegram: %v", err)
		response.Error(c, http.StatusBadGateway, err.Error())
	}
}
