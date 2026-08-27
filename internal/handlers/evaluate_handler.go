package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"altoai_mvp/internal/repository"
	"altoai_mvp/internal/services"
	"altoai_mvp/internal/visallm"
	"altoai_mvp/pkg/response"

	"github.com/gin-gonic/gin"
)

// What a student sees when the failure is ours. It says the truth — scoring is
// not working and it is not their doing — without naming a billing account.
const evaluatorDownMessage = "Scoring is temporarily unavailable. Your answers are saved — " +
	"please try again in a few minutes."

// EvaluateHandler exposes the visa-llm sidecar to authenticated users. The
// sidecar grounds its feedback in a corpus of real interview reviews, which is
// a different thing from the per-answer scoring in the chat flow.
type EvaluateHandler struct {
	client    *visallm.Client
	userSvc   services.UserService
	incidents *visallm.IncidentLog
	evals     repository.EvaluationRepo
	analytics repository.AnalyticsRepo
}

func NewEvaluateHandler(
	client *visallm.Client,
	userSvc services.UserService,
	incidents *visallm.IncidentLog,
	evals repository.EvaluationRepo,
	analytics repository.AnalyticsRepo,
) *EvaluateHandler {
	return &EvaluateHandler{
		client: client, userSvc: userSvc, incidents: incidents,
		evals: evals, analytics: analytics,
	}
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

	userID := ""
	if claims, ok := currentClaims(c); ok && claims != nil {
		if user, err := h.userSvc.GetByEmail(c.Request.Context(), claims.Email); err == nil {
			userID = user.ID
			if req.University == "" {
				req.University = user.College
			}
			if req.Major == "" {
				req.Major = user.Major
			}
		}
	}

	started := time.Now()
	evaluation, usage, err := h.client.EvaluateWithUsage(c.Request.Context(), req)
	latency := time.Since(started).Milliseconds()
	if err != nil {
		h.failed(c, err)
		return
	}

	email := ""
	if claims, ok := currentClaims(c); ok && claims != nil {
		email = claims.Email
	}
	if h.incidents != nil {
		h.incidents.RecordRun(visallm.Run{Usage: usage, UserEmail: email})
	}
	h.persist(c, req, evaluation, usage, latency, userID)
	response.OK(c, evaluation)
}

// failed turns an evaluation error into a student-facing response and, when the
// cause is ours, an admin-visible incident.
//
// Nothing about our Anthropic account reaches the student: "no credits, add
// them in the console" is an instruction only an operator can act on, and it
// tells every visitor that the product is unpaid. Admins get the real text in
// the evaluator tab; the logs keep it too, so a restart does not lose it.
func (h *EvaluateHandler) failed(c *gin.Context, err error) {
	if errors.Is(err, visallm.ErrNotConfigured) {
		response.Error(c, http.StatusServiceUnavailable, err.Error())
		return
	}

	email := ""
	if claims, ok := currentClaims(c); ok && claims != nil {
		email = claims.Email
	}

	var up *visallm.UpstreamError
	if errors.As(err, &up) && up.Operator() {
		h.record(visallm.KindOf(err), up.Detail, up.StatusCode, email)
		response.Error(c, http.StatusServiceUnavailable, evaluatorDownMessage)
		return
	}

	// Everything else is a fault rather than an account problem. The sidecar
	// being unreachable is still not the student's business, so it gets the
	// same neutral message — but it is recorded too.
	msg := err.Error()
	if strings.Contains(msg, "unreachable") {
		h.record("upstream", msg, http.StatusServiceUnavailable, email)
		response.Error(c, http.StatusServiceUnavailable, evaluatorDownMessage)
		return
	}
	h.record("upstream", msg, http.StatusBadGateway, email)
	response.Error(c, http.StatusBadGateway, evaluatorDownMessage)
}

func (h *EvaluateHandler) record(kind, detail string, status int, email string) {
	log.Printf("evaluate: %s failure (%d): %s", kind, status, detail)
	if h.incidents == nil {
		return
	}
	h.incidents.Record(visallm.Incident{
		Kind:       kind,
		Detail:     detail,
		StatusCode: status,
		UserEmail:  email,
	})
}

// gpaBandOf buckets a raw GPA for the event stream. The raw value goes to the
// evaluations table; only the band is ever allowed into analytics.
//
// Bands are on the scale the student chose, so a 3.15/4 and a 7.9/10 both land
// in the band that matches their percent-of-maximum.
func gpaBandOf(raw, scale string) string {
	value, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	if err != nil {
		return ""
	}
	max, err := strconv.ParseFloat(strings.TrimSpace(scale), 64)
	if err != nil || max <= 0 {
		return ""
	}
	switch pct := value / max; {
	case pct < 0.5:
		return "<0.5"
	case pct < 0.6:
		return "0.5-0.6"
	case pct < 0.7:
		return "0.6-0.7"
	case pct < 0.8:
		return "0.7-0.8"
	case pct < 0.9:
		return "0.8-0.9"
	default:
		return "0.9+"
	}
}

