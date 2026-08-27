package tests

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"altoai_mvp/internal/handlers"
	"altoai_mvp/internal/repository"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

func nowUTC() time.Time { return time.Now().UTC() }

// openTestDB connects to the configured Postgres, skipping when there isn't one
// (CI without a database should not fail the suite).
func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	host, port := env("POSTGRES_HOST", "localhost"), env("POSTGRES_PORT", "5432")
	conn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		host, port, env("POSTGRES_USER", ""), env("POSTGRES_PASSWORD", ""), env("POSTGRES_DB", ""))
	db, err := sql.Open("postgres", conn)
	if err != nil {
		t.Skipf("no database: %v", err)
	}
	if err := db.Ping(); err != nil {
		t.Skipf("database unreachable: %v", err)
	}
	if err := repository.EnsureAnalyticsSchema(db); err != nil {
		t.Fatalf("schema: %v", err)
	}
	return db
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func postEvents(t *testing.T, repo repository.AnalyticsRepo, body string) int {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/v1/events", handlers.NewAnalyticsHandler(repo, nil).Ingest)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/events", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Code
}

func TestIngestStoresEventsAndStripsPrivateFields(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()

	visitor := "test-visitor-" + fmt.Sprint(os.Getpid())
	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM analytics_events WHERE visitor_id = $1`, visitor)
	})
	repo := repository.NewAnalyticsRepo(db)

	// A client sending exactly what the privacy rules forbid.
	body := fmt.Sprintf(`{
	  "visitor_id": %q, "session_id": "s1", "src": "tg_bishkek", "lang": "en", "is_mobile": true,
	  "events": [
	    {"name":"page_view","path":"/","props":{"referrer":"t.me"}},
	    {"name":"form_complete","props":{
	       "consulate":"Bishkek","degree_level":"Bachelor","gpa_band":"3.0-3.3",
	       "gpa":"3.15","plan_text":"I will return home to work at my father's firm",
	       "email":"someone@example.com","sponsor":"father, real estate",
	       "flags":["thin_funding","weak_ties"]}},
	    {"name":"totally_made_up_event","props":{}}
	  ]}`, visitor)

	if code := postEvents(t, repo, body); code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", code)
	}

	rows, err := repo.Query(repository.EventQuery{Src: "tg_bishkek", Limit: 50})
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	var mine []repository.EventRow
	for _, r := range rows {
		if r.VisitorID == visitor {
			mine = append(mine, r)
		}
	}
	if len(mine) != 2 {
		t.Fatalf("expected 2 stored events (unknown name dropped), got %d", len(mine))
	}

	for _, r := range mine {
		if r.Name == "totally_made_up_event" {
			t.Error("an unknown event name was stored")
		}
		blob, _ := json.Marshal(r.Props)
		for _, banned := range []string{"3.15", "father's firm", "someone@example.com", "real estate"} {
			if strings.Contains(string(blob), banned) {
				t.Errorf("private value %q reached storage: %s", banned, blob)
			}
		}
		if r.Name == "form_complete" {
			if r.Props["gpa_band"] != "3.0-3.3" {
				t.Errorf("banded gpa should survive, got %v", r.Props["gpa_band"])
			}
			if _, ok := r.Props["flags"]; !ok {
				t.Error("flag list should survive")
			}
		}
	}
}

func TestRawGpaBandIsRejected(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()

	visitor := "test-rawgpa-" + fmt.Sprint(os.Getpid())
	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM analytics_events WHERE visitor_id = $1`, visitor)
	})
	repo := repository.NewAnalyticsRepo(db)

	// A bare number in gpa_band is a raw value wearing the right label.
	body := fmt.Sprintf(`{"visitor_id":%q,"session_id":"s1","src":"rawgpa",
	  "events":[{"name":"form_complete","props":{"gpa_band":"3.15"}}]}`, visitor)
	postEvents(t, repo, body)

	rows, _ := repo.Query(repository.EventQuery{Src: "rawgpa", Limit: 10})
	for _, r := range rows {
		if r.VisitorID != visitor {
			continue
		}
		if v, ok := r.Props["gpa_band"]; ok {
			t.Errorf("raw value passed as a band was stored: %v", v)
		}
	}
}

func TestIngestNeverErrorsTheClient(t *testing.T) {
	repo := repository.NewAnalyticsRepo(nil) // a broken repo: nil DB
	for _, body := range []string{`not json at all`, `{}`, `{"visitor_id":"v","events":[]}`} {
		if code := postEvents(t, repo, body); code != http.StatusNoContent {
			t.Errorf("body %q returned %d; tracking must never surface an error", body, code)
		}
	}
}

func TestFunnelCountsDistinctVisitors(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()

	src := "funnel-test-" + fmt.Sprint(os.Getpid())
	t.Cleanup(func() { _, _ = db.Exec(`DELETE FROM analytics_events WHERE src = $1`, src) })
	repo := repository.NewAnalyticsRepo(db)

	// Three visitors land, two start the form, one finishes. Visitor A fires
	// page_view twice — a funnel counts people, not events.
	var evs []repository.Event
	mk := func(v, name string) repository.Event {
		return repository.Event{Name: name, VisitorID: v, SessionID: "s", Src: src,
			Timestamp: nowUTC()}
	}
	evs = append(evs, mk("a", "page_view"), mk("a", "page_view"), mk("b", "page_view"), mk("c", "page_view"))
	evs = append(evs, mk("a", "form_start"), mk("b", "form_start"))
	evs = append(evs, mk("a", "form_complete"))
	if err := repo.Insert(evs); err != nil {
		t.Fatalf("insert: %v", err)
	}

	steps, err := repo.FunnelCounts(repository.EventQuery{Src: src},
		[]string{"page_view", "form_start", "form_complete"})
	if err != nil {
		t.Fatalf("funnel: %v", err)
	}
	want := []int{3, 2, 1}
	for i, s := range steps {
		if s.Visitors != want[i] {
			t.Errorf("step %s: want %d visitors, got %d", s.Name, want[i], s.Visitors)
		}
	}
	if steps[1].FromPrev < 0.66 || steps[1].FromPrev > 0.67 {
		t.Errorf("form_start conversion should be 2/3, got %.3f", steps[1].FromPrev)
	}
}
