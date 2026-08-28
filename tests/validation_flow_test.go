package tests

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"altoai_mvp/internal/handlers"
	"altoai_mvp/internal/repository"
	"altoai_mvp/internal/visallm"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

// The progressive validation flow, end to end against a real database.
//
// Everything here is about a promise made in the interface: two free sets, a
// prompt asked once, three more sets for a survey completed once. Each of those
// is a uniqueness or counting rule in Postgres, so the tests drive the HTTP
// handlers and read the consequences back through them rather than asserting on
// SQL — a rule that only holds in the query and not through the endpoint is not
// holding at all.

// openValidationDB connects and ensures every schema this flow touches,
// skipping when there is no database (CI without one should not fail).
func openValidationDB(t *testing.T) *sql.DB {
	t.Helper()
	conn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		env("POSTGRES_HOST", "localhost"), env("POSTGRES_PORT", "5432"),
		env("POSTGRES_USER", ""), env("POSTGRES_PASSWORD", ""), env("POSTGRES_DB", ""))
	db, err := sql.Open("postgres", conn)
	if err != nil {
		t.Skipf("no database: %v", err)
	}
	if err := db.Ping(); err != nil {
		t.Skipf("database unreachable: %v", err)
	}
	for _, ensure := range []func(*sql.DB) error{
		repository.EnsureEvaluationSchema,
		repository.EnsureValidationSchema,
		repository.EnsureAnalyticsSchema,
	} {
		if err := ensure(db); err != nil {
			t.Fatalf("schema: %v", err)
		}
	}
	return db
}

// flow is one browser's worth of state: a router with the real handlers behind
// it, and the guest cookie that identifies this test's caller.
type flow struct {
	t       *testing.T
	router  *gin.Engine
	guestID string
	db      *sql.DB
}

// newFlow stands up the access and evaluate endpoints against a stub sidecar
// that always succeeds, so the tests measure entitlement rather than scoring.
func newFlow(t *testing.T) *flow {
	t.Helper()
	db := openValidationDB(t)

	sidecar := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(visallm.Evaluation{
			Readiness: "moderate", Summary: "ok", Caveat: "test",
		})
	}))
	t.Cleanup(sidecar.Close)

	evals := repository.NewEvaluationRepo(db)
	val := repository.NewValidationRepo(db)
	access := handlers.NewAccessHandler(evals, val, nil, nil)
	evaluate := handlers.NewEvaluateHandler(
		&visallm.Client{BaseURL: sidecar.URL, HTTP: sidecar.Client()},
		nil, visallm.NewIncidentLog(), evals, nil, val)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/v1/access", access.State)
	r.POST("/api/v1/feedback/quick", access.QuickFeedback)
	r.POST("/api/v1/feedback/detail", access.DetailFeedback)
	r.POST("/api/v1/survey", access.Survey)
	r.POST("/api/v1/waitlist", access.Waitlist)
	r.POST("/api/v1/evaluate", evaluate.Evaluate)

	f := &flow{t: t, router: r, guestID: uuid.NewString(), db: db}
	t.Cleanup(f.cleanup)
	return f
}

// cleanup removes only this test's rows, so the suite can run against a
// developer's own database without eating their data.
func (f *flow) cleanup() {
	for _, table := range []string{
		"evaluations", "quiz_feedback", "validation_surveys",
		"quiz_entitlements", "premium_waitlist",
	} {
		_, _ = f.db.Exec(`DELETE FROM `+table+` WHERE visitor_id = $1`, f.guestID)
	}
}

func (f *flow) do(method, path, body string) *httptest.ResponseRecorder {
	f.t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "alto_guest_id", Value: f.guestID})
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, req)
	return w
}

// score submits one set and returns the status code.
func (f *flow) score(setIndex int) int {
	f.t.Helper()
	body := fmt.Sprintf(
		`{"set_index":%d,"planned_answers":[{"question":"Who is sponsoring you?","answer":"My father."}]}`,
		setIndex)
	return f.do(http.MethodPost, "/api/v1/evaluate", body).Code
}

type accessState struct {
	SetsUsed        int    `json:"sets_used"`
	SetsAllowed     int    `json:"sets_allowed"`
	SetsRemaining   int    `json:"sets_remaining"`
	NextPrompt      string `json:"next_prompt"`
	SurveyCompleted bool   `json:"survey_completed"`
	WaitlistJoined  bool   `json:"waitlist_joined"`
}

