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

// AccessHandler owns the progressive validation flow: how many practice sets
// the caller has left, the two short feedback prompts, the survey that unlocks
// three more sets, and the premium waitlist.
//
// The rule the whole file exists to enforce is that feedback is never withheld.
// Nothing here can block or delay an evaluation; it only decides what is shown
// underneath one, and how many more the caller may run.
type AccessHandler struct {
	subjects  subjectResolver
	evals     repository.EvaluationRepo
	val       repository.ValidationRepo
	analytics repository.AnalyticsRepo
}

func NewAccessHandler(
	evals repository.EvaluationRepo,
	val repository.ValidationRepo,
	users services.UserService,
	analytics repository.AnalyticsRepo,
) *AccessHandler {
	return &AccessHandler{
		subjects:  subjectResolver{users: users, evals: evals, val: val},
		evals:     evals,
		val:       val,
		analytics: analytics,
	}
}

// accessState is everything the page needs to decide what to render next. It is
// computed from the database on every call rather than tracked in the browser,
// so a refresh, a second tab or a new device all agree.
type accessState struct {
	SetsUsed      int `json:"sets_used"`
	SetsAllowed   int `json:"sets_allowed"`
	SetsRemaining int `json:"sets_remaining"`

	// "rating" after the first set, "detail" after the second, "" once each has
	// been answered or skipped. Empty is the steady state.
	NextPrompt string `json:"next_prompt"`

	SurveyCompleted bool `json:"survey_completed"`
	WaitlistJoined  bool `json:"waitlist_joined"`
	SignedIn        bool `json:"signed_in"`
}

func (h *AccessHandler) stateFor(s repository.Subject) accessState {
	return computeAccess(h.evals, h.val, s)
}

// computeAccess assembles a caller's access state. A free function because the
// evaluate endpoint reports the same state alongside its own health, and the
// two must never disagree about how many sets someone has left.
//
// Missing repositories yield the default allowance rather than an error: a
// deployment without the tables should hand out the free sets, not lock
// everyone out.
func computeAccess(
	evals repository.EvaluationRepo, val repository.ValidationRepo, s repository.Subject,
) accessState {
	st := accessState{SetsAllowed: freeSets, SignedIn: s.SignedIn()}

	if evals != nil {
		used, _, err := evals.SetsUsed(s)
		if err != nil {
			log.Printf("access: could not count sets: %v", err)
		}
		st.SetsUsed = used
	}
	if val != nil {
		if extra, err := val.ExtraSets(s); err == nil {
			st.SetsAllowed += extra
		} else {
			log.Printf("access: could not read entitlements: %v", err)
		}
		if done, err := val.HasSurvey(s); err == nil {
			st.SurveyCompleted = done
		}
		if listed, err := val.OnWaitlist(s); err == nil {
			st.WaitlistJoined = listed
		}
		st.NextPrompt = nextPrompt(val, s, st.SetsUsed)
	}

	st.SetsRemaining = st.SetsAllowed - st.SetsUsed
	if st.SetsRemaining < 0 {
		st.SetsRemaining = 0
	}
	return st
}

// nextPrompt decides which short feedback question, if any, belongs under the
// report the caller is about to read.
//
// A prompt is due once the set that earns it is behind them and they have not
// already answered or skipped it. Skips are stored, so "no thanks" is as final
// as an answer — nobody is asked the same thing twice.
func nextPrompt(val repository.ValidationRepo, s repository.Subject, setsUsed int) string {
	kinds, err := val.FeedbackKinds(s)
	if err != nil {
		log.Printf("access: could not read feedback state: %v", err)
		return ""
	}
	if setsUsed >= 1 && !kinds["rating"] {
		return "rating"
	}
	if setsUsed >= 2 && !kinds["detail"] {
		return "detail"
	}
	return ""
}

// State serves the caller's access state. Public: the flow starts before anyone
// signs in, and guests are the population it most needs to work for.
func (h *AccessHandler) State(c *gin.Context) {
	response.OK(c, h.stateFor(h.subjects.resolve(c)))
}

// ---------------------------------------------------------------- feedback --

var feedbackOptions = map[string]bool{
	"answer_analysis": true, "suggested_answer": true, "risk_detection": true,
	"score": true, "none": true,
}

