package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// EvaluationRepo stores submitted profiles, answers and generated reports.
//
// This is the application database the privacy rules point at: the free-text
// plan, sponsor details, funding amounts, the raw GPA and the student's own
// answers live here, attached to the user record, and never in the event
// stream. The analytics side gets only the banded, non-identifying shape of the
// same submission.
//
// Everything here is deletable on request — see DeleteForUser.
type EvaluationRepo interface {
	Save(e StoredEvaluation) (string, error)
	ListForUser(userID string, limit int) ([]StoredEvaluation, error)
	Get(id string) (StoredEvaluation, error)
	DeleteForUser(userID string) (int64, error)

	// Entitlement. Sets are counted by distinct set_index rather than by row so
	// that re-scoring a set already paid for does not consume another one.
	SetsUsed(s Subject) (distinct int, total int, err error)
	UsedSet(s Subject, setIndex int) (bool, error)
	ClaimForUser(userID, visitorID string) error
}

// StoredEvaluation is one submission and the report it produced.
type StoredEvaluation struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id,omitempty"`
	VisitorID string    `json:"visitor_id,omitempty"`
	CreatedAt time.Time `json:"created_at"`

	// The submission, verbatim. Private.
	Profile map[string]any `json:"profile"`
	Answers []any          `json:"answers"`
	Report  map[string]any `json:"report"`

	// Generation metadata. Safe to mirror into events.
	Model        string  `json:"model"`
	InputTokens  int     `json:"input_tokens"`
	OutputTokens int     `json:"output_tokens"`
	CachedTokens int     `json:"cached_tokens"`
	CostUSD      float64 `json:"cost_usd"`
	LatencyMS    int64   `json:"latency_ms"`

	// Denormalised for the admin screens, so listing does not parse every blob.
	Consulate      string `json:"consulate,omitempty"`
	Country        string `json:"country,omitempty"`
	DegreeLevel    string `json:"degree_level,omitempty"`
	GPABand        string `json:"gpa_band,omitempty"`
	ReadinessBand  string `json:"readiness_band,omitempty"`
	FlagCount      int    `json:"flag_count"`
	AttemptNumber  int    `json:"attempt_number,omitempty"`
	HasConsulateNs bool   `json:"has_consulate_data"`

	// Which set of three questions this was, counted from zero. The free-set
	// allowance is measured in these.
	SetIndex int `json:"set_index"`
}

type evaluationRepo struct{ db *sql.DB }

func NewEvaluationRepo(db *sql.DB) EvaluationRepo { return &evaluationRepo{db: db} }

// EnsureEvaluationSchema creates the table, matching the create-if-not-exists
// convention the rest of the repository layer uses.
func EnsureEvaluationSchema(db *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS evaluations (
			id             VARCHAR(36) PRIMARY KEY,
			user_id        VARCHAR(36),
			visitor_id     VARCHAR(36),
			created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			profile        JSONB NOT NULL DEFAULT '{}'::jsonb,
			answers        JSONB NOT NULL DEFAULT '[]'::jsonb,
			report         JSONB NOT NULL DEFAULT '{}'::jsonb,
			model          VARCHAR(64),
			input_tokens   INTEGER NOT NULL DEFAULT 0,
			output_tokens  INTEGER NOT NULL DEFAULT 0,
			cached_tokens  INTEGER NOT NULL DEFAULT 0,
			cost_usd       NUMERIC(10,6) NOT NULL DEFAULT 0,
			latency_ms     BIGINT NOT NULL DEFAULT 0,
			consulate      VARCHAR(64),
			country        VARCHAR(64),
			degree_level   VARCHAR(32),
			gpa_band       VARCHAR(16),
			readiness_band VARCHAR(32),
			flag_count     INTEGER NOT NULL DEFAULT 0,
			attempt_number INTEGER,
			has_consulate_data BOOLEAN NOT NULL DEFAULT FALSE
		)`,
		// Added after the table shipped, so it arrives as an alter rather than
		// part of the create above.
		`ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS set_index SMALLINT NOT NULL DEFAULT 0`,
		`CREATE INDEX IF NOT EXISTS idx_evaluations_user ON evaluations (user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_evaluations_visitor ON evaluations (visitor_id)`,
		`CREATE INDEX IF NOT EXISTS idx_evaluations_created ON evaluations (created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_evaluations_consulate ON evaluations (consulate)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return fmt.Errorf("evaluation schema: %w", err)
		}
	}
	return nil
}

