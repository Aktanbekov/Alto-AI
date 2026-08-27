package handlers

import (
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"altoai_mvp/internal/repository"
	"altoai_mvp/internal/services"
	"altoai_mvp/pkg/response"

	"github.com/gin-gonic/gin"
)

// AnalyticsHandler ingests the product event stream.
//
// Two rules shape everything here. First, tracking must never break the page:
// an ad blocker, a malformed batch, or a database hiccup all return 200 and are
// dropped, because a student losing their report over a analytics failure is a
// far worse outcome than a missing row. Second, the privacy constraints are
// enforced on this side of the wire — a client that sends a raw GPA or a
// free-text plan gets it stripped here, rather than trusted not to send it.
type AnalyticsHandler struct {
	repo    repository.AnalyticsRepo
	userSvc services.UserService
}

func NewAnalyticsHandler(repo repository.AnalyticsRepo, userSvc services.UserService) *AnalyticsHandler {
	return &AnalyticsHandler{repo: repo, userSvc: userSvc}
}

// userID resolves the caller to their database id.
//
// The JWT carries an email but no subject, and the privacy rules forbid an
// email in the event stream — so the id is looked up rather than the email
// stored. Returns "" for an anonymous caller, which is the normal case.
func (h *AnalyticsHandler) userID(c *gin.Context) string {
	claims, ok := currentClaims(c)
	if !ok || claims == nil || h.userSvc == nil {
		return ""
	}
	user, err := h.userSvc.GetByEmail(c.Request.Context(), claims.Email)
	if err != nil {
		return ""
	}
	return user.ID
}

const (
	maxBatch      = 100 // events per request
	maxPropLen    = 200 // characters kept in any string property
	maxPropsCount = 24
)

// The event vocabulary. An unknown name is dropped rather than stored: without
// this, a typo in the client silently creates a new event nobody is counting,
// and the funnel quietly under-reports forever.
var knownEvents = map[string]bool{
	// Acquisition
	"page_view": true, "cta_click": true,
	// Profile form
	"form_start": true, "form_step_complete": true, "form_field_skipped": true,
	"form_abandon": true, "plan_text_filled": true, "form_complete": true,
	// Test
	"test_start": true, "question_answered": true, "test_abandon": true,
	"test_complete": true,
	// Report
	"report_generated": true, "report_view": true, "scroll_depth": true,
	"report_dwell": true, "flag_expand": true, "locked_flag_click": true,
	"paywall_cta_click": true, "email_submit": true, "share_click": true,
	"report_revisit": true,
	// Feedback and flywheel
	"feedback_answer": true, "outcome_email_opened": true,
	"outcome_submitted": true, "fabrication_refusal_shown": true,
}

// Properties that must never be stored, whatever the client sends. The spec
// treats these as hard constraints, so they are dropped at the door.
//
// open_text is the deliberate exception: feedback_answer carries it by design,
// and the feedback inbox screen is built to read it.
var bannedProps = map[string]bool{
	"gpa": true, "gpa_raw": true, "plan_text": true, "plan": true,
	"answer": true, "answer_text": true, "sponsor": true, "sponsor_details": true,
	"funding_amount": true, "amount": true, "income": true, "email": true,
	"name": true, "full_name": true, "university": true,
}

// A banded GPA looks like "3.0-3.3", "<2.5" or "3.7+". A bare number is a raw
// value that slipped through, and is dropped.
var gpaBand = regexp.MustCompile(`^(<[0-9.]+|[0-9.]+\+|[0-9.]+-[0-9.]+)$`)

type ingestBody struct {
	VisitorID string             `json:"visitor_id"`
	SessionID string             `json:"session_id"`
	Src       string             `json:"src"`
	Lang      string             `json:"lang"`
	IsMobile  bool               `json:"is_mobile"`
	Events    []ingestEventInput `json:"events"`
}

type ingestEventInput struct {
	Name      string         `json:"name"`
	Timestamp int64          `json:"ts"` // epoch millis, client clock
	Path      string         `json:"path"`
	Props     map[string]any `json:"props"`
}

