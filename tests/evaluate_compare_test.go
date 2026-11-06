package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"altoai_mvp/internal/handlers"
	"altoai_mvp/internal/middleware"
	"altoai_mvp/internal/visallm"

	"github.com/gin-gonic/gin"
)

/*
 * Model selection for scoring.
 *
 * Student answers are scored by Anthropic only. What matters is that no other
 * vendor is ever called, whatever the request body asks for, that a row always
 * carries the model that produced it, and that a failure shows admins the real
 * cause while students get a neutral message.
 */

// modelSpy is a stub sidecar that records the model each call asked for and
// replies with a report naming it.
type modelSpy struct {
	mu      sync.Mutex
	seen    []string
	failFor string // this model answers 402 instead of a report
}

func (s *modelSpy) handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Model string `json:"model"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)

		s.mu.Lock()
		s.seen = append(s.seen, body.Model)
		s.mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		// Guarded on non-empty: the public path deliberately sends an empty
		// model, which must not be mistaken for the model under test.
		if s.failFor != "" && body.Model == s.failFor {
			w.WriteHeader(http.StatusPaymentRequired)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"detail": "The Anthropic account has no credits.",
			})
			return
		}
		w.Header().Set("X-Eval-Model", body.Model)
		w.Header().Set("X-Eval-Output-Tokens", "1200")
		_ = json.NewEncoder(w).Encode(visallm.Evaluation{
			Readiness: "moderate",
			// Echoing the model into the body is what lets the assertions below
			// prove a row was not filled from another model's answer.
			Summary: "scored by " + body.Model,
		})
	}
}

func compareHandler(t *testing.T, spy *modelSpy) *gin.Engine {
	t.Helper()
	sidecar := httptest.NewServer(spy.handler())
	t.Cleanup(sidecar.Close)

	h := handlers.NewEvaluateHandler(
		&visallm.Client{BaseURL: sidecar.URL, HTTP: sidecar.Client()},
		nil, visallm.NewIncidentLog(), nil, nil, nil)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/compare", h.Compare)
	r.POST("/evaluate", h.Evaluate)
	return r
}

const oneAnswer = `{"planned_answers":[{"question":"Who is sponsoring you?","answer":"My father."}]}`

func postJSON(t *testing.T, r *gin.Engine, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

type compareBody struct {
	Data struct {
		Results []struct {
			Model      string `json:"model"`
			Evaluation *struct {
				Summary string `json:"summary"`
			} `json:"evaluation"`
			Error string `json:"error"`
		} `json:"results"`
	} `json:"data"`
}

func TestCompareRunsOnlyAnthropic(t *testing.T) {
	spy := &modelSpy{}
	w := postJSON(t, compareHandler(t, spy), "/compare", oneAnswer)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	got := decodeCompare(t, w)
	if len(got.Data.Results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(got.Data.Results))
	}
	row := got.Data.Results[0]
	if row.Model != "opus" {
		t.Errorf("row is %q, expected opus", row.Model)
	}
	if row.Evaluation == nil || row.Evaluation.Summary != "scored by opus" {
		t.Errorf("opus did not return its own evaluation: %+v", row.Evaluation)
	}
}

func TestAFailingModelStillOccupiesItsRow(t *testing.T) {
	spy := &modelSpy{failFor: "opus"}
	w := postJSON(t, compareHandler(t, spy), "/compare", oneAnswer)
	if w.Code != http.StatusOK {
		t.Fatalf("a failed model must still return its row: got %d", w.Code)
	}

	got := decodeCompare(t, w)
	if len(got.Data.Results) != 1 {
		t.Fatalf("expected 1 row even with a failure, got %d", len(got.Data.Results))
	}
	row := got.Data.Results[0]
	if row.Error == "" || row.Evaluation != nil {
		t.Errorf("the failing model's row should carry an error and no report: %+v", row)
	}
	// Admins get the real cause; this screen exists to act on it.
	if !strings.Contains(row.Error, "no credits") {
		t.Errorf("admin lost the real reason: %q", row.Error)
	}
}

// The public endpoint pins the model. Without this a crafted body could send a
// student's answers to a vendor other than Anthropic.
func TestStudentsCannotChooseTheModel(t *testing.T) {
	spy := &modelSpy{}
	body := `{"model":"deepseek","planned_answers":[{"question":"Q","answer":"A"}]}`
	if w := postJSON(t, compareHandler(t, spy), "/evaluate", body); w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	spy.mu.Lock()
	defer spy.mu.Unlock()
	if len(spy.seen) != 1 || spy.seen[0] != "opus" {
		t.Fatalf("expected exactly one call, to opus; sidecar was asked for %v", spy.seen)
	}
}

func decodeCompare(t *testing.T, w *httptest.ResponseRecorder) compareBody {
	t.Helper()
	var got compareBody
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("body: %v (%s)", err, w.Body.String())
	}
	return got
}

// A student gets one report, from Anthropic.
func TestPublicEvaluationReturnsOneReport(t *testing.T) {
	spy := &modelSpy{}
	w := postJSON(t, compareHandler(t, spy), "/evaluate", oneAnswer)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	got := decodeCompare(t, w)
	if len(got.Data.Results) != 1 {
		t.Fatalf("expected 1 public result, got %d", len(got.Data.Results))
	}
	row := got.Data.Results[0]
	if row.Model != "opus" {
		t.Errorf("public report came from %q, expected opus", row.Model)
	}
	if row.Evaluation == nil || row.Evaluation.Summary != "scored by "+row.Model {
		t.Errorf("%s did not return its own evaluation: %+v", row.Model, row.Evaluation)
	}
}

// When Anthropic is down the student gets the neutral outage message, never
// the provider's billing text.
func TestPublicFailureDoesNotLeakProviderDetails(t *testing.T) {
	spy := &modelSpy{failFor: "opus"}
	w := postJSON(t, compareHandler(t, spy), "/evaluate", oneAnswer)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when scoring is down, got %d: %s", w.Code, w.Body.String())
	}
	if strings.Contains(w.Body.String(), "no credits") {
		t.Fatalf("public response leaked provider billing details: %s", w.Body.String())
	}
}

// Admins see the same single model on the student endpoint.
func TestAdminEvaluationReturnsTheAnthropicReport(t *testing.T) {
	t.Setenv("ADMIN_EMAILS", "admin@example.com")

	spy := &modelSpy{}
	sidecar := httptest.NewServer(spy.handler())
	t.Cleanup(sidecar.Close)
	h := handlers.NewEvaluateHandler(
		&visallm.Client{BaseURL: sidecar.URL, HTTP: sidecar.Client()},
		nil, visallm.NewIncidentLog(), nil, nil, nil)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/evaluate", func(c *gin.Context) {
		c.Set("user", &middleware.MyClaims{Email: "admin@example.com"})
		h.Evaluate(c)
	})

	w := postJSON(t, r, "/evaluate", oneAnswer)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decodeCompare(t, w)
	if len(got.Data.Results) != 1 || got.Data.Results[0].Model != "opus" {
		t.Fatalf("expected the single opus report for an admin, got %+v", got.Data.Results)
	}
}
