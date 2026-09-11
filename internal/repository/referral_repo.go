package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// ReferralRepo stores the tracking links the admin panel hands out.
//
// A link is not a redirect and stores no traffic of its own. It is a name for a
// `src` value: the panel builds "https://altovisas.com/?src=reddit", the
// analytics client already captures `?src=` on arrival and stamps it onto every
// event that visitor fires, and the numbers are read back out of
// analytics_events grouped by src. So this table only holds the label, the
// destination and the note - deleting a row loses the name, never the traffic.
type ReferralRepo interface {
	List(includeArchived bool) ([]ReferralLink, error)
	Get(code string) (ReferralLink, error)
	Create(l ReferralLink) (ReferralLink, error)
	Update(code string, l ReferralLink) (ReferralLink, error)
	Archive(code string, archived bool) error
	Delete(code string) error
}

// ReferralLink is one named campaign source.
type ReferralLink struct {
	Code        string    `json:"code"`        // the ?src= value, e.g. "reddit"
	Label       string    `json:"label"`       // human name, e.g. "Reddit r/f1visa"
	Destination string    `json:"destination"` // site path the link opens, e.g. "/"
	Notes       string    `json:"notes"`
	Archived    bool      `json:"archived"`
	CreatedAt   time.Time `json:"created_at"`
}

// ErrLinkExists is returned when a code is already taken. Codes have to be
// unique: two links sharing one code would report as a single merged source
// with no way to separate them afterwards, since the events only carry the code.
var ErrLinkExists = errors.New("a link with that code already exists")

// ErrLinkNotFound is returned for an unknown code.
var ErrLinkNotFound = errors.New("link not found")

// A code travels in a URL, gets pasted into posts, and is typed back into the
// analytics filter box by hand. Lowercase letters, digits, dash and underscore
// keep all three of those from surprising anyone.
var codePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,63}$`)

// NormalizeLinkCode lowercases and strips a candidate code, then validates it.
// Returns an error rather than silently mangling: an admin who typed
// "Reddit AMA" should be told the code will be "reddit-ama", not find out from
// a report three weeks later.
func NormalizeLinkCode(raw string) (string, error) {
	code := strings.ToLower(strings.TrimSpace(raw))
	code = strings.Join(strings.Fields(code), "-") // inner whitespace -> dashes
	if code == "" {
		return "", fmt.Errorf("code is required")
	}
	if len(code) > 64 {
		return "", fmt.Errorf("code must be 64 characters or fewer")
	}
	if !codePattern.MatchString(code) {
		return "", fmt.Errorf("code may use lowercase letters, digits, dashes and underscores, and must start with a letter or digit")
	}
	return code, nil
}

// NormalizeDestination bounds the landing path to this site.
//
// Only a path is accepted, never a full URL. The value is pasted straight into
// the link the panel shows, so allowing "https://..." here would let a stored
// row send visitors somewhere else entirely.
func NormalizeDestination(raw string) (string, error) {
	dest := strings.TrimSpace(raw)
	if dest == "" {
		return "/", nil
	}
	if !strings.HasPrefix(dest, "/") || strings.HasPrefix(dest, "//") {
		return "", fmt.Errorf("destination must be a path on this site, starting with a single /")
	}
	if strings.ContainsAny(dest, " \t\r\n?#") {
		return "", fmt.Errorf("destination must be a plain path, with no query string or fragment")
	}
	if len(dest) > 255 {
		return "", fmt.Errorf("destination is too long")
	}
	return dest, nil
}

type referralRepo struct{ db *sql.DB }

func NewReferralRepo(db *sql.DB) ReferralRepo { return &referralRepo{db: db} }

// EnsureReferralSchema creates the table, following the same
// create-if-not-exists convention as the analytics and validation schemas.
func EnsureReferralSchema(db *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS referral_links (
			code        VARCHAR(64)  PRIMARY KEY,
			label       VARCHAR(120) NOT NULL DEFAULT '',
			destination VARCHAR(255) NOT NULL DEFAULT '/',
			notes       TEXT         NOT NULL DEFAULT '',
			archived    BOOLEAN      NOT NULL DEFAULT FALSE,
			created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_referral_links_created ON referral_links (created_at DESC)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return fmt.Errorf("referral schema: %w", err)
		}
	}
	return nil
}

const referralColumns = `code, label, destination, notes, archived, created_at`

func scanLink(row interface{ Scan(...any) error }) (ReferralLink, error) {
	var l ReferralLink
	err := row.Scan(&l.Code, &l.Label, &l.Destination, &l.Notes, &l.Archived, &l.CreatedAt)
	return l, err
}

func (r *referralRepo) List(includeArchived bool) ([]ReferralLink, error) {
	q := `SELECT ` + referralColumns + ` FROM referral_links`
	if !includeArchived {
		q += ` WHERE archived = FALSE`
	}
	q += ` ORDER BY created_at DESC`

	rows, err := r.db.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []ReferralLink{}
	for rows.Next() {
		l, err := scanLink(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (r *referralRepo) Get(code string) (ReferralLink, error) {
	l, err := scanLink(r.db.QueryRow(
		`SELECT `+referralColumns+` FROM referral_links WHERE code = $1`, code))
	if errors.Is(err, sql.ErrNoRows) {
		return ReferralLink{}, ErrLinkNotFound
	}
	return l, err
}

// Create inserts a link, refusing a code that is already in use. The conflict
// is detected by the primary key rather than a prior SELECT, so two admins
// creating the same code at once cannot both succeed.
func (r *referralRepo) Create(l ReferralLink) (ReferralLink, error) {
	out, err := scanLink(r.db.QueryRow(`
		INSERT INTO referral_links (code, label, destination, notes)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (code) DO NOTHING
		RETURNING `+referralColumns,
		l.Code, l.Label, l.Destination, l.Notes))
	if errors.Is(err, sql.ErrNoRows) {
		return ReferralLink{}, ErrLinkExists
	}
	return out, err
}

// Update changes the label, destination and notes. The code is deliberately not
// editable: it is already stamped on every event that link brought in, so
// renaming it would orphan that history under a code nothing points at.
func (r *referralRepo) Update(code string, l ReferralLink) (ReferralLink, error) {
	out, err := scanLink(r.db.QueryRow(`
		UPDATE referral_links
		SET label = $2, destination = $3, notes = $4
		WHERE code = $1
		RETURNING `+referralColumns,
		code, l.Label, l.Destination, l.Notes))
	if errors.Is(err, sql.ErrNoRows) {
		return ReferralLink{}, ErrLinkNotFound
	}
	return out, err
}

// Archive hides a link from the default list without touching its traffic.
// The normal way to retire a campaign: the numbers stay readable.
func (r *referralRepo) Archive(code string, archived bool) error {
	res, err := r.db.Exec(
		`UPDATE referral_links SET archived = $2 WHERE code = $1`, code, archived)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrLinkNotFound
	}
	return nil
}

// Delete drops the row. The events keep their src value, so the source still
// appears in the panel - as an untracked code with no label.
func (r *referralRepo) Delete(code string) error {
	res, err := r.db.Exec(`DELETE FROM referral_links WHERE code = $1`, code)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrLinkNotFound
	}
	return nil
}