const maxOpenText = 1000

type feedbackBody struct {
	SetIndex   int    `json:"set_index"`
	Rating     int    `json:"rating"`
	MostUseful string `json:"most_useful"`
	OpenText   string `json:"open_text"`
	Skipped    bool   `json:"skipped"`
}

// QuickFeedback records the 1-5 rating shown under the first report.
func (h *AccessHandler) QuickFeedback(c *gin.Context) {
	h.saveFeedback(c, "rating")
}

// DetailFeedback records the card shown under the second report.
func (h *AccessHandler) DetailFeedback(c *gin.Context) {
	h.saveFeedback(c, "detail")
}

func (h *AccessHandler) saveFeedback(c *gin.Context, kind string) {
	var body feedbackBody
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request body")
		return
	}
	subject := h.subjects.resolve(c)

	f := repository.Feedback{
		Subject:  subject,
		Kind:     kind,
		SetIndex: clampSetIndex(body.SetIndex),
		Skipped:  body.Skipped,
	}
	if !body.Skipped {
		if kind == "rating" {
			if body.Rating < 1 || body.Rating > 5 {
				response.Error(c, http.StatusBadRequest, "rating must be between 1 and 5")
				return
			}
			f.Rating = body.Rating
		} else {
			if body.MostUseful != "" && !feedbackOptions[body.MostUseful] {
				response.Error(c, http.StatusBadRequest, "unknown option")
				return
			}
			f.MostUseful = body.MostUseful
			f.OpenText = truncRunes(body.OpenText, maxOpenText)
		}
	}

	if err := h.val.SaveFeedback(f); err != nil {
		response.Error(c, http.StatusInternalServerError, "could not save your feedback")
		return
	}
	if !body.Skipped {
		h.recordFeedbackEvent(c, subject, kind, f)
	}
	response.OK(c, h.stateFor(subject))
}

// ------------------------------------------------------------------ survey --

type surveyBody struct {
	InterviewTiming   string   `json:"interview_timing"`
	PrepMethods       []string `json:"prep_methods"`
	BiggestDifficulty string   `json:"biggest_difficulty"`
	MostUseful        string   `json:"most_useful"`
	InaccurateText    string   `json:"inaccurate_text"`
	PricePoint        string   `json:"price_point"`
	BlockerText       string   `json:"blocker_text"`
}

// Survey stores the validation responses and grants the unlock.
//
// Safe to call twice. The repository writes both rows under a unique index per
// subject, so a double-tapped button, a retried request or a reloaded success
// screen all end with one survey and one grant of three sets. The response is
// the same either way — the caller learns their state, not whether they were
// the one who created it.
func (h *AccessHandler) Survey(c *gin.Context) {
	var body surveyBody
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request body")
		return
	}
	// Every question is optional by design — the survey is a favour, not a
	// form — but an entirely empty submission is a client bug, not an answer.
	if body.InterviewTiming == "" && body.BiggestDifficulty == "" &&
		body.PricePoint == "" && len(body.PrepMethods) == 0 {
		response.Error(c, http.StatusBadRequest, "answer at least one question")
		return
	}

	subject := h.subjects.resolve(c)
	granted, err := h.val.SaveSurvey(repository.SurveyResponse{
		Subject:           subject,
		InterviewTiming:   trunc(body.InterviewTiming, 64),
		PrepMethods:       cleanOptions(body.PrepMethods),
		BiggestDifficulty: trunc(body.BiggestDifficulty, 64),
		MostUseful:        trunc(body.MostUseful, 32),
		InaccurateText:    truncRunes(body.InaccurateText, maxOpenText),
		PricePoint:        trunc(body.PricePoint, 32),
		BlockerText:       truncRunes(body.BlockerText, maxOpenText),
	})
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "could not save your answers")
		return
	}

	if granted {
		h.recordSurveyEvents(c, subject, body)
	}
	state := h.stateFor(subject)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"granted":       granted,
		"unlocked_sets": repository.SurveyUnlockSets,
		"access":        state,
	}})
}

// ---------------------------------------------------------------- waitlist --

