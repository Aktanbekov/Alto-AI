package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"altoai_mvp/internal/middleware"
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
	val       repository.ValidationRepo
	subjects  subjectResolver
}

func NewEvaluateHandler(
	client *visallm.Client,
	userSvc services.UserService,
	incidents *visallm.IncidentLog,
	evals repository.EvaluationRepo,
	analytics repository.AnalyticsRepo,
	val repository.ValidationRepo,
) *EvaluateHandler {
	return &EvaluateHandler{
		client: client, userSvc: userSvc, incidents: incidents,
		evals: evals, analytics: analytics, val: val,
		subjects: subjectResolver{users: userSvc, evals: evals, val: val},
	}
}

// Status lets the frontend hide the feature when the sidecar isn't deployed,
// rather than surfacing a failed request.
func (h *EvaluateHandler) Status(c *gin.Context) {
	// The access state rides along so the page needs one round trip on mount to
	// learn both whether scoring works and how many sets are left.
	//
	// signup_required is still in the payload, always false. Signing up stopped
	// being a condition of practising when the free allowance went to two sets
	// for everyone, but a cached bundle from before that release still reads
	// this field and would bounce people to /signup if it went missing.
	access := computeAccess(h.evals, h.val, h.subjects.resolve(c), unlimitedPractice(c))
	body := gin.H{"signup_required": false, "access": access}

	switch {
	case !h.client.Configured():
		body["available"], body["detail"] = false, "visa-llm is not configured"
	default:
		health, err := h.client.Health(c.Request.Context())
		if err != nil {
			body["available"], body["detail"] = false, err.Error()
		} else {
			body["available"], body["detail"] = health.APIKeyConfigured, health.Detail
		}
	}
	response.OK(c, body)
}

