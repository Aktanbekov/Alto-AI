package tests

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"altoai_mvp/internal/handlers"
	"altoai_mvp/internal/repository"

	"github.com/gin-gonic/gin"
)

// adminGet runs one admin analytics request through a real router and returns
// the decoded `data` envelope.
func adminGet(t *testing.T, h *handlers.AdminAnalyticsHandler, route, path string,
	bind func(*gin.Engine)) map[string]any {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	bind(r)
	_ = route

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
	if w.Code != http.StatusOK {
		t.Fatalf("%s returned %d: %s", path, w.Code, w.Body.String())
	}
	var env struct {
		Data map[string]any `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode %s: %v (body %s)", path, err, w.Body.String())
	}
	if env.Data == nil {
		// Some responses are unwrapped; fall back to the raw body.
		var raw map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &raw)
		return raw
	}
	return env.Data
}

// seedFunnel writes a known cohort: 4 visitors land, 3 start, 2 complete,
// 2 get a report. The numbers below are asserted exactly.
func seedFunnel(t *testing.T, repo repository.AnalyticsRepo, src string) {
	t.Helper()
	now := time.Now().UTC()
	mk := func(v, name string, props map[string]any) repository.Event {
		return repository.Event{
			Name: name, VisitorID: v, SessionID: "s", Src: src,
			Timestamp: now, IsMobile: v == "m1", Props: props,
		}
	}
	evs := []repository.Event{
		mk("v1", "page_view", nil), mk("v2", "page_view", nil),
		mk("v3", "page_view", nil), mk("m1", "page_view", nil),
		mk("v1", "form_start", nil), mk("v2", "form_start", nil), mk("m1", "form_start", nil),
		mk("v1", "form_complete", map[string]any{"consulate": "Bishkek", "country": "Kyrgyzstan"}),
		mk("v2", "form_complete", map[string]any{"consulate": "Chennai", "country": "India"}),
		mk("v1", "report_generated", map[string]any{
			"latency_ms": 8200, "input_tokens": 9800, "output_tokens": 6100,
			"cost_usd": 0.2015, "readiness_band": "moderate", "flag_count": 4}),
		mk("v2", "report_generated", map[string]any{
			"latency_ms": 7400, "input_tokens": 9600, "output_tokens": 5900,
			"cost_usd": 0.1955, "readiness_band": "needs_work", "flag_count": 5}),
		mk("v1", "report_view", nil), mk("v2", "report_view", nil),
	}
	if err := repo.Insert(evs); err != nil {
		t.Fatalf("seed: %v", err)
	}
}

func TestFunnelScreenCountsAndConversions(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()

	src := fmt.Sprintf("admin-funnel-%d", os.Getpid())
	t.Cleanup(func() { _, _ = db.Exec(`DELETE FROM analytics_events WHERE src = $1`, src) })

	repo := repository.NewAnalyticsRepo(db)
	seedFunnel(t, repo, src)

	h := handlers.NewAdminAnalyticsHandler(repo, nil)
	data := adminGet(t, h, "funnel", "/f?src="+src, func(r *gin.Engine) {
		r.GET("/f", h.Funnel)
	})

	steps, _ := data["steps"].([]any)
	if len(steps) == 0 {
		t.Fatal("no funnel steps returned")
	}
	want := map[string]float64{
		"page_view": 4, "form_start": 3, "form_complete": 2,
		"report_generated": 2, "report_view": 2,
	}
	for _, raw := range steps {
		s := raw.(map[string]any)
		name := s["name"].(string)
		if expect, ok := want[name]; ok {
			if got := s["visitors"].(float64); got != expect {
				t.Errorf("step %s: want %v visitors, got %v", name, expect, got)
			}
		}
		// Nobody fired cta_click in this cohort. form_start must still report
		// 3 of 4 against page_view rather than 0% against an empty step.
		if name == "form_start" {
			if c := s["from_prev"].(float64); c < 0.74 || c > 0.76 {
				t.Errorf("form_start conversion should be 0.75, got %v", c)
			}
			if s["prev_name"] != "page_view" {
				t.Errorf("form_start should measure against page_view, got %v", s["prev_name"])
			}
		}
	}

	// The mobile/desktop split must not be a single blended ratio.
	mob := data["mobile_completion"].(map[string]any)
	if mob["visitors"].(float64) != 1 {
		t.Errorf("expected 1 mobile visitor, got %v", mob["visitors"])
	}
}

func TestReportQualitySummarisesCostAndLatency(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()

	src := fmt.Sprintf("admin-quality-%d", os.Getpid())
	t.Cleanup(func() { _, _ = db.Exec(`DELETE FROM analytics_events WHERE src = $1`, src) })

	repo := repository.NewAnalyticsRepo(db)
	seedFunnel(t, repo, src)

	h := handlers.NewAdminAnalyticsHandler(repo, nil)
	data := adminGet(t, h, "quality", "/q?src="+src, func(r *gin.Engine) {
		r.GET("/q", h.ReportQuality)
	})

	if got := data["reports"].(float64); got != 2 {
		t.Errorf("expected 2 reports, got %v", got)
	}
	latency := data["latency_ms"].(map[string]any)
	if med := latency["median"].(float64); med != 7800 {
		t.Errorf("median latency of 8200 and 7400 should be 7800, got %v", med)
	}
	cost := data["cost_usd"].(map[string]any)
	if sum := cost["sum"].(float64); sum < 0.396 || sum > 0.398 {
		t.Errorf("expected total cost ~0.397, got %v", sum)
	}
	readiness := data["readiness"].(map[string]any)
	if readiness["moderate"].(float64) != 1 || readiness["needs_work"].(float64) != 1 {
		t.Errorf("readiness distribution wrong: %v", readiness)
	}
	// The un-built features must be labelled, not shown as a bare zero.
	notWired := data["not_yet_instrumented"].(map[string]any)
	if _, ok := notWired["locked_flag_click"]; !ok {
		t.Error("locked_flag_click should be labelled as not yet instrumented")
	}
}

func TestCoverageGapsRanksUncoveredConsulatesFirst(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()

	src := fmt.Sprintf("admin-coverage-%d", os.Getpid())
	t.Cleanup(func() { _, _ = db.Exec(`DELETE FROM analytics_events WHERE src = $1`, src) })

	repo := repository.NewAnalyticsRepo(db)
	seedFunnel(t, repo, src)

	t.Setenv("STATS_PATH", filepath.Join("..", "visa-llm", "web", "data", "stats.json"))
	h := handlers.NewAdminAnalyticsHandler(repo, nil)
	data := adminGet(t, h, "coverage", "/c?src="+src, func(r *gin.Engine) {
		r.GET("/c", h.CoverageGaps)
	})

	cities, _ := data["cities"].([]any)
	if len(cities) < 2 {
		t.Fatalf("expected both requested consulates, got %v", cities)
	}
	// Bishkek has no corpus records; Chennai has thousands. The gap has to lead.
	first := cities[0].(map[string]any)
	if first["name"] != "Bishkek" {
		t.Errorf("uncovered consulate should sort first, got %v", first["name"])
	}
	if first["covered"].(bool) {
		t.Error("Bishkek should be reported as uncovered")
	}
	for _, raw := range cities {
		row := raw.(map[string]any)
		if row["name"] == "Chennai" && row["corpus_n"].(float64) <= 0 {
			t.Error("Chennai should show its corpus records")
		}
	}
}