// persist stores the submission and its report, then records the matching
// report_generated event.
//
// The split is the whole privacy design: everything the student wrote goes to
// the evaluations table keyed to them, and the event carries only shape —
// bands, counts, latency, tokens. Neither write is allowed to fail the request;
// the student already has their report.
func (h *EvaluateHandler) persist(
	c *gin.Context,
	req visallm.ProfileRequest,
	ev visallm.Evaluation,
	usage visallm.Usage,
	latencyMS int64,
	userID string,
) {
	raw, _ := json.Marshal(ev)
	var report map[string]any
	_ = json.Unmarshal(raw, &report)

	answers := make([]any, 0, len(req.PlannedAnswers))
	for _, a := range req.PlannedAnswers {
		answers = append(answers, map[string]any{"question": a.Question, "answer": a.Answer})
	}

	flagCount := len(ev.RiskFactors)
	flagIDs := make([]any, 0, flagCount)
	for _, rf := range ev.RiskFactors {
		flagIDs = append(flagIDs, rf.Severity+":"+truncWords(rf.Factor, 6))
	}
	band := gpaBandOf(req.GPA, req.GPAScale)
	// "Does the corpus actually cover this consulate" — the number that decides
	// whether the report's statistics mean anything for this student.
	hasConsulate := corpusCities[strings.TrimSpace(req.ConsulateCity)]

	if h.evals != nil {
		profile, _ := json.Marshal(req)
		var profileMap map[string]any
		_ = json.Unmarshal(profile, &profileMap)

		if _, err := h.evals.Save(repository.StoredEvaluation{
			UserID:         userID,
			VisitorID:      c.GetHeader("X-Visitor-Id"),
			Profile:        profileMap,
			Answers:        answers,
			Report:         report,
			Model:          usage.Model,
			InputTokens:    usage.InputTokens,
			OutputTokens:   usage.OutputTokens,
			CachedTokens:   usage.CachedTokens,
			CostUSD:        usage.CostUSD,
			LatencyMS:      latencyMS,
			Consulate:      req.ConsulateCity,
			Country:        req.ConsulateCountry,
			DegreeLevel:    req.DegreeLevel,
			GPABand:        band,
			ReadinessBand:  ev.Readiness,
			FlagCount:      flagCount,
			AttemptNumber:  req.AttemptNumber,
			HasConsulateNs: hasConsulate,
		}); err != nil {
			log.Printf("evaluate: could not store evaluation: %v", err)
		}
	}

	// report_generated is emitted here rather than from the browser: the token
	// counts and latency only exist on this side, and a client-sent cost figure
	// would be worth nothing.
	if h.analytics != nil {
		visitor := c.GetHeader("X-Visitor-Id")
		if visitor == "" {
			return
		}
		_ = h.analytics.Insert([]repository.Event{{
			Name:      "report_generated",
			VisitorID: visitor,
			SessionID: c.GetHeader("X-Session-Id"),
			UserID:    userID,
			Timestamp: time.Now().UTC(),
			Src:       c.GetHeader("X-Src"),
			Path:      "/check-profile",
			Props: map[string]any{
				"latency_ms":         latencyMS,
				"flag_ids":           flagIDs,
				"flag_count":         flagCount,
				"readiness_band":     ev.Readiness,
				"comparable_n":       len(ev.ComparableInterviews),
				"has_consulate_data": hasConsulate,
				"input_tokens":       usage.InputTokens,
				"output_tokens":      usage.OutputTokens,
				"model":              usage.Model,
				"cost_usd":           usage.CostUSD,
				"consulate":          req.ConsulateCity,
				"degree_level":       req.DegreeLevel,
				"gpa_band":           band,
				"answers_in_round":   len(req.PlannedAnswers),
			},
		}})
	}
}

// corpusCities are the consulates the corpus actually covers. Anything else
// gets a report built from national and overall statistics only, which the
// coverage-gaps screen exists to surface.
var corpusCities = map[string]bool{
	"New Delhi": true, "Mumbai": true, "Hyderabad": true,
	"Chennai": true, "Kolkata": true, "Tashkent": true, "Abu Dhabi": true,
}

func truncWords(s string, n int) string {
	fields := strings.Fields(strings.ToLower(s))
	if len(fields) > n {
		fields = fields[:n]
	}
	return strings.Join(fields, "_")
}