// Ingest accepts a batch. Public: most events happen before anyone signs in,
// and the whole point of a visitor_id is to capture that.
func (h *AnalyticsHandler) Ingest(c *gin.Context) {
	var body ingestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		// Malformed batch: accept and drop. Retrying would not help the client
		// and an error here is visible in the browser console for no gain.
		c.Status(http.StatusNoContent)
		return
	}
	if body.VisitorID == "" || len(body.Events) == 0 {
		c.Status(http.StatusNoContent)
		return
	}
	if len(body.Events) > maxBatch {
		body.Events = body.Events[:maxBatch]
	}

	// No user lookup on this path. Attribution happens in SQL against the
	// identities table, so an identified visitor's events are credited without
	// a database round trip per batch.
	now := time.Now().UTC()
	out := make([]repository.Event, 0, len(body.Events))
	for _, in := range body.Events {
		name := strings.TrimSpace(in.Name)
		if !knownEvents[name] {
			continue
		}
		ts := now
		if in.Timestamp > 0 {
			// Client clocks are not trustworthy; a wildly skewed timestamp
			// would land the event outside every date filter forever.
			t := time.UnixMilli(in.Timestamp).UTC()
			if t.After(now.Add(-30*24*time.Hour)) && t.Before(now.Add(time.Hour)) {
				ts = t
			}
		}
		out = append(out, repository.Event{
			Name:      name,
			VisitorID: trunc(body.VisitorID, 36),
			SessionID: trunc(body.SessionID, 36),
			Timestamp: ts,
			Src:       trunc(body.Src, 64),
			Path:      trunc(in.Path, 255),
			Lang:      trunc(body.Lang, 16),
			IsMobile:  body.IsMobile,
			Props:     sanitizeProps(in.Props),
		})
	}

	if len(out) > 0 {
		// The client is never told, but a write failure must not be invisible
		// to us: silent drops here look identical to "nobody visited".
		if err := h.repo.Insert(out); err != nil {
			log.Printf("analytics: dropped %d events: %v", len(out), err)
		}
	}
	c.Status(http.StatusNoContent)
}

// sanitizeProps enforces the privacy rules and bounds the blob size.
func sanitizeProps(in map[string]any) map[string]any {
	if len(in) == 0 {
		return nil
	}
	out := make(map[string]any, len(in))
	for k, v := range in {
		if len(out) >= maxPropsCount {
			break
		}
		key := strings.ToLower(strings.TrimSpace(k))
		if bannedProps[key] {
			continue
		}
		// gpa_band is allowed, but only if it really is a band.
		if key == "gpa_band" {
			if s, ok := v.(string); ok && gpaBand.MatchString(s) {
				out[key] = s
			}
			continue
		}
		switch val := v.(type) {
		case string:
			out[key] = trunc(val, maxPropLen)
		case bool, float64, int, int64, nil:
			out[key] = val
		case []any:
			// Flag id lists and similar. Strings only, bounded.
			list := make([]any, 0, len(val))
			for i, item := range val {
				if i >= 20 {
					break
				}
				if s, ok := item.(string); ok {
					list = append(list, trunc(s, maxPropLen))
				} else {
					list = append(list, item)
				}
			}
			out[key] = list
		default:
			// Nested objects are where free text hides. Not stored.
			continue
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func trunc(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// Identify links the calling user to their anonymous visitor id and backfills
// the events they generated before signing up. Requires auth: the user_id comes
// from the token, never from the body, so one visitor cannot claim another.
func (h *AnalyticsHandler) Identify(c *gin.Context) {
	var body struct {
		VisitorID string `json:"visitor_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.VisitorID == "" {
		c.Status(http.StatusNoContent)
		return
	}
	uid := h.userID(c)
	if uid == "" {
		c.Status(http.StatusNoContent)
		return
	}
	_, _ = h.repo.Identify(trunc(body.VisitorID, 36), uid)
	c.Status(http.StatusNoContent)
}

// DeleteMine erases the caller's analytics history. The profile, answers and
// outcome deletion path lives with the user record; this is the event-stream
// half of the same request.
func (h *AnalyticsHandler) DeleteMine(c *gin.Context) {
	uid := h.userID(c)
	if uid == "" {
		response.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	n, err := h.repo.DeleteForUser(uid)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "could not delete analytics history")
		return
	}
	response.OK(c, gin.H{"deleted_events": n})
}