// Deliberately permissive: this is a mailing list, and rejecting an address a
// mail server would have accepted costs more than storing one that bounces.
var emailPattern = regexp.MustCompile(`^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$`)

// Waitlist records interest in the paid product.
//
// A repeat submission succeeds without creating a second row, and the response
// does not distinguish the two: "that address is already on the list" would let
// anyone test whether a given person had signed up.
func (h *AccessHandler) Waitlist(c *gin.Context) {
	var body struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request body")
		return
	}
	email := strings.TrimSpace(body.Email)
	if len(email) > 255 || !emailPattern.MatchString(email) {
		response.Error(c, http.StatusBadRequest, "Enter a valid email address.")
		return
	}

	subject := h.subjects.resolve(c)
	added, err := h.val.JoinWaitlist(subject, email)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "could not add you to the waitlist")
		return
	}
	if added {
		h.event(c, subject, "premium_waitlist_joined", map[string]any{
			"signed_in": subject.SignedIn(),
		})
	}
	response.OK(c, gin.H{"joined": true})
}

// ----------------------------------------------------------------- events ---

// recordFeedbackEvent mirrors a submitted prompt into the event stream as
// feedback_answer, which is what the admin panel's feedback screen reads.
//
// Written here rather than from the browser so the screen agrees with the
// tables: an ad blocker can drop a client event, and a report nobody can act on
// because the feedback silently vanished is worse than a duplicate row.
func (h *AccessHandler) recordFeedbackEvent(
	c *gin.Context, s repository.Subject, kind string, f repository.Feedback,
) {
	props := map[string]any{"kind": kind, "set_index": f.SetIndex}
	if f.Rating > 0 {
		props["rating"] = f.Rating
	}
	if f.MostUseful != "" {
		props["most_useful"] = f.MostUseful
	}
	if f.OpenText != "" {
		props["open_text"] = f.OpenText
	}
	h.event(c, s, "feedback_answer", props)
}

func (h *AccessHandler) recordSurveyEvents(c *gin.Context, s repository.Subject, body surveyBody) {
	h.event(c, s, "extra_sets_unlocked", map[string]any{
		"sets":   repository.SurveyUnlockSets,
		"source": "survey",
	})
	// The survey's two free-text questions are the same material as the
	// feedback card, so they land in the same place the inbox already reads.
	for field, text := range map[string]string{
		"survey_inaccurate": body.InaccurateText,
		"survey_blocker":    body.BlockerText,
	} {
		if strings.TrimSpace(text) == "" {
			continue
		}
		h.event(c, s, "feedback_answer", map[string]any{
			"kind":        field,
			"open_text":   truncRunes(text, maxOpenText),
			"most_useful": body.MostUseful,
			"price_point": body.PricePoint,
		})
	}
}

// event writes one row directly, bypassing the public ingest endpoint. Failures
// are logged and swallowed — analytics never breaks a user-facing request.
func (h *AccessHandler) event(c *gin.Context, s repository.Subject, name string, props map[string]any) {
	if h.analytics == nil {
		return
	}
	visitor := visitorFor(c, s)
	if visitor == "" {
		return
	}
	if err := h.analytics.Insert([]repository.Event{{
		Name:      name,
		VisitorID: visitor,
		SessionID: c.GetHeader("X-Session-Id"),
		UserID:    s.UserID,
		Timestamp: time.Now().UTC(),
		Src:       c.GetHeader("X-Src"),
		Path:      "/check-profile",
		Props:     props,
	}}); err != nil {
		log.Printf("access: dropped %s event: %v", name, err)
	}
}

// ---------------------------------------------------------------- helpers ---

func clampSetIndex(n int) int {
	if n < 0 {
		return 0
	}
	if n > maxSetIndex {
		return maxSetIndex
	}
	return n
}

// truncRunes cuts to a character count rather than a byte count, so a limit
// described to the user as "1,000 characters" means that in any script.
func truncRunes(s string, n int) string {
	s = strings.TrimSpace(s)
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}

func cleanOptions(in []string) []string {
	out := make([]string, 0, len(in))
	for i, v := range in {
		if i >= 12 {
			break
		}
		if v = trunc(v, 48); v != "" {
			out = append(out, v)
		}
	}
	return out
}
