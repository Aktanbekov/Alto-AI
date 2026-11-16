package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log"
	"net/http"
	"sort"
	"strings"

	"altoai_mvp/internal/repository"
	"altoai_mvp/pkg/response"

	"github.com/gin-gonic/gin"
)

// AdminPartnersHandler backs the Partners screen: links handed to people who
// share them, and what each one is owed for the sales they brought in.
//
// A partner link is an ordinary tracking link (same table, same `?src=`) with
// a name and a commission on it, so its visits also show on the Links screen.
// The browser remembers the partner code for referralWindow days after the
// visit; a checkout request sent in that time is stamped with it. When the
// admin marks that request Bought, the partner's cut is fixed at the link's
// rate, and stays owed until the admin records the payout here.
type AdminPartnersHandler struct {
	links    repository.ReferralRepo
	requests repository.PaymentRequestRepo
}

func NewAdminPartnersHandler(links repository.ReferralRepo, requests repository.PaymentRequestRepo) *AdminPartnersHandler {
	return &AdminPartnersHandler{links: links, requests: requests}
}

// partnerRow is one partner and their totals.
type partnerRow struct {
	repository.ReferralLink
	URL      string `json:"url"`
	Requests int    `json:"requests"` // checkout requests through the link
	Sales    int    `json:"sales"`    // of those, bought
	Revenue  int    `json:"revenue"`  // som, bought sales only
	Earned   int    `json:"earned"`   // commission on bought sales
	Owed     int    `json:"owed"`     // earned and not paid out yet
	Paid     int    `json:"paid"`     // paid out so far
}

// List returns every partner link with totals, and the referred requests
// themselves so the screen can show what each total is made of.
func (h *AdminPartnersHandler) List(c *gin.Context) {
	links, err := h.links.List(true)
	if err != nil {
		log.Printf("partners: %v", err)
		response.Error(c, http.StatusInternalServerError, "could not load partners")
		return
	}
	sales, err := h.requests.Referred()
	if err != nil {
		log.Printf("partners: %v", err)
		response.Error(c, http.StatusInternalServerError, "could not load partner sales")
		return
	}

	rows := []partnerRow{}
	index := map[string]int{}
	for _, l := range links {
		if !l.IsPartner() {
			continue
		}
		index[l.Code] = len(rows)
		rows = append(rows, partnerRow{ReferralLink: l, URL: buildURL(l.Code, l.Destination)})
	}
	for _, s := range sales {
		i, ok := index[s.RefCode]
		if !ok {
			continue
		}
		r := &rows[i]
		r.Requests++
		if s.CommissionPaidAt != nil {
			r.Paid += s.Commission
		}
		if s.Outcome == "bought" {
			r.Sales++
			r.Revenue += s.Price
			r.Earned += s.Commission
			if s.CommissionPaidAt == nil {
				r.Owed += s.Commission
			}
		}
	}
	// Who is owed the most first, so the payout to make is at the top.
	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].Archived != rows[j].Archived {
			return !rows[i].Archived
		}
		if rows[i].Owed != rows[j].Owed {
			return rows[i].Owed > rows[j].Owed
		}
		return rows[i].Sales > rows[j].Sales
	})
	response.OK(c, gin.H{"partners": rows, "sales": sales, "window_days": referralWindowDays})
}

type partnerBody struct {
	Code           string `json:"code"`
	PartnerName    string `json:"partner_name"`
	PartnerContact string `json:"partner_contact"`
	CommissionPct  int    `json:"commission_pct"`
	Destination    string `json:"destination"`
	Notes          string `json:"notes"`
}

func (b partnerBody) validate() (repository.PartnerInfo, string) {
	name := strings.Join(strings.Fields(b.PartnerName), " ")
	if name == "" {
		return repository.PartnerInfo{}, "partner name is required"
	}
	if b.CommissionPct < 0 || b.CommissionPct > 100 {
		return repository.PartnerInfo{}, "commission must be between 0 and 100 percent"
	}
	return repository.PartnerInfo{
		PartnerName:    trunc(name, 120),
		PartnerContact: trunc(strings.TrimSpace(b.PartnerContact), 120),
		CommissionPct:  b.CommissionPct,
		Notes:          trunc(b.Notes, 2000),
	}, ""
}

