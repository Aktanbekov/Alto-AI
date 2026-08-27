package repository

import (
	"database/sql"
	"fmt"
	"time"
)

// InterviewSession is a completed (or abandoned) interview run, persisted so
// the admin panel can report on activity. The live session state still lives
// in the interview package; this is the durable record written on completion.
type InterviewSession struct {
	ID            string     `json:"id"`
	UserEmail     string     `json:"user_email"`
	Level         string     `json:"level"`
	Status        string     `json:"status"`
	QuestionCount int        `json:"question_count"`
	AnswerCount   int        `json:"answer_count"`
	OverallScore  *int       `json:"overall_score"`
	OverallGrade  string     `json:"overall_grade"`
	Verdict       string     `json:"verdict"`
	StartedAt     time.Time  `json:"started_at"`
	FinishedAt    *time.Time `json:"finished_at"`
}

// InterviewAnswer is one answer within a session, with its grade.
type InterviewAnswer struct {
	ID             int64     `json:"id"`
	SessionID      string    `json:"session_id"`
	QuestionID     string    `json:"question_id"`
	QuestionText   string    `json:"question_text"`
	AnswerText     string    `json:"answer_text"`
	TotalScore     *int      `json:"total_score"`
	Classification string    `json:"classification"`
	CreatedAt      time.Time `json:"created_at"`
}

// AdminStats is the dashboard aggregate.
type AdminStats struct {
	TotalUsers        int            `json:"total_users"`
	VerifiedUsers     int            `json:"verified_users"`
	UsersLast7Days    int            `json:"users_last_7_days"`
	UsersLast30Days   int            `json:"users_last_30_days"`
	TotalSessions     int            `json:"total_sessions"`
	FinishedSessions  int            `json:"finished_sessions"`
	SessionsLast7Days int            `json:"sessions_last_7_days"`
	AverageScore      *float64       `json:"average_score"`
	SignupsByDay      []DayCount     `json:"signups_by_day"`
	SessionsByLevel   []LabelCount   `json:"sessions_by_level"`
	TopColleges       []LabelCount   `json:"top_colleges"`
	TopMajors         []LabelCount   `json:"top_majors"`
	GradeDistribution []LabelCount   `json:"grade_distribution"`
}

type DayCount struct {
	Day   string `json:"day"`
	Count int    `json:"count"`
}

type LabelCount struct {
	Label string `json:"label"`
	Count int    `json:"count"`
}

// InterviewRepo persists interview results and serves admin aggregates.
type InterviewRepo interface {
	SaveSession(s InterviewSession, answers []InterviewAnswer) error
	ListSessions(search string, limit, offset int) ([]InterviewSession, int, error)
	GetSession(id string) (InterviewSession, []InterviewAnswer, error)
	SessionsForUser(email string, limit int) ([]InterviewSession, error)
	Stats() (AdminStats, error)
}

type interviewRepo struct{ db *sql.DB }

