package services

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"altoai_mvp/internal/repository"
)

// Telegram sends admin notifications through a Telegram bot.
//
// Setup is two values:
//   - TELEGRAM_BOT_TOKEN, the token @BotFather gives you. Env only: it is a
//     secret and never stored in the database or shown in the panel.
//   - the chat to send to. Either TELEGRAM_CHAT_ID in the env, or connected
//     from the admin panel: the panel shows a one-time link, the admin opens it
//     and presses Start, and the panel reads the chat id back from the bot.
//
// With no token every method is a no-op that reports "not configured", so the
// site works the same with or without a bot.
type Telegram struct {
	settings repository.SettingsRepo
	client   *http.Client
	apiBase  string
}

const (
	settingTelegramChat = "telegram_chat_id"
	settingTelegramName = "telegram_chat_name"
	settingTelegramCode = "telegram_link_code"
)

// ErrTelegramNotConfigured is returned when TELEGRAM_BOT_TOKEN is unset.
var ErrTelegramNotConfigured = errors.New("TELEGRAM_BOT_TOKEN is not set")

// ErrTelegramNoChat is returned when the bot has a token but no chat to send to.
var ErrTelegramNoChat = errors.New("no Telegram chat is connected")

// ErrTelegramStartNotFound is returned when the bot has not seen the link code.
var ErrTelegramStartNotFound = errors.New("the bot has not received the start message yet")

func NewTelegram(settings repository.SettingsRepo) *Telegram {
	return &Telegram{
		settings: settings,
		client:   &http.Client{Timeout: 6 * time.Second},
		apiBase:  "https://api.telegram.org",
	}
}

func (t *Telegram) token() string { return strings.TrimSpace(os.Getenv("TELEGRAM_BOT_TOKEN")) }

// TelegramStatus is what the admin panel shows.
type TelegramStatus struct {
	TokenSet    bool   `json:"token_set"`
	Connected   bool   `json:"connected"`
	ChatSource  string `json:"chat_source"` // "env", "panel" or ""
	ChatName    string `json:"chat_name"`
	BotUsername string `json:"bot_username"`
	Error       string `json:"error,omitempty"`
}

// chat returns the destination chat id and where it came from.
func (t *Telegram) chat() (id, source string) {
	if v := strings.TrimSpace(os.Getenv("TELEGRAM_CHAT_ID")); v != "" {
		return v, "env"
	}
	if t.settings != nil {
		if v, err := t.settings.Get(settingTelegramChat); err == nil && v != "" {
			return v, "panel"
		}
	}
	return "", ""
}

func (t *Telegram) Status(ctx context.Context) TelegramStatus {
	st := TelegramStatus{TokenSet: t.token() != ""}
	id, source := t.chat()
	st.Connected = st.TokenSet && id != ""
	st.ChatSource = source
	if source == "panel" && t.settings != nil {
		st.ChatName, _ = t.settings.Get(settingTelegramName)
	}
	if st.TokenSet {
		name, err := t.botUsername(ctx)
		if err != nil {
			st.Error = err.Error()
		}
		st.BotUsername = name
	}
	return st
}

