package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"altoai_mvp/internal/handlers"
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
	want := []string{"opus", "deepseek", "o3-mini"}
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

// The public endpoint must pin the model. Without this a crafted body picks
// which vendor we are billed by.
func TestStudentsCannotChooseTheModel(t *testing.T) {
	spy := &modelSpy{}
	body := `{"model":"deepseek","planned_answers":[{"question":"Q","answer":"A"}]}`
	if w := postJSON(t, compareHandler(t, spy), "/evaluate", body); w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	spy.mu.Lock()
	defer spy.mu.Unlock()
	if len(spy.seen) != 1 {
		t.Fatalf("expected 1 upstream call, got %d", len(spy.seen))
	}
	if spy.seen[0] != "" {
		t.Errorf("a caller picked the model: sidecar was asked for %q, expected the "+
			"empty value that makes it use its production default", spy.seen[0])
	}
}
