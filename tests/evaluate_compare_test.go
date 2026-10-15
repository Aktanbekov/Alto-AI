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
 * The admin three-model comparison.
 *
 * What matters here is not that three requests go out, but that the answer to
 * "which model wrote this" is never wrong: a row must carry the model it was
 * produced by, a model that failed must still occupy its row, and a student
 * must not be able to choose which vendor we pay.
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
				"detail": "The DeepSeek V4 Pro account has no credits.",
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

func TestCompareRunsEveryModelAndKeepsTheirAnswersApart(t *testing.T) {
	spy := &modelSpy{}
	w := postJSON(t, compareHandler(t, spy), "/compare", oneAnswer)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var got compareBody
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("body: %v (%s)", err, w.Body.String())
	}
	if len(got.Data.Results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(got.Data.Results))
	}

	// Fixed order, whichever finished first.
	want := []string{"opus", "terra", "deepseek"}
	for i, model := range want {
		if got.Data.Results[i].Model != model {
			t.Errorf("row %d is %q, expected %q", i, got.Data.Results[i].Model, model)
		}
		// Each row holds the report its own model produced, not a neighbour's.
		if ev := got.Data.Results[i].Evaluation; ev == nil {
			t.Errorf("row %d (%s) has no evaluation", i, model)
		} else if ev.Summary != "scored by "+model {
			t.Errorf("row %d (%s) carries %q", i, model, ev.Summary)
		}
	}
}

func TestAFailingModelStillOccupiesItsRow(t *testing.T) {
	spy := &modelSpy{failFor: "deepseek"}
	w := postJSON(t, compareHandler(t, spy), "/compare", oneAnswer)
	if w.Code != http.StatusOK {
		t.Fatalf("one dead provider must not sink the request: got %d", w.Code)
	}

	var got compareBody
	_ = json.Unmarshal(w.Body.Bytes(), &got)
	if len(got.Data.Results) != 3 {
		t.Fatalf("expected 3 rows even with a failure, got %d", len(got.Data.Results))
	}
	for _, row := range got.Data.Results {
		switch row.Model {
		case "deepseek":
			if row.Error == "" {
				t.Error("the failing model's row carries no error")
			}
			if row.Evaluation != nil {
				t.Error("the failing model must not carry a report")
			}
			// Admins get the real cause; this screen exists to act on it.
			if !strings.Contains(row.Error, "no credits") {
				t.Errorf("admin lost the real reason: %q", row.Error)
			}
		default:
			if row.Evaluation == nil {
				t.Errorf("%s should still have scored", row.Model)
			}
		}
	}
}

// The public endpoint must pin all three models. Without this a crafted body
// could choose which vendor we are billed by or suppress two of the reports.
func TestStudentsCannotChooseTheModel(t *testing.T) {
	spy := &modelSpy{}
	body := `{"model":"deepseek","planned_answers":[{"question":"Q","answer":"A"}]}`
	if w := postJSON(t, compareHandler(t, spy), "/evaluate", body); w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	spy.mu.Lock()
	defer spy.mu.Unlock()
	if len(spy.seen) != 3 {
		t.Fatalf("expected 3 upstream calls, got %d", len(spy.seen))
	}
	want := map[string]bool{"opus": true, "terra": true, "deepseek": true}
	for _, model := range spy.seen {
		if !want[model] {
			t.Errorf("a caller picked an unexpected model: sidecar was asked for %q", model)
		}
		delete(want, model)
	}
	if len(want) != 0 {
		t.Errorf("public evaluation skipped models: %v", want)
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

// A student gets one report, not three to arbitrate between. All three models
// still run (TestStudentsCannotChooseTheModel) so the admin comparison keeps
// its data; only the response is narrowed.
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
		t.Errorf("public report came from %q, expected the first model in order", row.Model)
	}
	if row.Evaluation == nil || row.Evaluation.Summary != "scored by "+row.Model {
		t.Errorf("%s did not return its own evaluation: %+v", row.Model, row.Evaluation)
	}
}

// When the first model is down the student still gets a report, from the next
// one in order, and never sees a failed row.
func TestPublicReportFallsThroughAFailedModel(t *testing.T) {
	spy := &modelSpy{failFor: "opus"}
	w := postJSON(t, compareHandler(t, spy), "/evaluate", oneAnswer)
	if w.Code != http.StatusOK {
		t.Fatalf("two available reports should succeed: got %d: %s", w.Code, w.Body.String())
	}

	got := decodeCompare(t, w)
	if len(got.Data.Results) != 1 {
		t.Fatalf("expected 1 public result, got %d", len(got.Data.Results))
	}
	if row := got.Data.Results[0]; row.Model != "terra" || row.Evaluation == nil || row.Error != "" {
		t.Errorf("expected terra's report with no error, got %+v", row)
	}
}

func TestPublicPartialFailureDoesNotLeakProviderDetails(t *testing.T) {
	spy := &modelSpy{failFor: "deepseek"}
	w := postJSON(t, compareHandler(t, spy), "/evaluate", oneAnswer)
	if w.Code != http.StatusOK {
		t.Fatalf("two available reports should succeed: got %d: %s", w.Code, w.Body.String())
	}
	if strings.Contains(w.Body.String(), "no credits") {
		t.Fatalf("public response leaked provider billing details: %s", w.Body.String())
	}
	for _, row := range decodeCompare(t, w).Data.Results {
		if row.Error != "" {
			t.Errorf("a student should never see a failed provider row: %+v", row)
		}
	}
}

// Admins keep the three-way view on the student endpoint, failed row included,
// with the neutral message rather than the provider's billing text.
func TestAdminEvaluationReturnsEveryModel(t *testing.T) {
	t.Setenv("ADMIN_EMAILS", "admin@example.com")

	spy := &modelSpy{failFor: "deepseek"}
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
	if len(got.Data.Results) != 3 {
		t.Fatalf("expected 3 results for an admin, got %d", len(got.Data.Results))
	}
	for _, row := range got.Data.Results {
		if row.Model == "deepseek" && row.Error == "" {
			t.Error("the unavailable provider should keep its error row for admins")
		}
	}
}
