package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// AnalyticsRepo stores the product event stream.
//
// Shape: one wide table with the fields every event carries as typed columns,
// and everything event-specific in a JSONB `props` blob. Per-event tables would
// mean a migration for every new event, and the filters that matter here —
// src, date, consulate, degree level, device — are all common columns, so they
// index cleanly while the varying half stays schemaless.
//
// PRIVACY: this table must never receive free text the user wrote about
// themselves, their sponsor, their finances, or their answers, and never a name
// or email. Those live on the user record. GPA arrives banded ("3.0-3.3"),
// never raw. Ingest enforces this; see analytics_handler.go.
type AnalyticsRepo interface {
	Insert(events []Event) error
	Identify(visitorID, userID string) (int64, error)
	DeleteForUser(userID string) (int64, error)
	Query(q EventQuery) ([]EventRow, error)
	CountBy(q EventQuery, dimension string) (map[string]int, error)
	FunnelCounts(q EventQuery, steps []string) ([]FunnelStep, error)
	NumericStat(q EventQuery, name, prop string) (NumericSummary, error)
}

// Event is one captured event on its way into storage.
type Event struct {
	Name      string         `json:"name"`
	VisitorID string         `json:"visitor_id"`
	SessionID string         `json:"session_id"`
	UserID    string         `json:"user_id,omitempty"`
	Timestamp time.Time      `json:"timestamp"`
	Src       string         `json:"src,omitempty"`
	Path      string         `json:"path,omitempty"`
	Lang      string         `json:"lang,omitempty"`
	IsMobile  bool           `json:"is_mobile"`
	Props     map[string]any `json:"props,omitempty"`
}

// EventRow is a stored event read back out.
type EventRow struct {
	ID        int64          `json:"id"`
	Name      string         `json:"name"`
	VisitorID string         `json:"visitor_id"`
	SessionID string         `json:"session_id"`
	UserID    string         `json:"user_id,omitempty"`
	Timestamp time.Time      `json:"timestamp"`
	Src       string         `json:"src,omitempty"`
	Path      string         `json:"path,omitempty"`
	Lang      string         `json:"lang,omitempty"`
	IsMobile  bool           `json:"is_mobile"`
	Props     map[string]any `json:"props,omitempty"`
}

// EventQuery is the filter set every panel screen shares. Zero values mean
// "no filter", so a bare EventQuery reads everything.
type EventQuery struct {
	Names       []string
	Src         string
	From        time.Time
	To          time.Time
	Consulate   string
	DegreeLevel string
	Device      string // "mobile" | "desktop" | ""
	Limit       int
}

// FunnelStep is one rung of a conversion chain.
type FunnelStep struct {
	Name     string  `json:"name"`
	Visitors int     `json:"visitors"`
	FromPrev float64 `json:"from_prev"` // conversion from PrevName, 0-1
	FromTop  float64 `json:"from_top"`  // conversion from the first step, 0-1
	// PrevName is the step FromPrev is measured against. It is not always the
	// immediately preceding one: an optional step nobody fires (cta_click, for
	// someone who went straight to the form) would otherwise make every step
	// below it read as 0% conversion.
	PrevName string `json:"prev_name,omitempty"`
}

// NumericSummary describes one numeric property across matching events.
type NumericSummary struct {
	N      int     `json:"n"`
	Median float64 `json:"median"`
	Mean   float64 `json:"mean"`
	P90    float64 `json:"p90"`
	Sum    float64 `json:"sum"`
}

type analyticsRepo struct{ db *sql.DB }

func NewAnalyticsRepo(db *sql.DB) AnalyticsRepo { return &analyticsRepo{db: db} }

