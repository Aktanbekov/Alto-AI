package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// PaymentRequestRepo stores the requests people leave on the checkout page
// while card payments are not available.
//
// There is no payment provider yet, so a paid plan is sold by hand: the
// checkout collects who wants which plan and how to reach them, and an admin
// contacts them to take the payment. Two separate questions are tracked on a
// row: has anyone reached out yet, and did they buy.
//
// Marking a row "bought" is also what activates the plan. In the same
// transaction it grants the plan's practice rounds to the account that sent
// the request, as a quiz_entitlements row with source "plan:<request id>" -
// the same table the survey unlock uses, so the evaluate endpoint and the
// access state count it with no change of their own. Moving the row off
// "bought" removes that grant again.
type PaymentRequestRepo interface {
	Create(r PaymentRequest) (PaymentRequest, error)
	List(limit, offset int) ([]PaymentRequest, int, error)
	Update(id string, u PaymentRequestUpdate) (PaymentRequest, error)
}

// PaymentRequest is one "contact me to pay" submission.
type PaymentRequest struct {
	ID            string     `json:"id"`
	UserID        string     `json:"user_id"`
	Email         string     `json:"email"`
	Name          string     `json:"name"`
	Phone         string     `json:"phone"`
	Plan          string     `json:"plan"`
	Price         int        `json:"price"`
	InterviewDate string     `json:"interview_date"` // YYYY-MM-DD, "" when not set
	Contact       string     `json:"contact"`        // "whatsapp" or "telegram"
	Telegram      string     `json:"telegram"`       // username without @, "" for whatsapp
	Contacted     bool       `json:"contacted"`      // has an admin reached out
	ContactedAt   *time.Time `json:"contacted_at"`
	Outcome       string     `json:"outcome"` // "pending", "bought", "declined"
	Notes         string     `json:"notes"`
	GrantedSets   int        `json:"granted_sets"` // rounds added to the account, 0 until bought
	GrantedAt     *time.Time `json:"granted_at"`
	CreatedAt     time.Time  `json:"created_at"`
}

// PaymentRequestUpdate is a partial edit from the admin table; nil fields are
// left as they are.
type PaymentRequestUpdate struct {
	Contacted *bool
	Outcome   *string
	Notes     *string
}

// PaymentRequestOutcomes are the values Outcome may take.
var PaymentRequestOutcomes = map[string]bool{"pending": true, "bought": true, "declined": true}

// ErrPaymentNoAccount is returned when a request cannot be marked bought
// because it is not linked to an account to give the plan to.
var ErrPaymentNoAccount = errors.New("this request is not linked to an account")

// ErrPaymentUnknownPlan is returned when the row's plan has no round count.
var ErrPaymentUnknownPlan = errors.New("this request's plan is not one that can be activated")

// PlanSourcePrefix marks the quiz_entitlements rows a bought plan creates.
const PlanSourcePrefix = "plan:"

type paymentRequestRepo struct {
	db       *sql.DB
	planSets map[string]int
}

// NewPaymentRequestRepo takes how many practice rounds each paid plan grants.
func NewPaymentRequestRepo(db *sql.DB, planSets map[string]int) PaymentRequestRepo {
	return &paymentRequestRepo{db: db, planSets: planSets}
}

// EnsurePaymentRequestSchema creates the table, following the same
// create-if-not-exists convention as the other schemas.
func EnsurePaymentRequestSchema(db *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS payment_requests (
			id             UUID         PRIMARY KEY,
			user_id        VARCHAR(64)  NOT NULL DEFAULT '',
			email          VARCHAR(255) NOT NULL DEFAULT '',
			name           VARCHAR(120) NOT NULL,
			phone          VARCHAR(32)  NOT NULL,
			plan           VARCHAR(32)  NOT NULL,
			price          INTEGER      NOT NULL,
			interview_date DATE,
			contact        VARCHAR(16)  NOT NULL,
			telegram       VARCHAR(64)  NOT NULL DEFAULT '',
			contacted      BOOLEAN      NOT NULL DEFAULT FALSE,
			contacted_at   TIMESTAMPTZ,
			outcome        VARCHAR(16)  NOT NULL DEFAULT 'pending',
			notes          TEXT         NOT NULL DEFAULT '',
			created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
		// Columns added after the first local version of the table.
		`ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS contacted BOOLEAN NOT NULL DEFAULT FALSE`,
		`ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMPTZ`,
		`ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS outcome VARCHAR(16) NOT NULL DEFAULT 'pending'`,
		`ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS granted_sets INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS granted_at TIMESTAMPTZ`,
		`CREATE INDEX IF NOT EXISTS idx_payment_requests_created ON payment_requests (created_at DESC)`,
		// A plan grant's source is "plan:" plus a 36-character id, longer than
		// the 32 the survey-era column allowed. Widened only when still narrow,
		// so a normal boot does not take a table lock for nothing.
		`DO $$ BEGIN
			IF (SELECT character_maximum_length FROM information_schema.columns
			    WHERE table_schema = current_schema()
			      AND table_name = 'quiz_entitlements' AND column_name = 'source') < 64 THEN
				ALTER TABLE quiz_entitlements ALTER COLUMN source TYPE VARCHAR(64);
			END IF;
		END $$`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return fmt.Errorf("payment request schema: %w", err)
		}
	}
	return nil
}

const paymentRequestColumns = `id, user_id, email, name, phone, plan, price,
	COALESCE(TO_CHAR(interview_date, 'YYYY-MM-DD'), ''),
	contact, telegram, contacted, contacted_at, outcome, notes, granted_sets, granted_at, created_at`