// Evaluate proxies a profile to the sidecar. The caller's college and major
// are filled in from their account when not supplied explicitly.
func (h *EvaluateHandler) Evaluate(c *gin.Context) {
	// The set number is ours, not the sidecar's. Binding it into a wrapper
	// around ProfileRequest keeps the body forwarded to visa-llm byte-identical
	// to what it received before this field existed.
	var body struct {
		visallm.ProfileRequest
		SetIndex int `json:"set_index"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request body")
		return
	}
	req := body.ProfileRequest
	setIndex := clampSetIndex(body.SetIndex)

	// Model choice is not the caller's. Clear it before runAll selects the fixed
	// three-provider set, so a crafted body cannot choose which vendor we pay or
	// suppress two of the reports.
	req.Model = ""

	if len(req.PlannedAnswers) == 0 {
		response.Error(c, http.StatusBadRequest, "add at least one question and answer")
		return
	}

	subject := h.subjects.resolve(c)
	userID := subject.UserID
	if claims, ok := currentClaims(c); ok && claims != nil && h.userSvc != nil {
		if user, err := h.userSvc.GetByEmail(c.Request.Context(), claims.Email); err == nil {
			if req.University == "" {
				req.University = user.College
			}
			if req.Major == "" {
				req.Major = user.Major
			}
		}
	}
	if !subject.SignedIn() {
		// The server-issued browser identity is what anonymous persistence
		// hangs off. It cannot be reset by clearing localStorage because the
		// cookie is HttpOnly.
		c.Request.Header.Set("X-Visitor-Id", subject.VisitorID)
	}

	if msg, ok := h.allowed(c, subject, setIndex); !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": msg, "code": "sets_exhausted"})
		return
	}

	started := time.Now()
	results, runErrs := h.runAll(c.Request.Context(), req)
	latency := time.Since(started).Milliseconds()

	var primary *visallm.Evaluation
	primaryIdx := -1
	aggregate := visallm.Usage{CostKnown: true}
	models := make([]string, 0, len(results))
	var firstErr error
	for i := range results {
		if runErrs[i] != nil {
			if firstErr == nil {
				firstErr = runErrs[i]
			}
			continue
		}
		if results[i].Evaluation == nil || results[i].Usage == nil {
			continue
		}
		if primary == nil {
			primary = results[i].Evaluation
			primaryIdx = i
		}
		models = append(models, results[i].Model)
		aggregate.InputTokens += results[i].Usage.InputTokens
		aggregate.CachedTokens += results[i].Usage.CachedTokens
		aggregate.OutputTokens += results[i].Usage.OutputTokens
		aggregate.CostUSD += results[i].Usage.CostUSD
		aggregate.CostKnown = aggregate.CostKnown && results[i].Usage.CostKnown
	}

	if primary == nil {
		// Store what they wrote before saying scoring is down. The message they
		// are about to read promises their answers are saved, and until this
		// call existed that promise was false: persist ran only on the success
		// path, so a scoring outage threw away the work as well as the report.
		h.persistFailure(c, req, latency, userID, setIndex)
		if firstErr == nil {
			firstErr = errors.New("no provider returned an evaluation")
		}
		h.failed(c, firstErr)
		return
	}

	email := ""
	if claims, ok := currentClaims(c); ok && claims != nil {
		email = claims.Email
	}
	for i := range results {
		if runErrs[i] != nil {
			h.recordPartialFailure(runErrs[i], email)
			// Keep the failed tab so the response is visibly three-way rather than
			// silently becoming a two-model answer, but hide operator details.
			results[i].Error = "This provider could not return a report. Please use the other available reports."
			continue
		}
		if h.incidents != nil && results[i].Usage != nil {
			h.incidents.RecordRun(visallm.Run{Usage: *results[i].Usage, UserEmail: email})
		}
		// Cost and token counts are operational data; the public UI needs the
		// model's answer, not the account's spend.
		results[i].Usage = nil
	}
	aggregate.Model = strings.Join(models, ",")
	h.persist(c, req, *primary, results, aggregate, latency, userID, setIndex)

	// All three still run and are stored, so the admin comparison keeps its
	// data. Only admins see them side by side: a student handed three verdicts
	// that can disagree has to arbitrate between vendors, which is not their
	// job. Everyone else gets the first report in the fixed model order, so a
	// provider that is down falls through to the next one instead of a gap.
	if !middleware.IsAdminEmail(email) {
		response.OK(c, gin.H{"results": results[primaryIdx : primaryIdx+1]})
		return
	}
	response.OK(c, gin.H{"results": results})
}

// recordPartialFailure records a provider failure without writing an HTTP
// response. A multi-model request can still succeed when one provider is down.
func (h *EvaluateHandler) recordPartialFailure(err error, email string) {
	var up *visallm.UpstreamError
	if errors.As(err, &up) {
		h.record(visallm.KindOf(err), up.Detail, up.StatusCode, email)
		return
	}
	status := http.StatusBadGateway
	if errors.Is(err, visallm.ErrNotConfigured) || strings.Contains(err.Error(), "unreachable") {
		status = http.StatusServiceUnavailable
	}
	h.record("upstream", err.Error(), status, email)
}

// setsExhaustedMessage is what the page turns into the access screen. It names
// the exchange on offer rather than a wall, because there is one.
const setsExhaustedMessage = "You have used all of your practice sets. " +
	"Complete the short survey to unlock three more."

// allowed decides whether this evaluation may run.
//
// Two separate limits, for two separate reasons:
//
//   - The product rule is counted in distinct sets, so re-scoring a set already
//     spent — the same three questions after a refresh — is free. Charging for
//     that would punish people for reloading a page.
//   - The cost ceiling is counted in evaluations, because every one is a model
//     call we pay for. Without it a client that pinned set_index to a set it
//     already owned could re-score forever on our budget.
func (h *EvaluateHandler) allowed(c *gin.Context, s repository.Subject, setIndex int) (string, bool) {
	if unlimitedPractice(c) || h.evals == nil {
		return "", true
	}
	distinct, total, err := h.evals.SetsUsed(s)
	if err != nil {
		// Fail open. A counting query that cannot run is our problem, and
		// refusing to score someone over it is the worse of the two failures.
		log.Printf("evaluate: could not count sets, allowing: %v", err)
		return "", true
	}

	allowedSets := freeSets
	if h.val != nil {
		if extra, err := h.val.ExtraSets(s); err == nil {
			allowedSets += extra
		} else {
			log.Printf("evaluate: could not read entitlements: %v", err)
		}
	}

	if total >= allowedSets+rescoreSlack {
		return setsExhaustedMessage, false
	}
	if distinct < allowedSets {
		return "", true
	}
	// Their allowance is spent, so this is only allowed if it is a set they
	// already hold.
	owned, err := h.evals.UsedSet(s, setIndex)
	if err != nil {
		log.Printf("evaluate: could not check set ownership, allowing: %v", err)
		return "", true
	}
	if owned {
		return "", true
	}
	return setsExhaustedMessage, false
}

// rescoreSlack is how many repeat runs sit on top of the set allowance before
// the cost ceiling bites — enough for genuine refreshes and retries, not enough
// to be worth automating.
const rescoreSlack = 2

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
	results []ModelResult,
	usage visallm.Usage,
	latencyMS int64,
	userID string,
	setIndex int,
) {
	// Keep the same three-result envelope the student received. `ev` below is
	// the first successful report (normally Opus), used only for denormalised
	// analytics fields that need one stable baseline.
	raw, _ := json.Marshal(gin.H{"results": results})
	var report map[string]any
	_ = json.Unmarshal(raw, &report)

	profileMap, answers := submission(req)

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
			SetIndex:       setIndex,
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
				"set_index":          setIndex,
			},
		}})
	}
}

// submission splits a request into the two things worth keeping: the profile
// as written, and the question/answer pairs. Both stored evaluations and stored
// failures need exactly this, which is why it is not inlined in either.
func submission(req visallm.ProfileRequest) (map[string]any, []any) {
	profile, _ := json.Marshal(req)
	var profileMap map[string]any
	_ = json.Unmarshal(profile, &profileMap)

	answers := make([]any, 0, len(req.PlannedAnswers))
	for _, a := range req.PlannedAnswers {
		answers = append(answers, map[string]any{"question": a.Question, "answer": a.Answer})
	}
	return profileMap, answers
}

// persistFailure stores a submission whose scoring never came back.
//
// The row carries the profile and the answers and an empty report, flagged so
// the entitlement counts skip it: a run that produced nothing must not spend a
// set. It is what makes "your answers are saved" true, and it is what puts the
// answers in front of an admin — a scoring outage used to leave no trace of the
// student's side of it at all, only an incident with our error text in it.
//
// Like persist, this never fails the request. The student is already being told
// something went wrong; a second failure underneath does not change what they
// see, only what the logs say.
func (h *EvaluateHandler) persistFailure(
	c *gin.Context,
	req visallm.ProfileRequest,
	latencyMS int64,
	userID string,
	setIndex int,
) {
	if h.evals == nil {
		return
	}
	profileMap, answers := submission(req)

	if _, err := h.evals.Save(repository.StoredEvaluation{
		UserID:         userID,
		VisitorID:      c.GetHeader("X-Visitor-Id"),
		Profile:        profileMap,
		Answers:        answers,
		LatencyMS:      latencyMS,
		Consulate:      req.ConsulateCity,
		Country:        req.ConsulateCountry,
		DegreeLevel:    req.DegreeLevel,
		GPABand:        gpaBandOf(req.GPA, req.GPAScale),
		AttemptNumber:  req.AttemptNumber,
		HasConsulateNs: corpusCities[strings.TrimSpace(req.ConsulateCity)],
		SetIndex:       setIndex,
		Failed:         true,
	}); err != nil {
		log.Printf("evaluate: could not store unscored submission: %v", err)
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