func (r *evaluationRepo) Save(e StoredEvaluation) (string, error) {
	if e.ID == "" {
		e.ID = uuid.New().String()
	}
	if e.CreatedAt.IsZero() {
		e.CreatedAt = time.Now().UTC()
	}
	profile, _ := json.Marshal(orEmptyMap(e.Profile))
	answers, _ := json.Marshal(orEmptySlice(e.Answers))
	report, _ := json.Marshal(orEmptyMap(e.Report))

	_, err := r.db.Exec(`
		INSERT INTO evaluations
			(id, user_id, visitor_id, created_at, profile, answers, report,
			 model, input_tokens, output_tokens, cached_tokens, cost_usd, latency_ms,
			 consulate, country, degree_level, gpa_band, readiness_band, flag_count,
			 attempt_number, has_consulate_data, set_index)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
		e.ID, nullable(e.UserID), nullable(e.VisitorID), e.CreatedAt,
		profile, answers, report,
		nullable(e.Model), e.InputTokens, e.OutputTokens, e.CachedTokens, e.CostUSD, e.LatencyMS,
		nullable(e.Consulate), nullable(e.Country), nullable(e.DegreeLevel),
		nullable(e.GPABand), nullable(e.ReadinessBand), e.FlagCount,
		nullableInt(e.AttemptNumber), e.HasConsulateNs, e.SetIndex)
	return e.ID, err
}

const evalColumns = `id, COALESCE(user_id,''), COALESCE(visitor_id,''), created_at,
	profile, answers, report, COALESCE(model,''), input_tokens, output_tokens,
	cached_tokens, cost_usd, latency_ms, COALESCE(consulate,''), COALESCE(country,''),
	COALESCE(degree_level,''), COALESCE(gpa_band,''), COALESCE(readiness_band,''),
	flag_count, COALESCE(attempt_number,0), has_consulate_data, set_index`

func scanEvaluation(scan func(...any) error) (StoredEvaluation, error) {
	var e StoredEvaluation
	var profile, answers, report []byte
	err := scan(&e.ID, &e.UserID, &e.VisitorID, &e.CreatedAt, &profile, &answers, &report,
		&e.Model, &e.InputTokens, &e.OutputTokens, &e.CachedTokens, &e.CostUSD, &e.LatencyMS,
		&e.Consulate, &e.Country, &e.DegreeLevel, &e.GPABand, &e.ReadinessBand,
		&e.FlagCount, &e.AttemptNumber, &e.HasConsulateNs, &e.SetIndex)
	if err != nil {
		return e, err
	}
	_ = json.Unmarshal(profile, &e.Profile)
	_ = json.Unmarshal(answers, &e.Answers)
	_ = json.Unmarshal(report, &e.Report)
	return e, nil
}

func (r *evaluationRepo) ListForUser(userID string, limit int) ([]StoredEvaluation, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := r.db.Query(
		`SELECT `+evalColumns+` FROM evaluations WHERE user_id = $1
		 ORDER BY created_at DESC LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []StoredEvaluation
	for rows.Next() {
		e, err := scanEvaluation(rows.Scan)
		if err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *evaluationRepo) Get(id string) (StoredEvaluation, error) {
	row := r.db.QueryRow(`SELECT `+evalColumns+` FROM evaluations WHERE id = $1`, id)
	return scanEvaluation(row.Scan)
}

// DeleteForUser erases every submission and report belonging to a user. The
// privacy rules require this path to exist from the start, not to be added once
// someone asks.
func (r *evaluationRepo) DeleteForUser(userID string) (int64, error) {
	res, err := r.db.Exec(`DELETE FROM evaluations WHERE user_id = $1`, userID)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// SetsUsed returns how many distinct sets the subject has scored, and how many
// evaluations they ran in total.
//
// The two differ when someone re-scores a set they already own — refreshing the
// page and submitting the same three answers again. That must not cost them an
// allowance, so the entitlement is spent on the first number; the second exists
// only as a ceiling, because every run costs us a model call.
func (r *evaluationRepo) SetsUsed(s Subject) (int, int, error) {
	if !s.Valid() {
		return 0, 0, nil
	}
	pred, args := s.where(1)
	var distinct, total int
	err := r.db.QueryRow(
		`SELECT COUNT(DISTINCT set_index), COUNT(*) FROM evaluations WHERE `+pred,
		args...).Scan(&distinct, &total)
	return distinct, total, err
}

// UsedSet reports whether this subject has already scored this set, which is
// what separates a re-score from reaching for a new one.
func (r *evaluationRepo) UsedSet(s Subject, setIndex int) (bool, error) {
	if !s.Valid() {
		return false, nil
	}
	pred, args := s.where(1)
	args = append(args, setIndex)
	var exists bool
	err := r.db.QueryRow(
		`SELECT EXISTS (SELECT 1 FROM evaluations WHERE `+pred+` AND set_index = $2)`,
		args...).Scan(&exists)
	return exists, err
}

// ClaimForUser attaches a guest's reports to the account they just created, so
// the sets they have already spent follow them rather than resetting.
func (r *evaluationRepo) ClaimForUser(userID, visitorID string) error {
	if userID == "" || visitorID == "" {
		return nil
	}
	_, err := r.db.Exec(
		`UPDATE evaluations SET user_id = $1 WHERE visitor_id = $2 AND user_id IS NULL`,
		userID, visitorID)
	return err
}

func orEmptyMap(m map[string]any) map[string]any {
	if m == nil {
		return map[string]any{}
	}
	return m
}

func orEmptySlice(s []any) []any {
	if s == nil {
		return []any{}
	}
	return s
}

func nullableInt(n int) any {
	if n == 0 {
		return nil
	}
	return n
}
