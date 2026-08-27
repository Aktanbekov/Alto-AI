package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"altoai_mvp/internal/handlers"

	"github.com/gin-gonic/gin"
)

// serve runs one GET through a real router, so gin finalises the status the way
// it does in production. A bare gin.CreateTestContext never flushes a bodyless
// c.Status(), which would make the 304 below look like a 200.
func serve(h *handlers.CachedJSONHandler, header, value string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/v1/questions", h.Get)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/questions", nil)
	if header != "" {
		req.Header.Set(header, value)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestQuestionBankServesTheCorpusFile(t *testing.T) {
	// The bank the test rounds are drawn from, as shipped.
	path := filepath.Join("..", "visa-llm", "web", "data", "questions.json")
	if _, err := os.Stat(path); err != nil {
		t.Skipf("question bank not present: %v", err)
	}
	t.Setenv("QUESTIONS_PATH", path)

	h := handlers.NewQuestionsHandler()
	w := serve(h, "", "")

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var entries []struct {
		QuestionType      string   `json:"question_type"`
		ShareOfInterviews float64  `json:"share_of_interviews"`
		Examples          []string `json:"examples"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &entries); err != nil {
		t.Fatalf("body is not the expected array: %v", err)
	}
	if len(entries) < 3 {
		t.Fatalf("need at least one round of questions, got %d entries", len(entries))
	}

	// The frontend takes examples[0] as the phrasing and orders rounds by the
	// file's own order, so both have to hold for the first round to make sense.
	for i, e := range entries[:3] {
		if len(e.Examples) == 0 {
			t.Errorf("entry %d (%s) has no example phrasing", i, e.QuestionType)
		}
		if e.ShareOfInterviews <= 0 {
			t.Errorf("entry %d (%s) has no asked-in share", i, e.QuestionType)
		}
	}
	if entries[0].ShareOfInterviews < entries[len(entries)-1].ShareOfInterviews {
		t.Error("bank is not ordered most-asked first; round 1 would not be the common questions")
	}

	// A matching ETag must short-circuit: the file is static across rounds.
	etag := w.Header().Get("ETag")
	if etag == "" {
		t.Fatal("no ETag set")
	}
	if again := serve(h, "If-None-Match", etag); again.Code != http.StatusNotModified {
		t.Errorf("expected 304 for matching ETag, got %d", again.Code)
	}
}

func TestMissingFileIsAReadable503(t *testing.T) {
	t.Setenv("QUESTIONS_PATH", filepath.Join(t.TempDir(), "absent.json"))

	w := serve(handlers.NewQuestionsHandler(), "", "")
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}
	// The frontend falls back to its seed questions on any failure; the message
	// exists for whoever reads the logs.
	if body := w.Body.String(); body == "" {
		t.Error("expected an error message in the body")
	}
}
