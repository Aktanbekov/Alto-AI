package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ValidationRepo backs the progressive validation flow: the two short feedback
// prompts, the unlock survey, the entitlement grants they produce, and the
// premium waitlist.
//
// Everything here is keyed by a subject — either a signed-in user id or the
// server-issued guest cookie, never both. The server is deliberately the only
// authority on any of it: a client that clears localStorage, refreshes
// mid-survey or replays a submission must not be able to re-answer a prompt or
// win a second unlock, so "have they done this already" is a uniqueness
// constraint in Postgres rather than a flag in the browser.
type ValidationRepo interface {
	// Feedback prompts.
	SaveFeedback(f Feedback) error
	FeedbackKinds(s Subject) (map[string]bool, error)

	// Unlock survey and the grant it produces.
	SaveSurvey(s SurveyResponse) (granted bool, err error)
	HasSurvey(s Subject) (bool, error)
	ExtraSets(s Subject) (int, error)

	// Premium waitlist.
	JoinWaitlist(s Subject, email string) (added bool, err error)
	OnWaitlist(s Subject) (bool, error)

	// Claim moves a guest's rows onto their account after they sign in.
	Claim(userID, visitorID string) error
}

// Subject is who a row belongs to. Exactly one field is the owning key: a
// signed-in caller is keyed by UserID and a guest by VisitorID, which is what
// the partial unique indexes below encode.
type Subject struct {
	UserID    string
	VisitorID string
}

// SignedIn reports whether the account, rather than the browser, owns the row.
func (s Subject) SignedIn() bool { return s.UserID != "" }

// Valid guards against writing a row nothing can ever be matched back to.
func (s Subject) Valid() bool { return s.UserID != "" || s.VisitorID != "" }

// Feedback is one answered or skipped prompt. A skip is stored as a row like
// any other: "they said no" and "they have not been asked" have to be
// distinguishable, or the prompt comes back on the next page load.
type Feedback struct {
	Subject
	Kind       string // "rating" after set 1, "detail" after set 2
	SetIndex   int
	Rating     int    // 1-5, 0 when not applicable
	MostUseful string // one of the fixed options, "" when skipped
	OpenText   string // free text, already truncated by the handler
	Skipped    bool
}

// SurveyResponse is one completed validation survey.
type SurveyResponse struct {
	Subject
	InterviewTiming   string
	PrepMethods       []string // multi-select
	BiggestDifficulty string
	MostUseful        string
	InaccurateText    string
	PricePoint        string
	BlockerText       string
}

// SurveyUnlockSets is what completing the survey grants. Exactly three more
// sets, once — the number is fixed here so the handler cannot drift from the
// copy the user was shown.
const SurveyUnlockSets = 3

type validationRepo struct{ db *sql.DB }

func NewValidationRepo(db *sql.DB) ValidationRepo { return &validationRepo{db: db} }