// call posts to one Bot API method and decodes `result` into out.
func (t *Telegram) call(ctx context.Context, method string, body any, out any) error {
	tok := t.token()
	if tok == "" {
		return ErrTelegramNotConfigured
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		t.apiBase+"/bot"+tok+"/"+method, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := t.client.Do(req)
	if err != nil {
		// The URL holds the token; never let it reach a log line.
		return fmt.Errorf("telegram %s: request failed", method)
	}
	defer res.Body.Close()

	var envelope struct {
		OK          bool            `json:"ok"`
		Description string          `json:"description"`
		Result      json.RawMessage `json:"result"`
	}
	if err := json.NewDecoder(res.Body).Decode(&envelope); err != nil {
		return fmt.Errorf("telegram %s: bad response (%d)", method, res.StatusCode)
	}
	if !envelope.OK {
		return fmt.Errorf("telegram %s: %s", method, envelope.Description)
	}
	if out != nil {
		return json.Unmarshal(envelope.Result, out)
	}
	return nil
}

func (t *Telegram) botUsername(ctx context.Context) (string, error) {
	var me struct {
		Username string `json:"username"`
	}
	if err := t.call(ctx, "getMe", struct{}{}, &me); err != nil {
		return "", err
	}
	return me.Username, nil
}

// Send delivers an HTML-formatted message to the connected chat.
func (t *Telegram) Send(ctx context.Context, htmlText string) error {
	if t.token() == "" {
		return ErrTelegramNotConfigured
	}
	id, _ := t.chat()
	if id == "" {
		return ErrTelegramNoChat
	}
	return t.call(ctx, "sendMessage", map[string]any{
		"chat_id":                  id,
		"text":                     htmlText,
		"parse_mode":               "HTML",
		"disable_web_page_preview": true,
	}, nil)
}

// StartLink makes a fresh one-time code and returns the t.me link that sends
// it to the bot. Only someone who can see the admin panel gets the code, so
// only they can become the recipient.
func (t *Telegram) StartLink(ctx context.Context) (string, error) {
	name, err := t.botUsername(ctx)
	if err != nil {
		return "", err
	}
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	code := hex.EncodeToString(buf)
	if err := t.settings.Set(settingTelegramCode, code); err != nil {
		return "", err
	}
	return "https://t.me/" + name + "?start=" + code, nil
}

// Connect looks through the bot's recent messages for "/start <code>" and, if
// found, saves that chat as the recipient.
func (t *Telegram) Connect(ctx context.Context) (string, error) {
	code, err := t.settings.Get(settingTelegramCode)
	if err != nil {
		return "", err
	}
	if code == "" {
		return "", ErrTelegramStartNotFound
	}
	var updates []struct {
		Message *struct {
			Text string `json:"text"`
			Chat struct {
				ID        int64  `json:"id"`
				Type      string `json:"type"`
				FirstName string `json:"first_name"`
				LastName  string `json:"last_name"`
				Username  string `json:"username"`
			} `json:"chat"`
		} `json:"message"`
	}
	if err := t.call(ctx, "getUpdates", map[string]any{
		"allowed_updates": []string{"message"},
		// From the end, so a bot with a long backlog still finds the newest.
		"offset": -100,
	}, &updates); err != nil {
		return "", err
	}
	for i := len(updates) - 1; i >= 0; i-- {
		m := updates[i].Message
		if m == nil || m.Chat.Type != "private" || strings.TrimSpace(m.Text) != "/start "+code {
			continue
		}
		name := strings.TrimSpace(m.Chat.FirstName + " " + m.Chat.LastName)
		if m.Chat.Username != "" {
			name = strings.TrimSpace(name + " (@" + m.Chat.Username + ")")
		}
		if err := t.settings.Set(settingTelegramChat, strconv.FormatInt(m.Chat.ID, 10)); err != nil {
			return "", err
		}
		_ = t.settings.Set(settingTelegramName, name)
		_ = t.settings.Delete(settingTelegramCode)
		_ = t.Send(ctx, "✅ Готово. Сюда будут приходить новые заявки на оплату с Altovisas.")
		return name, nil
	}
	return "", ErrTelegramStartNotFound
}

// Disconnect forgets the chat connected from the panel. A TELEGRAM_CHAT_ID
// set in the env is unaffected.
func (t *Telegram) Disconnect() error {
	_ = t.settings.Delete(settingTelegramName)
	return t.settings.Delete(settingTelegramChat)
}

// PaymentRequestMessage formats a new request for the admin chat. Every value
// the visitor typed is escaped: the message is sent as HTML.
func PaymentRequestMessage(r repository.PaymentRequest, planName, adminURL string) string {
	e := html.EscapeString
	var b strings.Builder
	b.WriteString("🆕 <b>Новая заявка на оплату</b>\n\n")
	fmt.Fprintf(&b, "<b>Имя:</b> %s\n", e(r.Name))
	fmt.Fprintf(&b, "<b>Телефон:</b> %s\n", e(r.Phone))
	if r.Contact == "telegram" {
		fmt.Fprintf(&b, "<b>Связь:</b> Telegram @%s\n", e(r.Telegram))
	} else {
		digits := strings.Map(func(c rune) rune {
			if c >= '0' && c <= '9' {
				return c
			}
			return -1
		}, r.Phone)
		fmt.Fprintf(&b, "<b>Связь:</b> <a href=\"https://wa.me/%s\">WhatsApp</a>\n", digits)
	}
	fmt.Fprintf(&b, "<b>Тариф:</b> %s · %d сом\n", e(planName), r.Price)
	if r.InterviewDate != "" {
		if d, err := time.Parse("2006-01-02", r.InterviewDate); err == nil {
			fmt.Fprintf(&b, "<b>Собеседование:</b> %s\n", d.Format("02.01.2006"))
		}
	} else {
		b.WriteString("<b>Собеседование:</b> дата не назначена\n")
	}
	if r.Email != "" {
		fmt.Fprintf(&b, "<b>Аккаунт:</b> %s\n", e(r.Email))
	}
	if adminURL != "" {
		fmt.Fprintf(&b, "\n<a href=\"%s\">Открыть все заявки</a>", e(adminURL))
	}
	return b.String()
}