// NewInterviewRepo creates the interview tables if absent and returns the repo.
// It reuses the *sql.DB opened by the user repository.
func NewInterviewRepo(db *sql.DB) (InterviewRepo, error) {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS interview_sessions (
			id VARCHAR(64) PRIMARY KEY,
			user_email VARCHAR(255) NOT NULL DEFAULT '',
			level VARCHAR(16) NOT NULL DEFAULT '',
			status VARCHAR(32) NOT NULL DEFAULT '',
			question_count INT NOT NULL DEFAULT 0,
			answer_count INT NOT NULL DEFAULT 0,
			overall_score INT,
			overall_grade VARCHAR(8) NOT NULL DEFAULT '',
			verdict VARCHAR(64) NOT NULL DEFAULT '',
			started_at TIMESTAMP NOT NULL DEFAULT NOW(),
			finished_at TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS interview_answers (
			id BIGSERIAL PRIMARY KEY,
			session_id VARCHAR(64) NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
			question_id VARCHAR(64) NOT NULL DEFAULT '',
			question_text TEXT NOT NULL DEFAULT '',
			answer_text TEXT NOT NULL DEFAULT '',
			total_score INT,
			classification VARCHAR(32) NOT NULL DEFAULT '',
			created_at TIMESTAMP NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_user_email ON interview_sessions(user_email)`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON interview_sessions(started_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_answers_session_id ON interview_answers(session_id)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return nil, fmt.Errorf("interview schema: %w", err)
		}
	}
	return &interviewRepo{db: db}, nil
}

// SaveSession upserts a session and replaces its answers, in one transaction.
func (r *interviewRepo) SaveSession(s InterviewSession, answers []InterviewAnswer) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO interview_sessions
			(id, user_email, level, status, question_count, answer_count,
			 overall_score, overall_grade, verdict, started_at, finished_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		ON CONFLICT (id) DO UPDATE SET
			user_email = EXCLUDED.user_email,
			level = EXCLUDED.level,
			status = EXCLUDED.status,
			question_count = EXCLUDED.question_count,
			answer_count = EXCLUDED.answer_count,
			overall_score = EXCLUDED.overall_score,
			overall_grade = EXCLUDED.overall_grade,
			verdict = EXCLUDED.verdict,
			finished_at = EXCLUDED.finished_at`,
		s.ID, s.UserEmail, s.Level, s.Status, s.QuestionCount, s.AnswerCount,
		s.OverallScore, s.OverallGrade, s.Verdict, s.StartedAt, s.FinishedAt)
	if err != nil {
		return fmt.Errorf("upsert session: %w", err)
	}

	if _, err = tx.Exec(`DELETE FROM interview_answers WHERE session_id = $1`, s.ID); err != nil {
		return fmt.Errorf("clear answers: %w", err)
	}
	for _, a := range answers {
		_, err = tx.Exec(`
			INSERT INTO interview_answers
				(session_id, question_id, question_text, answer_text, total_score, classification)
			VALUES ($1,$2,$3,$4,$5,$6)`,
			s.ID, a.QuestionID, a.QuestionText, a.AnswerText, a.TotalScore, a.Classification)
		if err != nil {
			return fmt.Errorf("insert answer: %w", err)
		}
	}
	return tx.Commit()
}

func (r *interviewRepo) ListSessions(search string, limit, offset int) ([]InterviewSession, int, error) {
	where := ""
	args := []interface{}{}
	if search != "" {
		where = `WHERE user_email ILIKE $1`
		args = append(args, "%"+search+"%")
	}

	var total int
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM interview_sessions `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	rows, err := r.db.Query(fmt.Sprintf(`
		SELECT id, user_email, level, status, question_count, answer_count,
		       overall_score, overall_grade, verdict, started_at, finished_at
		FROM interview_sessions %s
		ORDER BY started_at DESC
		LIMIT $%d OFFSET $%d`, where, len(args)-1, len(args)), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := []InterviewSession{}
	for rows.Next() {
		s, err := scanSession(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, s)
	}
	return out, total, rows.Err()
}

func (r *interviewRepo) GetSession(id string) (InterviewSession, []InterviewAnswer, error) {
	row := r.db.QueryRow(`
		SELECT id, user_email, level, status, question_count, answer_count,
		       overall_score, overall_grade, verdict, started_at, finished_at
		FROM interview_sessions WHERE id = $1`, id)

	s, err := scanSession(row)
	if err != nil {
		return InterviewSession{}, nil, err
	}

	rows, err := r.db.Query(`
		SELECT id, session_id, question_id, question_text, answer_text,
		       total_score, classification, created_at
		FROM interview_answers WHERE session_id = $1 ORDER BY id`, id)
	if err != nil {
		return s, nil, err
	}
	defer rows.Close()

	answers := []InterviewAnswer{}
	for rows.Next() {
		var a InterviewAnswer
		if err := rows.Scan(&a.ID, &a.SessionID, &a.QuestionID, &a.QuestionText,
			&a.AnswerText, &a.TotalScore, &a.Classification, &a.CreatedAt); err != nil {
			return s, nil, err
		}
		answers = append(answers, a)
	}
	return s, answers, rows.Err()
}

func (r *interviewRepo) SessionsForUser(email string, limit int) ([]InterviewSession, error) {
	rows, err := r.db.Query(`
		SELECT id, user_email, level, status, question_count, answer_count,
		       overall_score, overall_grade, verdict, started_at, finished_at
		FROM interview_sessions WHERE user_email = $1
		ORDER BY started_at DESC LIMIT $2`, email, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []InterviewSession{}
	for rows.Next() {
		s, err := scanSession(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// scanner lets scanSession accept both *sql.Row and *sql.Rows.
type scanner interface {
	Scan(dest ...interface{}) error
}

func scanSession(sc scanner) (InterviewSession, error) {
	var s InterviewSession
	err := sc.Scan(&s.ID, &s.UserEmail, &s.Level, &s.Status, &s.QuestionCount,
		&s.AnswerCount, &s.OverallScore, &s.OverallGrade, &s.Verdict,
		&s.StartedAt, &s.FinishedAt)
	return s, err
}

func (r *interviewRepo) Stats() (AdminStats, error) {
	var st AdminStats

	err := r.db.QueryRow(`
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE email_verified),
			COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'),
			COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')
		FROM users`).Scan(&st.TotalUsers, &st.VerifiedUsers, &st.UsersLast7Days, &st.UsersLast30Days)
	if err != nil {
		return st, fmt.Errorf("user stats: %w", err)
	}

	err = r.db.QueryRow(`
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE status = 'finished'),
			COUNT(*) FILTER (WHERE started_at >= NOW() - INTERVAL '7 days'),
			AVG(overall_score) FILTER (WHERE overall_score IS NOT NULL)
		FROM interview_sessions`).Scan(&st.TotalSessions, &st.FinishedSessions,
		&st.SessionsLast7Days, &st.AverageScore)
	if err != nil {
		return st, fmt.Errorf("session stats: %w", err)
	}

	st.SignupsByDay, err = r.dayCounts(`
		SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)
		FROM users WHERE created_at >= NOW() - INTERVAL '30 days'
		GROUP BY 1 ORDER BY 1`)
	if err != nil {
		return st, err
	}

	if st.SessionsByLevel, err = r.labelCounts(`
		SELECT COALESCE(NULLIF(level,''),'unspecified'), COUNT(*)
		FROM interview_sessions GROUP BY 1 ORDER BY 2 DESC`); err != nil {
		return st, err
	}
	if st.TopColleges, err = r.labelCounts(`
		SELECT college, COUNT(*) FROM users
		WHERE college IS NOT NULL AND college <> '' GROUP BY 1 ORDER BY 2 DESC LIMIT 8`); err != nil {
		return st, err
	}
	if st.TopMajors, err = r.labelCounts(`
		SELECT major, COUNT(*) FROM users
		WHERE major IS NOT NULL AND major <> '' GROUP BY 1 ORDER BY 2 DESC LIMIT 8`); err != nil {
		return st, err
	}
	if st.GradeDistribution, err = r.labelCounts(`
		SELECT overall_grade, COUNT(*) FROM interview_sessions
		WHERE overall_grade <> '' GROUP BY 1 ORDER BY 1`); err != nil {
		return st, err
	}
	return st, nil
}

func (r *interviewRepo) dayCounts(q string) ([]DayCount, error) {
	rows, err := r.db.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []DayCount{}
	for rows.Next() {
		var d DayCount
		if err := rows.Scan(&d.Day, &d.Count); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *interviewRepo) labelCounts(q string) ([]LabelCount, error) {
	rows, err := r.db.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []LabelCount{}
	for rows.Next() {
		var l LabelCount
		if err := rows.Scan(&l.Label, &l.Count); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}