// EnsureValidationSchema creates the tables, following the create-if-not-exists
// convention the rest of the repository layer uses.
//
// Each table carries the same pair of partial unique indexes. They are what
// make every write in this file idempotent: one subject can hold at most one
// row, so a replayed request conflicts instead of granting a second unlock.
func EnsureValidationSchema(db *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS quiz_feedback (
			id          VARCHAR(36) PRIMARY KEY,
			user_id     VARCHAR(36),
			visitor_id  VARCHAR(36),
			kind        VARCHAR(16) NOT NULL,
			set_index   SMALLINT NOT NULL DEFAULT 0,
			rating      SMALLINT,
			most_useful VARCHAR(32),
			open_text   VARCHAR(1000),
			skipped     BOOLEAN NOT NULL DEFAULT FALSE,
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_feedback_user
			ON quiz_feedback (user_id, kind) WHERE user_id IS NOT NULL`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_feedback_visitor
			ON quiz_feedback (visitor_id, kind) WHERE user_id IS NULL`,

		`CREATE TABLE IF NOT EXISTS validation_surveys (
			id                 VARCHAR(36) PRIMARY KEY,
			user_id            VARCHAR(36),
			visitor_id         VARCHAR(36),
			interview_timing   VARCHAR(64),
			prep_methods       JSONB NOT NULL DEFAULT '[]'::jsonb,
			biggest_difficulty VARCHAR(64),
			most_useful        VARCHAR(32),
			inaccurate_text    VARCHAR(1000),
			price_point        VARCHAR(32),
			blocker_text       VARCHAR(1000),
			completed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_validation_surveys_user
			ON validation_surveys (user_id) WHERE user_id IS NOT NULL`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_validation_surveys_visitor
			ON validation_surveys (visitor_id) WHERE user_id IS NULL`,

		// Kept apart from the survey row so a future grant — a promo code, an
		// apology for a bad report — does not have to invent a fake survey.
		`CREATE TABLE IF NOT EXISTS quiz_entitlements (
			id         VARCHAR(36) PRIMARY KEY,
			user_id    VARCHAR(36),
			visitor_id VARCHAR(36),
			extra_sets INTEGER NOT NULL DEFAULT 0,
			source     VARCHAR(32) NOT NULL DEFAULT 'survey',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_entitlements_user
			ON quiz_entitlements (user_id, source) WHERE user_id IS NOT NULL`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_entitlements_visitor
			ON quiz_entitlements (visitor_id, source) WHERE user_id IS NULL`,

		`CREATE TABLE IF NOT EXISTS premium_waitlist (
			id         VARCHAR(36) PRIMARY KEY,
			user_id    VARCHAR(36),
			visitor_id VARCHAR(36),
			email      VARCHAR(255) NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		// One address, one place in line, however many times it is submitted
		// and whichever browser it came from.
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_waitlist_email
			ON premium_waitlist (lower(email))`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return fmt.Errorf("validation schema: %w", err)
		}
	}
	return nil
}

// where builds the subject predicate. A guest's rows are the ones with no user
// id: once claimed by an account they stop matching the cookie, which is what
// stops a shared browser inheriting someone else's unlock.
func (s Subject) where(startAt int) (string, []any) {
	if s.SignedIn() {
		return fmt.Sprintf("user_id = $%d", startAt), []any{s.UserID}
	}
	return fmt.Sprintf("visitor_id = $%d AND user_id IS NULL", startAt), []any{s.VisitorID}
}

// SaveFeedback records an answer or a skip. First write wins: the prompt is
// asked once, so a replay must not overwrite what they originally said.
func (r *validationRepo) SaveFeedback(f Feedback) error {
	if !f.Valid() {
		return fmt.Errorf("feedback: no subject")
	}
	_, err := r.db.Exec(`
		INSERT INTO quiz_feedback
			(id, user_id, visitor_id, kind, set_index, rating, most_useful, open_text, skipped)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		ON CONFLICT DO NOTHING`,
		uuid.NewString(), nullable(f.UserID), nullable(f.VisitorID),
		f.Kind, f.SetIndex, nullableInt(f.Rating),
		nullable(f.MostUseful), nullable(f.OpenText), f.Skipped)
	return err
}

// FeedbackKinds reports which prompts this subject has already dealt with, in
// either direction. The page asks this before rendering, so a prompt that was
// skipped on another device does not reappear here.
func (r *validationRepo) FeedbackKinds(s Subject) (map[string]bool, error) {
	out := map[string]bool{}
	if !s.Valid() {
		return out, nil
	}
	pred, args := s.where(1)
	rows, err := r.db.Query(`SELECT kind FROM quiz_feedback WHERE `+pred, args...)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var kind string
		if err := rows.Scan(&kind); err != nil {
			return out, err
		}
		out[kind] = true
	}
	return out, rows.Err()
}

