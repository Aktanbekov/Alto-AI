package repository

import (
	"strings"
	"testing"
	"time"
)

// Every write that fills a jsonb column, run through the connection string
// production uses (testDB goes through postgresConnectionString, so it carries
// binary_parameters=yes). Passing a []byte there sends binary jsonb and fails
// with "pq: unsupported jsonb version number 123"; that silently dropped every
// analytics event and saved report until these values were sent as text.

func TestConnectionUnderTestIsPoolerSafe(t *testing.T) {
	db := testDB(t)
	_ = db
	dsn, err := postgresConnectionString()
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(dsn, "binary_parameters=yes") {
		t.Fatal("tests must run with the production connection setting")
	}
}

func TestAnalyticsInsertStoresProps(t *testing.T) {
	db := testDB(t)
	repo := NewAnalyticsRepo(db)
	err := repo.Insert([]Event{
		{Name: "page_view", VisitorID: "v1", SessionID: "s1", Timestamp: time.Now().UTC(),
			Props: map[string]any{"page": "/pricing", "n": 2}},
		{Name: "page_view", VisitorID: "v1", SessionID: "s1", Timestamp: time.Now().UTC()},
	})
	if err != nil {
		t.Fatalf("Insert: %v", err)
	}
	var page string
	if err := db.QueryRow(`SELECT props->>'page' FROM analytics_events WHERE props ? 'page'`).Scan(&page); err != nil {
		t.Fatalf("read back: %v", err)
	}
	if page != "/pricing" {
		t.Fatalf("props page = %q", page)
	}
}

func TestEvaluationSaveStoresReport(t *testing.T) {
	db := testDB(t)
	repo := NewEvaluationRepo(db)
	id, err := repo.Save(StoredEvaluation{
		VisitorID: "v1",
		Profile:   map[string]any{"consulate_city": "Bishkek"},
		Answers:   []any{map[string]any{"question": "Why this university?", "answer": "Its CS lab."}},
		Report:    map[string]any{"results": []any{map[string]any{"readiness": "medium"}}},
		Model:     "claude-opus-5",
	})
	if err != nil {
		t.Fatalf("Save: %v", err)
	}
	got, err := repo.Get(id)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Profile["consulate_city"] != "Bishkek" || len(got.Answers) != 1 || got.Report["results"] == nil {
		t.Fatalf("round trip lost data: %+v", got)
	}
}

func TestSurveySaveStoresMethods(t *testing.T) {
	db := testDB(t)
	repo := NewValidationRepo(db)
	if _, err := repo.SaveSurvey(SurveyResponse{
		Subject:     Subject{VisitorID: "v1"},
		PrepMethods: []string{"youtube", "friends"},
	}); err != nil {
		t.Fatalf("SaveSurvey: %v", err)
	}
	var n int
	if err := db.QueryRow(`SELECT jsonb_array_length(prep_methods) FROM validation_surveys`).Scan(&n); err != nil {
		t.Fatalf("read back: %v", err)
	}
	if n != 2 {
		t.Fatalf("prep_methods length = %d, want 2", n)
	}
}
