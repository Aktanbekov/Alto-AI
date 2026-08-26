package handlers

import (
	"net/http"
	"strings"

	"altoai_mvp/internal/services"
	"altoai_mvp/internal/visallm"
	"altoai_mvp/pkg/response"

	"github.com/gin-gonic/gin"
)

// EvaluateHandler exposes the visa-llm sidecar to authenticated users. The
// sidecar grounds its feedback in a corpus of real interview reviews, which is
// a different thing from the per-answer scoring in the chat flow.
type EvaluateHandler struct {
	client  *visallm.Client
	userSvc services.UserService
}

func NewEvaluateHandler(client *visallm.Client, userSvc services.UserService) *EvaluateHandler {
	return &EvaluateHandler{client: client, userSvc: userSvc}
}

// Status lets the frontend hide the feature when the sidecar isn't deployed,
// rather than surfacing a failed request.
func (h *EvaluateHandler) Status(c *gin.Context) {
	if !h.client.Configured() {
		response.OK(c, gin.H{"available": false, "detail": "visa-llm is not configured"})
		return
	}
	health, err := h.client.Health(c.Request.Context())
	if err != nil {
		response.OK(c, gin.H{"available": false, "detail": err.Error()})
		return
	}
	response.OK(c, gin.H{"available": health.APIKeyConfigured, "detail": health.Detail})
}

// Evaluate proxies a profile to the sidecar. The caller's college and major
// are filled in from their account when not supplied explicitly.
func (h *EvaluateHandler) Evaluate(c *gin.Context) {
	var req visallm.ProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.PlannedAnswers) == 0 {
		response.Error(c, http.StatusBadRequest, "add at least one question and answer")
		return
	}

	if claims, ok := currentClaims(c); ok && claims != nil {
		if user, err := h.userSvc.GetByEmail(c.Request.Context(), claims.Email); err == nil {
			if req.University == "" {
				req.University = user.College
			}
			if req.Major == "" {
				req.Major = user.Major
			}
		}
	}

	evaluation, err := h.client.Evaluate(c.Request.Context(), req)
	if err != nil {
		if err == visallm.ErrNotConfigured {
			response.Error(c, http.StatusServiceUnavailable, err.Error())
			return
		}
		// The sidecar already distinguishes billing/auth failures in its
		// message; a 502 says the upstream call failed, not that we crashed.
		msg := err.Error()
		if strings.Contains(msg, "unreachable") {
			response.Error(c, http.StatusServiceUnavailable, msg)
			return
		}
		response.Error(c, http.StatusBadGateway, msg)
		return
	}
	response.OK(c, evaluation)
}
