package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"altoai_mvp/internal/handlers"
	"altoai_mvp/internal/visallm"

	"github.com/gin-gonic/gin"
)

// The sidecar's real 402 text. A student must never see any of this.
const billingDetail = "The Anthropic account has no credits. Add credits in the " +
	"console under Plans & Billing, then try again."

// evaluateAgainst stands up the handler pointed at a stub sidecar returning the
// given status and detail, and posts one valid profile through it.
func evaluateAgainst(t *testing.T, status int, detail string) (*httptest.ResponseRecorder, *visallm.IncidentLog) {
	t.Helper()

	sidecar := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"detail": detail})
	}))
	t.Cleanup(sidecar.Close)

	incidents := visallm.NewIncidentLog()
	// nil repos: this test is about what the student is told, and the storage
	// path is never reached on a failure.
	h := handlers.NewEvaluateHandler(
		&visallm.Client{BaseURL: sidecar.URL, HTTP: sidecar.Client()}, nil, incidents, nil, nil)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/v1/evaluate", h.Evaluate)

	body := `{"planned_answers":[{"question":"Who is sponsoring you?","answer":"My father."}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/evaluate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w, incidents
}

func TestOutOfCreditIsHiddenFromTheStudent(t *testing.T) {
	w, incidents := evaluateAgainst(t, http.StatusPaymentRequired, billingDetail)

	seen := w.Body.String()
	for _, leak := range []string{"credit", "Credits", "Billing", "console", "Anthropic"} {
		if strings.Contains(seen, leak) {
			t.Errorf("student response leaks %q: %s", leak, seen)
		}
	}
	if !strings.Contains(seen, "temporarily unavailable") {
		t.Errorf("expected the neutral message, got: %s", seen)
	}
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", w.Code)
	}

	// The real cause has to reach the admin panel, or hiding it loses it.
	items, totals, _ := incidents.Snapshot()
	if len(items) != 1 {
		t.Fatalf("expected 1 recorded incident, got %d", len(items))
	}
	if items[0].Kind != "billing" {
		t.Errorf("expected kind billing, got %q", items[0].Kind)
	}
	if items[0].Detail != billingDetail {
		t.Errorf("admin lost the real detail: %q", items[0].Detail)
	}
	if totals["billing"] != 1 {
		t.Errorf("expected billing total 1, got %d", totals["billing"])
	}
}

func TestRejectedKeyIsAlsoHidden(t *testing.T) {
	w, incidents := evaluateAgainst(t, http.StatusUnauthorized,
		"The API key was rejected. Check ANTHROPIC_API_KEY.")

	if strings.Contains(w.Body.String(), "ANTHROPIC_API_KEY") {
		t.Errorf("student response leaks the key name: %s", w.Body.String())
	}
	items, _, _ := incidents.Snapshot()
	if len(items) != 1 || items[0].Kind != "credentials" {
		t.Fatalf("expected one credentials incident, got %+v", items)
	}
}

func TestIncidentLogIsBounded(t *testing.T) {
	l := visallm.NewIncidentLog()
	for i := 0; i < 120; i++ {
		l.Record(visallm.Incident{Kind: "billing", Detail: "x"})
	}
	items, totals, _ := l.Snapshot()
	if len(items) > 50 {
		t.Errorf("log grew unbounded: %d entries", len(items))
	}
	// Totals count every failure, not just the ones still in the window.
	if totals["billing"] != 120 {
		t.Errorf("expected 120 counted, got %d", totals["billing"])
	}
}