type rowScanner interface{ Scan(dest ...any) error }

func scanPaymentRequest(row rowScanner) (PaymentRequest, error) {
	var p PaymentRequest
	var contactedAt, grantedAt sql.NullTime
	err := row.Scan(&p.ID, &p.UserID, &p.Email, &p.Name, &p.Phone, &p.Plan, &p.Price,
		&p.InterviewDate, &p.Contact, &p.Telegram, &p.Contacted, &contactedAt,
		&p.Outcome, &p.Notes, &p.GrantedSets, &grantedAt, &p.CreatedAt)
	if contactedAt.Valid {
		p.ContactedAt = &contactedAt.Time
	}
	if grantedAt.Valid {
		p.GrantedAt = &grantedAt.Time
	}
	return p, err
}

func (r *paymentRequestRepo) Create(p PaymentRequest) (PaymentRequest, error) {
	p.ID = uuid.NewString()
	p.Outcome = "pending"
	var date any
	if p.InterviewDate != "" {
		date = p.InterviewDate
	}
	err := r.db.QueryRow(`
		INSERT INTO payment_requests
			(id, user_id, email, name, phone, plan, price, interview_date, contact, telegram)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING created_at`,
		p.ID, p.UserID, p.Email, p.Name, p.Phone, p.Plan, p.Price, date, p.Contact, p.Telegram,
	).Scan(&p.CreatedAt)
	if err != nil {
		return PaymentRequest{}, fmt.Errorf("create payment request: %w", err)
	}
	return p, nil
}

func (r *paymentRequestRepo) List(limit, offset int) ([]PaymentRequest, int, error) {
	var total int
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM payment_requests`).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count payment requests: %w", err)
	}
	rows, err := r.db.Query(`SELECT `+paymentRequestColumns+`
		FROM payment_requests ORDER BY created_at DESC LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list payment requests: %w", err)
	}
	defer rows.Close()

	out := []PaymentRequest{}
	for rows.Next() {
		p, err := scanPaymentRequest(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan payment request: %w", err)
		}
		out = append(out, p)
	}
	return out, total, rows.Err()
}

// Update applies a partial edit. contacted_at is stamped the first time a row
// is marked contacted and cleared if it is unmarked.
//
// An outcome change also grants or revokes the plan, in one transaction with
// the row so the table and the account can never disagree.
func (r *paymentRequestRepo) Update(id string, u PaymentRequestUpdate) (PaymentRequest, error) {
	if u.Outcome != nil && !PaymentRequestOutcomes[*u.Outcome] {
		return PaymentRequest{}, fmt.Errorf("unknown outcome %q", *u.Outcome)
	}
	tx, err := r.db.Begin()
	if err != nil {
		return PaymentRequest{}, err
	}
	defer tx.Rollback()

	// Lock the row: two admins pressing "bought" at once must grant once.
	var userID, plan, outcome string
	err = tx.QueryRow(`SELECT user_id, plan, outcome FROM payment_requests WHERE id = $1 FOR UPDATE`, id).
		Scan(&userID, &plan, &outcome)
	if err == sql.ErrNoRows {
		return PaymentRequest{}, sql.ErrNoRows
	}
	if err != nil {
		return PaymentRequest{}, fmt.Errorf("load payment request: %w", err)
	}

	source := PlanSourcePrefix + id
	switch {
	case u.Outcome != nil && *u.Outcome == "bought" && outcome != "bought":
		if userID == "" {
			return PaymentRequest{}, ErrPaymentNoAccount
		}
		sets := r.planSets[plan]
		if sets <= 0 {
			return PaymentRequest{}, ErrPaymentUnknownPlan
		}
		if _, err := tx.Exec(`
			INSERT INTO quiz_entitlements (id, user_id, visitor_id, extra_sets, source)
			VALUES ($1, $2, NULL, $3, $4)
			ON CONFLICT DO NOTHING`, uuid.NewString(), userID, sets, source); err != nil {
			return PaymentRequest{}, fmt.Errorf("grant plan: %w", err)
		}
		if _, err := tx.Exec(`UPDATE payment_requests SET granted_sets = $2, granted_at = NOW() WHERE id = $1`,
			id, sets); err != nil {
			return PaymentRequest{}, fmt.Errorf("record grant: %w", err)
		}
	case u.Outcome != nil && *u.Outcome != "bought" && outcome == "bought":
		if _, err := tx.Exec(`DELETE FROM quiz_entitlements WHERE source = $1`, source); err != nil {
			return PaymentRequest{}, fmt.Errorf("revoke plan: %w", err)
		}
		if _, err := tx.Exec(`UPDATE payment_requests SET granted_sets = 0, granted_at = NULL WHERE id = $1`,
			id); err != nil {
			return PaymentRequest{}, fmt.Errorf("record revoke: %w", err)
		}
	}

	row := tx.QueryRow(`
		UPDATE payment_requests SET
			contacted    = COALESCE($2, contacted),
			contacted_at = CASE
				WHEN $2 IS NULL THEN contacted_at
				WHEN $2 THEN COALESCE(contacted_at, NOW())
				ELSE NULL END,
			outcome      = COALESCE($3, outcome),
			notes        = COALESCE($4, notes)
		WHERE id = $1
		RETURNING `+paymentRequestColumns, id, u.Contacted, u.Outcome, u.Notes)
	p, err := scanPaymentRequest(row)
	if err != nil {
		return PaymentRequest{}, fmt.Errorf("update payment request: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return PaymentRequest{}, err
	}
	return p, nil
}
