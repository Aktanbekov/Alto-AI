package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"

	"altoai_mvp/internal/middleware"
	"altoai_mvp/internal/repository"
	"altoai_mvp/interview"
	"altoai_mvp/pkg/response"

	"github.com/gin-gonic/gin"
)

type AdminHandler struct {
	users      repository.UserRepo
	interviews repository.InterviewRepo
}

func NewAdminHandler(users repository.UserRepo, interviews repository.InterviewRepo) *AdminHandler {
	return &AdminHandler{users: users, interviews: interviews}
}

// Me tells the frontend whether the caller is an admin, so the UI can decide
// whether to show the panel at all. Reachable by any authenticated user.
func (h *AdminHandler) Me(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	response.OK(c, gin.H{
		"email":    claims.Email,
		"name":     claims.Name,
		"is_admin": middleware.IsAdminEmail(claims.Email),
	})
}

func (h *AdminHandler) Stats(c *gin.Context) {
	stats, err := h.interviews.Stats()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to load stats: "+err.Error())
		return
	}
	response.OK(c, stats)
}

// ListUsers returns a filtered, paginated slice of users. The repository's
// List() has no search or paging, so filtering happens here; user volume is
// small enough that this is not worth a schema change yet.
func (h *AdminHandler) ListUsers(c *gin.Context) {
	all, err := h.users.List()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to list users")
		return
	}

	search := strings.ToLower(strings.TrimSpace(c.Query("search")))
	filtered := all[:0:0]
	for _, u := range all {
		if search == "" ||
			strings.Contains(strings.ToLower(u.Email), search) ||
			strings.Contains(strings.ToLower(u.Name), search) ||
			strings.Contains(strings.ToLower(u.College), search) ||
			strings.Contains(strings.ToLower(u.Major), search) {
			filtered = append(filtered, u)
		}
	}

	limit, offset := pageParams(c)
	total := len(filtered)
	start := offset
	if start > total {
		start = total
	}
	end := start + limit
	if end > total {
		end = total
	}

	response.OK(c, gin.H{
		"users":  filtered[start:end],
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetUser returns one user plus their recent interview sessions.
func (h *AdminHandler) GetUser(c *gin.Context) {
	u, err := h.users.Get(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusNotFound, "user not found")
		return
	}
	sessions, err := h.interviews.SessionsForUser(u.Email, 25)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to load sessions")
		return
	}
	response.OK(c, gin.H{"user": u, "sessions": sessions})
}

// DeleteUser removes an account. Admins may not delete themselves, which would
// be an easy way to lock the last admin out of the panel.
func (h *AdminHandler) DeleteUser(c *gin.Context) {
	claims, _ := currentClaims(c)
	target, err := h.users.Get(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusNotFound, "user not found")
		return
	}
	if claims != nil && strings.EqualFold(target.Email, claims.Email) {
		response.Error(c, http.StatusBadRequest, "you cannot delete your own account")
		return
	}
	if err := h.users.Delete(target.ID); err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to delete user")
		return
	}
	response.OK(c, gin.H{"deleted": target.ID})
}

// VerifyUser marks an email verified without the emailed code, for support
// cases where SMTP delivery failed.
func (h *AdminHandler) VerifyUser(c *gin.Context) {
	u, err := h.users.Get(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusNotFound, "user not found")
		return
	}
	if err := h.users.MarkEmailVerified(u.Email); err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to verify user")
		return
	}
	response.OK(c, gin.H{"verified": u.Email})
}

func (h *AdminHandler) ListSessions(c *gin.Context) {
	limit, offset := pageParams(c)
	sessions, total, err := h.interviews.ListSessions(strings.TrimSpace(c.Query("search")), limit, offset)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to list sessions: "+err.Error())
		return
	}
	response.OK(c, gin.H{"sessions": sessions, "total": total, "limit": limit, "offset": offset})
}

func (h *AdminHandler) GetSession(c *gin.Context) {
	s, answers, err := h.interviews.GetSession(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusNotFound, "session not found")
		return
	}
	response.OK(c, gin.H{"session": s, "answers": answers})
}

// ListQuestions returns the in-memory question bank grouped by category,
// along with how many questions each level draws from each category.
func (h *AdminHandler) ListQuestions(c *gin.Context) {
	response.OK(c, gin.H{
		"categories":     interview.QuestionsByCategory,
		"selection_rules": interview.QuestionSelectionRules,
		"path":           interview.QuestionsPath(),
	})
}

type updateQuestionsRequest struct {
	Categories map[string][]interview.QuestionDef `json:"categories" binding:"required"`
}

// UpdateQuestions writes the question bank back to questions.json and reloads
// it. Validation happens before the file is touched so a bad payload cannot
// leave the running server without questions.
func (h *AdminHandler) UpdateQuestions(c *gin.Context) {
	var req updateQuestionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request body")
		return
	}

	for category := range interview.QuestionSelectionRules {
		if len(req.Categories[category]) == 0 {
			response.Error(c, http.StatusBadRequest,
				"category '"+category+"' is required and must have at least one question")
			return
		}
	}
	for category, qs := range req.Categories {
		for i, q := range qs {
			if strings.TrimSpace(q.Text) == "" {
				response.Error(c, http.StatusBadRequest,
					"empty question text in '"+category+"' at position "+strconv.Itoa(i+1))
				return
			}
		}
	}

	path := interview.QuestionsPath()
	if path == "" {
		response.Error(c, http.StatusInternalServerError, "questions file path unknown")
		return
	}

	data, err := json.MarshalIndent(req.Categories, "", "  ")
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to encode questions")
		return
	}

	// Write to a temp file and rename, so a failed write cannot truncate the
	// live questions file.
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to write questions: "+err.Error())
		return
	}
	if err := os.Rename(tmp, path); err != nil {
		os.Remove(tmp)
		response.Error(c, http.StatusInternalServerError, "failed to replace questions file: "+err.Error())
		return
	}

	if err := interview.LoadQuestions(path); err != nil {
		response.Error(c, http.StatusInternalServerError, "questions saved but reload failed: "+err.Error())
		return
	}

	total := 0
	for _, qs := range req.Categories {
		total += len(qs)
	}
	response.OK(c, gin.H{"saved": true, "categories": len(req.Categories), "questions": total})
}

func currentClaims(c *gin.Context) (*middleware.MyClaims, bool) {
	val, ok := c.Get("user")
	if !ok {
		return nil, false
	}
	claims, ok := val.(*middleware.MyClaims)
	return claims, ok
}

func pageParams(c *gin.Context) (limit, offset int) {
	limit = 25
	if v, err := strconv.Atoi(c.Query("limit")); err == nil && v > 0 && v <= 200 {
		limit = v
	}
	if v, err := strconv.Atoi(c.Query("offset")); err == nil && v >= 0 {
		offset = v
	}
	return limit, offset
}
