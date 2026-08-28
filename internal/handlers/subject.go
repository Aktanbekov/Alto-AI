package handlers

import (
	"log"
	"net/http"

	"altoai_mvp/internal/repository"
	"altoai_mvp/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const guestCookie = "alto_guest_id"

// freeSets is what everyone gets without giving anything back. Completing the
// validation survey adds repository.SurveyUnlockSets on top.
const freeSets = 2

// maxSetIndex bounds a client-supplied set number to the question bank, which
// holds 37 questions — thirteen sets of three, counted from zero.
const maxSetIndex = 12

// subjectResolver turns a request into the identity everything in the
// validation flow is keyed by.
//
// There are two kinds of caller and the flow has to work for both: someone with
// an account, and someone who has not signed up and may never. The second is
// anchored to a server-issued HttpOnly cookie rather than anything the page can
// write, so clearing localStorage does not reset an allowance.
type subjectResolver struct {
	users services.UserService
	evals repository.EvaluationRepo
	val   repository.ValidationRepo
}

// resolve identifies the caller, and — when they have just signed in with a
// guest history behind them — moves that history onto the account first.
//
// The claim happens here rather than at login because it needs the cookie,
// which only reaches endpoints the browser calls directly. It is idempotent:
// once the rows carry a user id they no longer match the guest predicate.
func (s subjectResolver) resolve(c *gin.Context) repository.Subject {
	guestID := ensureGuestID(c)

	claims, ok := currentClaims(c)
	if !ok || claims == nil || s.users == nil {
		return repository.Subject{VisitorID: guestID}
	}
	user, err := s.users.GetByEmail(c.Request.Context(), claims.Email)
	if err != nil {
		// A valid token for an account we cannot read: treat them as a guest
		// rather than failing the request outright.
		log.Printf("access: could not resolve %s: %v", claims.Email, err)
		return repository.Subject{VisitorID: guestID}
	}

	if s.val != nil {
		if err := s.val.Claim(user.ID, guestID); err != nil {
			log.Printf("access: could not claim guest validation rows: %v", err)
		}
	}
	if s.evals != nil {
		if err := s.evals.ClaimForUser(user.ID, guestID); err != nil {
			log.Printf("access: could not claim guest evaluations: %v", err)
		}
	}
	return repository.Subject{UserID: user.ID}
}

// ensureGuestID returns this browser's stable anonymous id, minting one when
// the cookie is missing.
//
// HttpOnly on purpose: the free-set allowance hangs off this value, and a
// cookie the page can rewrite is not an allowance, it is a suggestion.
func ensureGuestID(c *gin.Context) string {
	if id, err := c.Cookie(guestCookie); err == nil {
		if _, parseErr := uuid.Parse(id); parseErr == nil {
			return id
		}
	}
	id := c.GetHeader("X-Visitor-Id")
	if _, err := uuid.Parse(id); err != nil {
		id = uuid.NewString()
	}
	c.SetSameSite(http.SameSiteLaxMode)
	secure := c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https"
	c.SetCookie(guestCookie, id, 365*24*60*60, "/", "", secure, true)
	return id
}

// visitorFor picks the id the event stream should file this request under: the
// browser's own analytics id when it sent one, falling back to the guest
// cookie so a blocked analytics client still produces attributable rows.
func visitorFor(c *gin.Context, s repository.Subject) string {
	if v := c.GetHeader("X-Visitor-Id"); v != "" {
		return v
	}
	return s.VisitorID
}