// SaveSurvey stores the responses and grants the unlock in one transaction, and
// reports whether this call was the one that granted it.
//
// Both inserts are ON CONFLICT DO NOTHING against the subject's unique index, so
// a double-submitted form, a retried request or a refreshed success page all
// leave exactly one survey row and exactly one grant of three sets.
func (r *validationRepo) SaveSurvey(s SurveyResponse) (bool, error) {
	if !s.Valid() {
		return false, fmt.Errorf("survey: no subject")
	}
	tx, err := r.db.Begin()
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback() }()

	methods, _ := json.Marshal(orEmptyStrings(s.PrepMethods))
	if _, err := tx.Exec(`
		INSERT INTO validation_surveys
			(id, user_id, visitor_id, interview_timing, prep_methods, biggest_difficulty,
			 most_useful, inaccurate_text, price_point, blocker_text, completed_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		ON CONFLICT DO NOTHING`,
		uuid.NewString(), nullable(s.UserID), nullable(s.VisitorID),
		nullable(s.InterviewTiming), methods, nullable(s.BiggestDifficulty),
		nullable(s.MostUseful), nullable(s.InaccurateText),
		nullable(s.PricePoint), nullable(s.BlockerText), time.Now().UTC()); err != nil {
		return false, err
	}

	res, err := tx.Exec(`
		INSERT INTO quiz_entitlements (id, user_id, visitor_id, extra_sets, source)
		VALUES ($1,$2,$3,$4,'survey')
		ON CONFLICT DO NOTHING`,
		uuid.NewString(), nullable(s.UserID), nullable(s.VisitorID), SurveyUnlockSets)
	if err != nil {
		return false, err
	}
	granted, _ := res.RowsAffected()

	if err := tx.Commit(); err != nil {
		return false, err
	}
	return granted > 0, nil
}

func (r *validationRepo) HasSurvey(s Subject) (bool, error) {
	if !s.Valid() {
		return false, nil
	}
	pred, args := s.where(1)
	var exists bool
	err := r.db.QueryRow(
		`SELECT EXISTS (SELECT 1 FROM validation_surveys WHERE `+pred+`)`, args...).Scan(&exists)
	return exists, err
}

// ExtraSets totals the subject's grants. Zero for almost everyone; three once
// they have completed the survey.
func (r *validationRepo) ExtraSets(s Subject) (int, error) {
	if !s.Valid() {
		return 0, nil
	}
	pred, args := s.where(1)
	var total int
	err := r.db.QueryRow(
		`SELECT COALESCE(SUM(extra_sets), 0) FROM quiz_entitlements WHERE `+pred, args...).Scan(&total)
	return total, err
}

// JoinWaitlist records an address, reporting whether it was new. A repeat
// submission is not an error — the caller tells the user they are on the list
// either way, since revealing that an address is already registered would leak
// it to anyone who cared to guess.
func (r *validationRepo) JoinWaitlist(s Subject, email string) (bool, error) {
	email = strings.TrimSpace(email)
	if email == "" {
		return false, fmt.Errorf("waitlist: empty email")
	}
	res, err := r.db.Exec(`
		INSERT INTO premium_waitlist (id, user_id, visitor_id, email)
		VALUES ($1,$2,$3,$4)
		ON CONFLICT DO NOTHING`,
		uuid.NewString(), nullable(s.UserID), nullable(s.VisitorID), email)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

func (r *validationRepo) OnWaitlist(s Subject) (bool, error) {
	if !s.Valid() {
		return false, nil
	}
	pred, args := s.where(1)
	var exists bool
	err := r.db.QueryRow(
		`SELECT EXISTS (SELECT 1 FROM premium_waitlist WHERE `+pred+`)`, args...).Scan(&exists)
	return exists, err
}

// Claim moves everything a browser earned onto the account that just signed in,
// so an unlock won as a guest survives creating an account. It mirrors what
// AnalyticsRepo.Identify does for the event stream.
//
// Rows already owned by a user are left alone, and a conflict — the account
// having answered the same prompt itself — leaves the account's own row in
// place and abandons the guest one.
func (r *validationRepo) Claim(userID, visitorID string) error {
	if userID == "" || visitorID == "" {
		return nil
	}
	tables := []string{"quiz_feedback", "validation_surveys", "quiz_entitlements", "premium_waitlist"}
	for _, t := range tables {
		if _, err := r.db.Exec(
			`UPDATE `+t+` SET user_id = $1, updated_at = NOW()
			 WHERE visitor_id = $2 AND user_id IS NULL`, userID, visitorID); err != nil {
			// A unique-index conflict here means the account already answered
			// for itself, which is a fine outcome — not a failed request.
			if !isUniqueViolation(err) {
				return fmt.Errorf("claim %s: %w", t, err)
			}
		}
	}
	return nil
}

// isUniqueViolation matches Postgres SQLSTATE 23505 without pulling the driver's
// error type into this file.
func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(err.Error(), "duplicate key value")
}

func orEmptyStrings(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
