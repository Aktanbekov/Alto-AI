package tests

import (
	"database/sql"
	"testing"
	"time"

	"altoai_mvp/internal/repository"
)

// Tracking links: the admin panel builds a ?src= link, the analytics stream
// already carries that tag, and SourceStats reads the two back together.
//
// The invariant worth protecting here is that the link row and the traffic are
// independent. A link can be deleted, renamed, or created after the fact
// without touching a single event, because the events only ever carried the
// code. Every test below leans on that in some way.

// resetSource clears everything a previous run of the same test left behind.
// The suite runs against a shared, long-lived database, so a test that only
// appends is a test that reports different numbers the second time it runs.
func resetSource(t *testing.T, db *sql.DB, prefix string) {
	t.Helper()
	if _, err := db.Exec(`DELETE FROM analytics_events WHERE src LIKE $1 OR visitor_id LIKE $1`,
		prefix+"%"); err != nil {
		t.Fatalf("reset events: %v", err)
	}
	// Insert back-fills user_id from this table, so a stale identity row would
	// silently attribute the next run's events to an old user.
	if _, err := db.Exec(`DELETE FROM analytics_identities WHERE visitor_id LIKE $1`,
		prefix+"%"); err != nil {
		t.Fatalf("reset identities: %v", err)
	}
}

func seedSource(t *testing.T, db *sql.DB, events repository.AnalyticsRepo, prefix string) {
	t.Helper()
	resetSource(t, db, prefix)
	now := nowUTC()
	code := prefix + "-reddit"
	err := events.Insert([]repository.Event{
		// One visitor who goes the whole way, twice-counted page view included.
		{Name: "page_view", VisitorID: prefix + "v1", SessionID: prefix + "s1", Timestamp: now, Src: code},
		{Name: "page_view", VisitorID: prefix + "v1", SessionID: prefix + "s1", Timestamp: now, Src: code},
		{Name: "form_start", VisitorID: prefix + "v1", SessionID: prefix + "s1", Timestamp: now, Src: code},
		{Name: "form_complete", VisitorID: prefix + "v1", SessionID: prefix + "s1", Timestamp: now, Src: code},
		{Name: "report_generated", VisitorID: prefix + "v1", SessionID: prefix + "s1", Timestamp: now, Src: code},
		// One who bounces.
		{Name: "page_view", VisitorID: prefix + "v2", SessionID: prefix + "s2", Timestamp: now, Src: code},
		// A tag with no link row behind it.
		{Name: "page_view", VisitorID: prefix + "v3", SessionID: prefix + "s3", Timestamp: now, Src: prefix + "-twitter"},
	})
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
}

func statsBySrc(t *testing.T, events repository.AnalyticsRepo) map[string]repository.SourceStat {
	t.Helper()
	rows, err := events.SourceStats(time.Time{}, time.Time{})
	if err != nil {
		t.Fatalf("SourceStats: %v", err)
	}
	out := map[string]repository.SourceStat{}
	for _, r := range rows {
		out[r.Src] = r
	}
	return out
}

func TestSourceStatsCountsPeopleNotEvents(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	events := repository.NewAnalyticsRepo(db)

	prefix := "tls1"
	seedSource(t, db, events, prefix)
	if _, err := events.Identify(prefix+"v1", prefix+"-user"); err != nil {
		t.Fatalf("identify: %v", err)
	}

	got := statsBySrc(t, events)[prefix+"-reddit"]

	// Two people arrived, one of whom loaded the page twice. Page views is the
	// only column that counts visits; everything else counts people.
	if got.Visitors != 2 {
		t.Errorf("visitors = %d, want 2", got.Visitors)
	}
	if got.PageViews != 3 {
		t.Errorf("page views = %d, want 3", got.PageViews)
	}
	if got.FormStarts != 1 || got.FormCompletes != 1 || got.Reports != 1 {
		t.Errorf("funnel = %d/%d/%d, want 1/1/1",
			got.FormStarts, got.FormCompletes, got.Reports)
	}
	if got.Signups != 1 {
		t.Errorf("signups = %d, want 1", got.Signups)
	}
	if got.FirstSeen.IsZero() || got.LastSeen.IsZero() {
		t.Errorf("first/last seen unset: %v / %v", got.FirstSeen, got.LastSeen)
	}
}

func TestSourceStatsKeepsUntrackedAndUntaggedTraffic(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	events := repository.NewAnalyticsRepo(db)

	prefix := "tls2"
	seedSource(t, db, events, prefix)
	// Someone who arrived with no tag at all: the baseline every link is worth
	// comparing against, so it must not be dropped.
	if err := events.Insert([]repository.Event{
		{Name: "page_view", VisitorID: prefix + "v9", SessionID: prefix + "s9", Timestamp: nowUTC()},
	}); err != nil {
		t.Fatalf("insert untagged: %v", err)
	}

	got := statsBySrc(t, events)
	if got[prefix+"-twitter"].Visitors != 1 {
		t.Errorf("a tag with no link row must still be reported, got %+v", got[prefix+"-twitter"])
	}
	if got[""].Visitors < 1 {
		t.Errorf("untagged visitors must be bucketed under \"\", got %+v", got[""])
	}
}

func TestSourceStatsRespectsDateWindow(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	events := repository.NewAnalyticsRepo(db)

	prefix := "tls3"
	seedSource(t, db, events, prefix)

	from := nowUTC().Add(48 * time.Hour)
	rows, err := events.SourceStats(from, from.Add(time.Hour))
	if err != nil {
		t.Fatalf("SourceStats: %v", err)
	}
	if len(rows) != 0 {
		t.Errorf("a window after all traffic should be empty, got %d rows", len(rows))
	}
}