// Create makes a partner link. With no code, a random one is chosen: a code
// that is hard to guess keeps people from crediting a partner by typing it.
func (h *AdminPartnersHandler) Create(c *gin.Context) {
	var body partnerBody
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request body")
		return
	}
	info, msg := body.validate()
	if msg != "" {
		response.Error(c, http.StatusBadRequest, msg)
		return
	}
	raw := body.Code
	if strings.TrimSpace(raw) == "" {
		buf := make([]byte, 3)
		if _, err := rand.Read(buf); err != nil {
			response.Error(c, http.StatusInternalServerError, "could not make a code")
			return
		}
		raw = "p-" + hex.EncodeToString(buf)
	}
	code, err := repository.NormalizeLinkCode(raw)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	dest, err := repository.NormalizeDestination(body.Destination)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	created, err := h.links.Create(repository.ReferralLink{
		Code:           code,
		Label:          "Partner: " + info.PartnerName,
		Destination:    dest,
		Notes:          info.Notes,
		PartnerName:    info.PartnerName,
		PartnerContact: info.PartnerContact,
		CommissionPct:  info.CommissionPct,
	})
	if errors.Is(err, repository.ErrLinkExists) {
		response.Error(c, http.StatusConflict, "that code is already in use")
		return
	}
	if err != nil {
		log.Printf("create partner: %v", err)
		response.Error(c, http.StatusInternalServerError, "could not create the partner link")
		return
	}
	response.Created(c, partnerRow{ReferralLink: created, URL: buildURL(created.Code, created.Destination)})
}

// Update changes the partner's name, contact, rate and notes. The code is
// fixed, like any link's: it is already in the browsers of people they sent.
func (h *AdminPartnersHandler) Update(c *gin.Context) {
	code, err := repository.NormalizeLinkCode(c.Param("code"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	var body partnerBody
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request body")
		return
	}
	info, msg := body.validate()
	if msg != "" {
		response.Error(c, http.StatusBadRequest, msg)
		return
	}
	updated, err := h.links.UpdatePartner(code, info)
	if errors.Is(err, repository.ErrLinkNotFound) {
		response.Error(c, http.StatusNotFound, "partner not found")
		return
	}
	if err != nil {
		log.Printf("update partner: %v", err)
		response.Error(c, http.StatusInternalServerError, "could not update the partner")
		return
	}
	response.OK(c, partnerRow{ReferralLink: updated, URL: buildURL(updated.Code, updated.Destination)})
}

// Payout records that the admin has paid the partner everything owed so far.
// The money itself moves outside the site; this only keeps the books.
func (h *AdminPartnersHandler) Payout(c *gin.Context) {
	code, err := repository.NormalizeLinkCode(c.Param("code"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if _, err := h.links.Get(code); errors.Is(err, repository.ErrLinkNotFound) {
		response.Error(c, http.StatusNotFound, "partner not found")
		return
	}
	amount, sales, err := h.requests.MarkCommissionPaid(code)
	if err != nil {
		log.Printf("partner payout: %v", err)
		response.Error(c, http.StatusInternalServerError, "could not record the payout")
		return
	}
	response.OK(c, gin.H{"code": code, "amount": amount, "sales": sales})
}

// referralWindowDays is how long after clicking a partner link a request
// still counts as theirs. The browser enforces it (analytics.js keeps the code
// with its date); the server only reports it so the screen can say so.
const referralWindowDays = 60

// partnerFor resolves the partner code a checkout request carries. Only a live
// partner link counts: an unknown, archived or plain tracking code earns
// nobody anything, so it is not stored on the request.
func partnerFor(links repository.ReferralRepo, raw string) (repository.ReferralLink, bool) {
	if links == nil || strings.TrimSpace(raw) == "" {
		return repository.ReferralLink{}, false
	}
	code, err := repository.NormalizeLinkCode(raw)
	if err != nil {
		return repository.ReferralLink{}, false
	}
	l, err := links.Get(code)
	if err != nil || l.Archived || !l.IsPartner() {
		return repository.ReferralLink{}, false
	}
	return l, true
}