func (f *flow) access() accessState {
	f.t.Helper()
	w := f.do(http.MethodGet, "/api/v1/access", "")
	if w.Code != http.StatusOK {
		f.t.Fatalf("access returned %d: %s", w.Code, w.Body.String())
	}
	var wrapper struct {
		Data accessState `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &wrapper); err != nil {
		f.t.Fatalf("access body: %v (%s)", err, w.Body.String())
	}
	return wrapper.Data
}

const validSurvey = `{"interview_timing":"Within 2 weeks","prep_methods":["YouTube"],
	"biggest_difficulty":"Knowing what to say","most_useful":"answer_analysis",
	"price_point":"$10","inaccurate_text":"the GPA band felt off"}`

// ------------------------------------------------------------- entitlement --

func TestTwoSetsAreFreeAndTheThirdIsNot(t *testing.T) {
	f := newFlow(t)

	if got := f.access(); got.SetsAllowed != 2 || got.SetsRemaining != 2 {
		t.Fatalf("a new visitor should start with two free sets, got %+v", got)
	}
	for set := 0; set < 2; set++ {
		if code := f.score(set); code != http.StatusOK {
			t.Fatalf("set %d should be free, got %d", set, code)
		}
	}

	w := f.do(http.MethodPost, "/api/v1/evaluate",
		`{"set_index":2,"planned_answers":[{"question":"q","answer":"a"}]}`)
	if w.Code != http.StatusForbidden {
		t.Fatalf("third set should be refused, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "sets_exhausted") {
		t.Errorf("refusal should carry the sets_exhausted code, got %s", w.Body.String())
	}
	// The refusal must not read as a billing or account problem.
	for _, leak := range []string{"signup_required", "Create an account"} {
		if strings.Contains(w.Body.String(), leak) {
			t.Errorf("refusal still talks about signing up: %s", w.Body.String())
		}
	}
}

// Refreshing the page and scoring the same three answers again is not reaching
// for a new set, and must not cost one.
func TestRescoringASetAlreadyOwnedIsFree(t *testing.T) {
	f := newFlow(t)

	f.score(0)
	if got := f.access(); got.SetsUsed != 1 {
		t.Fatalf("one set scored should count as one, got %d", got.SetsUsed)
	}
	if code := f.score(0); code != http.StatusOK {
		t.Fatalf("re-scoring set 0 should be allowed, got %d", code)
	}
	if got := f.access(); got.SetsUsed != 1 {
		t.Errorf("re-scoring should not consume an allowance, used %d", got.SetsUsed)
	}
}

// The counterpart to the rule above: repeats are free, but not unlimited, since
// each one is a model call somebody pays for.
func TestRepeatScoringStopsAtTheCostCeiling(t *testing.T) {
	f := newFlow(t)

	f.score(0)
	f.score(1)
	// Two free sets plus the slack for genuine retries; the next one is refused
	// however owned the set is.
	f.score(0)
	f.score(1)
	if code := f.score(0); code != http.StatusForbidden {
		t.Errorf("the cost ceiling should stop unlimited re-scoring, got %d", code)
	}
}

// ------------------------------------------------------------------ survey --

func TestSurveyGrantsExactlyThreeSetsOnce(t *testing.T) {
	f := newFlow(t)

	f.score(0)
	f.score(1)

	w := f.do(http.MethodPost, "/api/v1/survey", validSurvey)
	if w.Code != http.StatusOK {
		t.Fatalf("survey should be accepted, got %d: %s", w.Code, w.Body.String())
	}
	after := f.access()
	if after.SetsAllowed != 5 {
		t.Fatalf("survey should grant exactly three more sets, allowed %d", after.SetsAllowed)
	}
	if !after.SurveyCompleted {
		t.Error("survey should be recorded as completed")
	}

	// A double-tapped button, a retried request, a reloaded success screen.
	for i := 0; i < 3; i++ {
		if code := f.do(http.MethodPost, "/api/v1/survey", validSurvey).Code; code != http.StatusOK {
			t.Fatalf("repeat submission should still succeed, got %d", code)
		}
	}
	if again := f.access(); again.SetsAllowed != 5 {
		t.Errorf("repeat submissions must not grant more sets, allowed %d", again.SetsAllowed)
	}

	// And the sets it granted are actually usable.
	for set := 2; set < 5; set++ {
		if code := f.score(set); code != http.StatusOK {
			t.Errorf("unlocked set %d should be scorable, got %d", set, code)
		}
	}
}

func TestUnlockSurvivesAcrossRequests(t *testing.T) {
	f := newFlow(t)

	f.score(0)
	f.score(1)
	f.do(http.MethodPost, "/api/v1/survey", validSurvey)

	// A fresh request with the same cookie is what a refresh looks like: the
	// grant lives in the database, not in the page that asked for it.
	if got := f.access(); got.SetsAllowed != 5 || !got.SurveyCompleted {
		t.Errorf("unlock did not survive a new request: %+v", got)
	}
}

// Someone who unlocks as a guest and then creates an account keeps what they
// earned, rather than starting over.
func TestGuestUnlockTransfersToTheAccount(t *testing.T) {
	f := newFlow(t)
	userID := uuid.NewString()
	t.Cleanup(func() {
		for _, table := range []string{"quiz_entitlements", "validation_surveys", "quiz_feedback", "evaluations"} {
			_, _ = f.db.Exec(`DELETE FROM `+table+` WHERE user_id = $1`, userID)
		}
	})

	f.do(http.MethodPost, "/api/v1/survey", validSurvey)

	val := repository.NewValidationRepo(f.db)
	if err := val.Claim(userID, f.guestID); err != nil {
		t.Fatalf("claim: %v", err)
	}

	account := repository.Subject{UserID: userID}
	extra, err := val.ExtraSets(account)
	if err != nil {
		t.Fatalf("extra sets: %v", err)
	}
	if extra != repository.SurveyUnlockSets {
		t.Errorf("account should hold the guest's unlock, got %d", extra)
	}
	// And the guest cookie no longer carries it, so a shared browser does not
	// hand the next person someone else's unlock.
	if left, _ := val.ExtraSets(repository.Subject{VisitorID: f.guestID}); left != 0 {
		t.Errorf("unlock should have moved off the cookie, %d left behind", left)
	}
}

// ---------------------------------------------------------------- prompts --

func TestPromptsAreAskedOnceEach(t *testing.T) {
	f := newFlow(t)

	if got := f.access(); got.NextPrompt != "" {
		t.Errorf("nothing is due before the first set, got %q", got.NextPrompt)
	}

	f.score(0)
	if got := f.access(); got.NextPrompt != "rating" {
		t.Fatalf("the rating is due after the first set, got %q", got.NextPrompt)
	}
	if code := f.do(http.MethodPost, "/api/v1/feedback/quick", `{"set_index":0,"rating":4}`).Code; code != http.StatusOK {
		t.Fatalf("rating should save, got %d", code)
	}
	if got := f.access(); got.NextPrompt != "" {
		t.Errorf("an answered rating must not be asked again, got %q", got.NextPrompt)
	}

	f.score(1)
	if got := f.access(); got.NextPrompt != "detail" {
		t.Fatalf("the detail card is due after the second set, got %q", got.NextPrompt)
	}

	// A skip closes the question as firmly as an answer does.
	if code := f.do(http.MethodPost, "/api/v1/feedback/detail", `{"set_index":1,"skipped":true}`).Code; code != http.StatusOK {
		t.Fatalf("skip should save, got %d", code)
	}
	if got := f.access(); got.NextPrompt != "" {
		t.Errorf("a skipped prompt must not come back, got %q", got.NextPrompt)
	}
}

func TestFeedbackRejectsARatingOutOfRange(t *testing.T) {
	f := newFlow(t)
	for _, body := range []string{`{"rating":0}`, `{"rating":6}`, `{"rating":-1}`} {
		if code := f.do(http.MethodPost, "/api/v1/feedback/quick", body).Code; code != http.StatusBadRequest {
			t.Errorf("%s should be rejected, got %d", body, code)
		}
	}
}

// Scoring is never withheld pending a prompt: the report comes first, always.
func TestAnUnansweredPromptDoesNotBlockScoring(t *testing.T) {
	f := newFlow(t)

	if code := f.score(0); code != http.StatusOK {
		t.Fatalf("first set: %d", code)
	}
	if got := f.access(); got.NextPrompt != "rating" {
		t.Fatalf("expected a pending prompt to test against, got %q", got.NextPrompt)
	}
	if code := f.score(1); code != http.StatusOK {
		t.Errorf("a pending prompt must not block the next set, got %d", code)
	}
}

// ---------------------------------------------------------------- waitlist --

func TestWaitlistValidatesAndDeduplicates(t *testing.T) {
	f := newFlow(t)
	email := "waitlist-" + f.guestID[:8] + "@example.com"
	t.Cleanup(func() { _, _ = f.db.Exec(`DELETE FROM premium_waitlist WHERE email = $1`, email) })

	for _, bad := range []string{`{"email":"nope"}`, `{"email":"a@b"}`, `{"email":""}`, `{"email":"a b@c.com"}`} {
		if code := f.do(http.MethodPost, "/api/v1/waitlist", bad).Code; code != http.StatusBadRequest {
			t.Errorf("%s should be rejected, got %d", bad, code)
		}
	}

	body := fmt.Sprintf(`{"email":%q}`, email)
	for i := 0; i < 3; i++ {
		if code := f.do(http.MethodPost, "/api/v1/waitlist", body).Code; code != http.StatusOK {
			t.Fatalf("submission %d should succeed, got %d", i+1, code)
		}
	}

	var rows int
	if err := f.db.QueryRow(
		`SELECT COUNT(*) FROM premium_waitlist WHERE lower(email) = lower($1)`, email).Scan(&rows); err != nil {
		t.Fatalf("count: %v", err)
	}
	if rows != 1 {
		t.Errorf("three submissions of one address should leave one row, found %d", rows)
	}
	if got := f.access(); !got.WaitlistJoined {
		t.Error("access state should report them as on the waitlist")
	}
}