func TestReferralLinkLifecycle(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	if err := repository.EnsureReferralSchema(db); err != nil {
		t.Fatalf("schema: %v", err)
	}
	// Restarts re-run this; it must not fail the second time.
	if err := repository.EnsureReferralSchema(db); err != nil {
		t.Fatalf("schema rerun: %v", err)
	}

	links := repository.NewReferralRepo(db)
	code := "tls4-reddit"
	_ = links.Delete(code)
	_ = links.Delete("tls4-youtube")

	made, err := links.Create(repository.ReferralLink{
		Code: code, Label: "Reddit", Destination: "/", Notes: "aug post",
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if made.Code != code || made.Destination != "/" || made.Archived {
		t.Fatalf("unexpected row: %+v", made)
	}
	defer func() { _ = links.Delete(code) }()

	// Two links sharing a code would merge into one unseparable source.
	if _, err := links.Create(repository.ReferralLink{Code: code}); err != repository.ErrLinkExists {
		t.Errorf("duplicate code = %v, want ErrLinkExists", err)
	}

	if _, err := links.Update(code, repository.ReferralLink{
		Label: "Reddit (renamed)", Destination: "/check",
	}); err != nil {
		t.Fatalf("update: %v", err)
	}
	got, err := links.Get(code)
	if err != nil || got.Label != "Reddit (renamed)" || got.Destination != "/check" {
		t.Errorf("update did not stick: %+v (%v)", got, err)
	}
	if _, err := links.Update("tls4-missing", repository.ReferralLink{Destination: "/"}); err != repository.ErrLinkNotFound {
		t.Errorf("update of a missing code = %v, want ErrLinkNotFound", err)
	}
	if _, err := links.Get("tls4-missing"); err != repository.ErrLinkNotFound {
		t.Errorf("get of a missing code = %v, want ErrLinkNotFound", err)
	}

	if _, err := links.Create(repository.ReferralLink{Code: "tls4-youtube", Destination: "/"}); err != nil {
		t.Fatalf("create 2: %v", err)
	}
	defer func() { _ = links.Delete("tls4-youtube") }()

	if err := links.Archive("tls4-youtube", true); err != nil {
		t.Fatalf("archive: %v", err)
	}
	active, err := links.List(false)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	for _, l := range active {
		if l.Code == "tls4-youtube" {
			t.Error("an archived link must not appear in the default list")
		}
	}
	all, err := links.List(true)
	if err != nil {
		t.Fatalf("list archived: %v", err)
	}
	var seen bool
	for _, l := range all {
		if l.Code == "tls4-youtube" {
			seen = true
		}
	}
	if !seen {
		t.Error("an archived link must appear when archived links are requested")
	}
	if err := links.Archive("tls4-missing", true); err != repository.ErrLinkNotFound {
		t.Errorf("archive of a missing code = %v, want ErrLinkNotFound", err)
	}
}

// Deleting a link drops its name, never its numbers. The source comes back in
// the panel as untracked, which is the whole reason SourceStats reads the event
// table rather than joining through referral_links.
func TestDeletingALinkKeepsItsTraffic(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	if err := repository.EnsureReferralSchema(db); err != nil {
		t.Fatalf("schema: %v", err)
	}
	links := repository.NewReferralRepo(db)
	events := repository.NewAnalyticsRepo(db)

	prefix := "tls5"
	code := prefix + "-reddit"
	_ = links.Delete(code)
	if _, err := links.Create(repository.ReferralLink{Code: code, Destination: "/"}); err != nil {
		t.Fatalf("create: %v", err)
	}
	seedSource(t, db, events, prefix)

	if err := links.Delete(code); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if err := links.Delete(code); err != repository.ErrLinkNotFound {
		t.Errorf("second delete = %v, want ErrLinkNotFound", err)
	}
	if got := statsBySrc(t, events)[code]; got.Visitors != 2 {
		t.Errorf("traffic after delete = %+v, want 2 visitors", got)
	}
}

func TestNormalizeLinkCode(t *testing.T) {
	ok := map[string]string{
		"reddit":     "reddit",
		"  Reddit  ": "reddit",
		"Reddit AMA": "reddit-ama", // inner whitespace becomes a dash
		"yt_oct-26":  "yt_oct-26",
		"2026":       "2026",
	}
	for in, want := range ok {
		got, err := repository.NormalizeLinkCode(in)
		if err != nil || got != want {
			t.Errorf("NormalizeLinkCode(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, bad := range []string{"", "   ", "-leading", "_leading", "has.dot", "emoji🙂", "a/b"} {
		if got, err := repository.NormalizeLinkCode(bad); err == nil {
			t.Errorf("NormalizeLinkCode(%q) should be rejected, got %q", bad, got)
		}
	}
}

// The destination is pasted into the link the panel hands out, so a stored row
// must not be able to point visitors off this site.
func TestNormalizeDestinationStaysOnSite(t *testing.T) {
	if got, err := repository.NormalizeDestination(""); err != nil || got != "/" {
		t.Errorf("empty destination = %q, %v; want /", got, err)
	}
	if got, err := repository.NormalizeDestination("  /check  "); err != nil || got != "/check" {
		t.Errorf("/check = %q, %v", got, err)
	}
	for _, bad := range []string{
		"https://evil.example", "//evil.example", "check", "/a?b=c", "/a#b", "/a b",
	} {
		if got, err := repository.NormalizeDestination(bad); err == nil {
			t.Errorf("NormalizeDestination(%q) should be rejected, got %q", bad, got)
		}
	}
}