// EnsureAnalyticsSchema creates the event table and its indexes.
//
// Follows the same create-if-not-exists convention as the users table rather
// than introducing a migration tool for one table.
func EnsureAnalyticsSchema(db *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS analytics_events (
			id           BIGSERIAL PRIMARY KEY,
			name         VARCHAR(64)  NOT NULL,
			visitor_id   VARCHAR(36)  NOT NULL,
			session_id   VARCHAR(36)  NOT NULL,
			user_id      VARCHAR(36),
			ts           TIMESTAMPTZ  NOT NULL,
			src          VARCHAR(64),
			path         VARCHAR(255),
			lang         VARCHAR(16),
			is_mobile    BOOLEAN      NOT NULL DEFAULT FALSE,
			consulate    VARCHAR(64),
			degree_level VARCHAR(32),
			props        JSONB        NOT NULL DEFAULT '{}'::jsonb,
			created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
		// Every screen slices by event name over a date range; that pair leads.
		`CREATE INDEX IF NOT EXISTS idx_analytics_name_ts ON analytics_events (name, ts DESC)`,
		// Funnels count distinct visitors per step.
		`CREATE INDEX IF NOT EXISTS idx_analytics_visitor ON analytics_events (visitor_id)`,
		// "Friends vs strangers" is the filter applied to nearly every view.
		`CREATE INDEX IF NOT EXISTS idx_analytics_src ON analytics_events (src)`,
		// Backfill on identify, and the deletion path, both go by user.
		`CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events (user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_analytics_props ON analytics_events USING GIN (props)`,
		// Maps a visitor to the user they became, so events captured before
		// signup can be attributed afterwards.
		`CREATE TABLE IF NOT EXISTS analytics_identities (
			visitor_id VARCHAR(36) PRIMARY KEY,
			user_id    VARCHAR(36) NOT NULL,
			linked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_identities_user ON analytics_identities (user_id)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return fmt.Errorf("analytics schema: %w", err)
		}
	}
	return nil
}

// consulate and degree_level are promoted out of props into columns because the
// spec requires filtering every funnel by them; the rest stays in JSONB.
func promoted(e Event) (string, string) {
	str := func(k string) string {
		if v, ok := e.Props[k]; ok {
			if s, ok := v.(string); ok {
				return s
			}
		}
		return ""
	}
	return str("consulate"), str("degree_level")
}

// Insert writes a batch in one statement. Batches arrive from the client on an
// interval, so this is the hot path.
func (r *analyticsRepo) Insert(events []Event) error {
	if len(events) == 0 {
		return nil
	}
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	// user_id falls back to whatever this visitor was linked to, so events that
	// arrive after a signup are attributed without the client resending an id.
	// The casts are required: $2 appears in two type contexts and $4 arrives
	// untyped when the caller has no user, which Postgres cannot deduce alone.
	stmt, err := tx.Prepare(`
		INSERT INTO analytics_events
			(name, visitor_id, session_id, user_id, ts, src, path, lang, is_mobile,
			 consulate, degree_level, props)
		VALUES ($1,$2,$3,
		        COALESCE($4::varchar,
		                 (SELECT user_id FROM analytics_identities WHERE visitor_id = $2::varchar)),
		        $5,$6,$7,$8,$9,$10,$11,$12)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, e := range events {
		props, err := json.Marshal(e.Props)
		if err != nil {
			return err
		}
		if e.Props == nil {
			props = []byte("{}")
		}
		consulate, degree := promoted(e)
		var user any
		if e.UserID != "" {
			user = e.UserID
		}
		if _, err := stmt.Exec(
			e.Name, e.VisitorID, e.SessionID, user, e.Timestamp,
			nullable(e.Src), nullable(e.Path), nullable(e.Lang), e.IsMobile,
			nullable(consulate), nullable(degree), props,
		); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func nullable(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// Identify links a visitor to a user and backfills that visitor's earlier
// events, so activity from before signup is attributable to them.
func (r *analyticsRepo) Identify(visitorID, userID string) (int64, error) {
	if visitorID == "" || userID == "" {
		return 0, fmt.Errorf("visitor_id and user_id are both required")
	}
	if _, err := r.db.Exec(`
		INSERT INTO analytics_identities (visitor_id, user_id)
		VALUES ($1, $2)
		ON CONFLICT (visitor_id) DO UPDATE SET user_id = EXCLUDED.user_id`,
		visitorID, userID); err != nil {
		return 0, err
	}
	res, err := r.db.Exec(
		`UPDATE analytics_events SET user_id = $1 WHERE visitor_id = $2 AND user_id IS NULL`,
		userID, visitorID)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// DeleteForUser removes every event belonging to a user, across all the
// visitors that were ever linked to them. Part of the deletion path the privacy
// rules require to exist now rather than later.
func (r *analyticsRepo) DeleteForUser(userID string) (int64, error) {
	res, err := r.db.Exec(`
		DELETE FROM analytics_events
		WHERE user_id = $1
		   OR visitor_id IN (SELECT visitor_id FROM analytics_identities WHERE user_id = $1)`,
		userID)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	_, err = r.db.Exec(`DELETE FROM analytics_identities WHERE user_id = $1`, userID)
	return n, err
}
