package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"time"

	"altoai_mvp/internal/models"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

type postgresRepo struct {
	db *sql.DB
}

// DBProvider is implemented by repositories backed by a SQL database, so
// callers can share the same connection pool (see NewInterviewRepo).
type DBProvider interface {
	DB() *sql.DB
}

func (r *postgresRepo) DB() *sql.DB { return r.db }

func NewPostgresRepo() (UserRepo, error) {
	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		os.Getenv("POSTGRES_HOST"),
		os.Getenv("POSTGRES_PORT"),
		os.Getenv("POSTGRES_USER"),
		os.Getenv("POSTGRES_PASSWORD"),
		os.Getenv("POSTGRES_DB"),
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("error connecting to database: %v", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("error pinging database: %v", err)
	}

	// Create users table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id VARCHAR(36) PRIMARY KEY,
			email VARCHAR(255) UNIQUE NOT NULL,
			name VARCHAR(255) NOT NULL,
			password_hash VARCHAR(255),
			email_verified BOOLEAN DEFAULT FALSE,
			college VARCHAR(255),
			major VARCHAR(255),
			verification_code VARCHAR(6),
			verification_code_expires TIMESTAMP,
			reset_code VARCHAR(6),
			reset_code_expires TIMESTAMP,
			created_at TIMESTAMP NOT NULL,
			updated_at TIMESTAMP NOT NULL
		)
	`)
	if err != nil {
		return nil, fmt.Errorf("error creating users table: %v", err)
	}

	// Migrate existing table: add missing columns if they don't exist
	migrations := []string{
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS college VARCHAR(255)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS major VARCHAR(255)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code VARCHAR(6)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires TIMESTAMP`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code VARCHAR(6)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expires TIMESTAMP`,
	}

	// Check if password column exists and rename it to password_hash if needed
	var passwordColExists bool
	err = db.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM information_schema.columns 
			WHERE table_name = 'users' AND column_name = 'password'
		)
	`).Scan(&passwordColExists)
	
	if err == nil && passwordColExists {
		// Check if password_hash doesn't exist
		var passwordHashExists bool
		err = db.QueryRow(`
			SELECT EXISTS (
				SELECT 1 FROM information_schema.columns 
				WHERE table_name = 'users' AND column_name = 'password_hash'
			)
		`).Scan(&passwordHashExists)
		
		if err == nil && !passwordHashExists {
			// Rename password to password_hash
			_, err = db.Exec(`ALTER TABLE users RENAME COLUMN password TO password_hash`)
			if err != nil {
				return nil, fmt.Errorf("error renaming password column: %v", err)
			}
		}
	}

	// Run migrations
	for _, migration := range migrations {
		_, err = db.Exec(migration)
		if err != nil {
			return nil, fmt.Errorf("error running migration: %v", err)
		}
	}

	return &postgresRepo{db: db}, nil
}

func (r *postgresRepo) List() ([]models.User, error) {
	rows, err := r.db.Query("SELECT id, email, name, password_hash, email_verified, college, major, verification_code, verification_code_expires, reset_code, reset_code_expires, created_at, updated_at FROM users")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		var passwordHash, verificationCode, resetCode, college, major sql.NullString
		var verificationCodeExpires, resetCodeExpires sql.NullTime
		err := rows.Scan(&u.ID, &u.Email, &u.Name, &passwordHash, &u.EmailVerified, &college, &major, &verificationCode, &verificationCodeExpires, &resetCode, &resetCodeExpires, &u.CreatedAt, &u.UpdatedAt)
		if err != nil {
			return nil, err
		}
		if passwordHash.Valid {
			u.Password = passwordHash.String
		}
		if verificationCode.Valid {
			u.VerificationCode = verificationCode.String
		}
		if resetCode.Valid {
			u.ResetCode = resetCode.String
		}
		if verificationCodeExpires.Valid {
			u.VerificationCodeExpires = verificationCodeExpires.Time
		}
		if resetCodeExpires.Valid {
			u.ResetCodeExpires = resetCodeExpires.Time
		}
		if college.Valid {
			u.College = college.String
		}
		if major.Valid {
			u.Major = major.String
		}
		users = append(users, u)
	}
	return users, nil
}

func (r *postgresRepo) Get(id string) (models.User, error) {
	var u models.User
	var passwordHash, verificationCode, resetCode, college, major sql.NullString
	var verificationCodeExpires, resetCodeExpires sql.NullTime
	err := r.db.QueryRow(
		"SELECT id, email, name, password_hash, email_verified, college, major, verification_code, verification_code_expires, reset_code, reset_code_expires, created_at, updated_at FROM users WHERE id = $1",
		id,
	).Scan(&u.ID, &u.Email, &u.Name, &passwordHash, &u.EmailVerified, &college, &major, &verificationCode, &verificationCodeExpires, &resetCode, &resetCodeExpires, &u.CreatedAt, &u.UpdatedAt)

	if err == sql.ErrNoRows {
		return models.User{}, ErrNotFound
	}
	if err != nil {
		return models.User{}, err
	}
	if passwordHash.Valid {
		u.Password = passwordHash.String
	}
	if verificationCode.Valid {
		u.VerificationCode = verificationCode.String
	}
	if resetCode.Valid {
		u.ResetCode = resetCode.String
	}
	if verificationCodeExpires.Valid {
		u.VerificationCodeExpires = verificationCodeExpires.Time
	}
	if resetCodeExpires.Valid {
		u.ResetCodeExpires = resetCodeExpires.Time
	}
	return u, nil
}

func (r *postgresRepo) GetByEmail(email string) (models.User, error) {
	var u models.User
	var passwordHash, verificationCode, resetCode, college, major sql.NullString
	var verificationCodeExpires, resetCodeExpires sql.NullTime
	err := r.db.QueryRow(
		"SELECT id, email, name, password_hash, email_verified, college, major, verification_code, verification_code_expires, reset_code, reset_code_expires, created_at, updated_at FROM users WHERE email = $1",
		email,
	).Scan(&u.ID, &u.Email, &u.Name, &passwordHash, &u.EmailVerified, &college, &major, &verificationCode, &verificationCodeExpires, &resetCode, &resetCodeExpires, &u.CreatedAt, &u.UpdatedAt)

	if err == sql.ErrNoRows {
		return models.User{}, ErrNotFound
	}
	if err != nil {
		return models.User{}, err
	}
	if passwordHash.Valid {
		u.Password = passwordHash.String
	}
	if verificationCode.Valid {
		u.VerificationCode = verificationCode.String
	}
	if resetCode.Valid {
		u.ResetCode = resetCode.String
	}
	if verificationCodeExpires.Valid {
		u.VerificationCodeExpires = verificationCodeExpires.Time
	}
	if resetCodeExpires.Valid {
		u.ResetCodeExpires = resetCodeExpires.Time
	}
	if college.Valid {
		u.College = college.String
	}
	if major.Valid {
		u.Major = major.String
	}
	return u, nil
}

func (r *postgresRepo) Create(email, name, passwordHash string) (models.User, error) {
	now := time.Now().UTC()
	u := models.User{
		ID:            uuid.New().String(),
		Email:         email,
		Name:          name,
		Password:      passwordHash,
		EmailVerified: false,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	_, err := r.db.Exec(
		"INSERT INTO users (id, email, name, password_hash, email_verified, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
		u.ID, u.Email, u.Name, u.Password, u.EmailVerified, u.CreatedAt, u.UpdatedAt,
	)
	if err != nil {
		return models.User{}, err
	}
	return u, nil
}

func (r *postgresRepo) Update(id string, email, name *string) (models.User, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return models.User{}, err
	}
	defer tx.Rollback()

	u, err := r.Get(id)
	if err != nil {
		return models.User{}, err
	}

	if email != nil {
		u.Email = *email
	}
	if name != nil {
		u.Name = *name
	}
	u.UpdatedAt = time.Now().UTC()

	_, err = tx.Exec(
		"UPDATE users SET email = $1, name = $2, updated_at = $3 WHERE id = $4",
		u.Email, u.Name, u.UpdatedAt, id,
	)
	if err != nil {
		return models.User{}, err
	}

	if err = tx.Commit(); err != nil {
		return models.User{}, err
	}

	return r.Get(id)
}

func (r *postgresRepo) UpdateCollegeMajor(id string, college, major *string) (models.User, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return models.User{}, err
	}
	defer tx.Rollback()

	u, err := r.Get(id)
	if err != nil {
		return models.User{}, err
	}

	if college != nil {
		u.College = *college
	}
	if major != nil {
		u.Major = *major
	}
	u.UpdatedAt = time.Now().UTC()

	_, err = tx.Exec(
		"UPDATE users SET college = $1, major = $2, updated_at = $3 WHERE id = $4",
		u.College, u.Major, u.UpdatedAt, id,
	)
	if err != nil {
		return models.User{}, err
	}

	if err = tx.Commit(); err != nil {
		return models.User{}, err
	}

	return r.Get(id)
}

func (r *postgresRepo) Delete(id string) error {
	result, err := r.db.Exec("DELETE FROM users WHERE id = $1", id)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *postgresRepo) SetVerificationCode(email, code string, expiresAt time.Time) error {
	_, err := r.db.Exec(
		"UPDATE users SET verification_code = $1, verification_code_expires = $2, updated_at = $3 WHERE email = $4",
		code, expiresAt, time.Now().UTC(), email,
	)
	if err != nil {
		return err
	}
	return nil
}

func (r *postgresRepo) VerifyEmail(email, code string) error {
	var storedCode sql.NullString
	var expiresAt sql.NullTime
	err := r.db.QueryRow(
		"SELECT verification_code, verification_code_expires FROM users WHERE email = $1",
		email,
	).Scan(&storedCode, &expiresAt)

	if err == sql.ErrNoRows {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	if !storedCode.Valid || storedCode.String != code {
		return errors.New("invalid verification code")
	}
	if !expiresAt.Valid {
		return errors.New("verification code expired")
	}
	// Use UTC for comparison to avoid timezone issues
	if time.Now().UTC().After(expiresAt.Time) {
		return errors.New("verification code expired")
	}

	_, err = r.db.Exec(
		"UPDATE users SET email_verified = TRUE, verification_code = NULL, verification_code_expires = NULL, updated_at = $1 WHERE email = $2",
		time.Now().UTC(), email,
	)
	return err
}

func (r *postgresRepo) MarkEmailVerified(email string) error {
	_, err := r.db.Exec(
		"UPDATE users SET email_verified = TRUE, updated_at = $1 WHERE email = $2",
		time.Now().UTC(), email,
	)
	if err != nil {
		return err
	}
	return nil
}

func (r *postgresRepo) SetResetCode(email, code string, expiresAt time.Time) error {
	_, err := r.db.Exec(
		"UPDATE users SET reset_code = $1, reset_code_expires = $2, updated_at = $3 WHERE email = $4",
		code, expiresAt, time.Now().UTC(), email,
	)
	if err != nil {
		return err
	}
	return nil
}

func (r *postgresRepo) ResetPassword(email, code, newPasswordHash string) error {
	var storedCode sql.NullString
	var expiresAt sql.NullTime
	err := r.db.QueryRow(
		"SELECT reset_code, reset_code_expires FROM users WHERE email = $1",
		email,
	).Scan(&storedCode, &expiresAt)

	if err == sql.ErrNoRows {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	if !storedCode.Valid || storedCode.String != code {
		return errors.New("invalid reset code")
	}
	if !expiresAt.Valid {
		return errors.New("reset code expired")
	}
	// Use UTC for comparison to avoid timezone issues
	if time.Now().UTC().After(expiresAt.Time) {
		return errors.New("reset code expired")
	}

	_, err = r.db.Exec(
		"UPDATE users SET password_hash = $1, reset_code = NULL, reset_code_expires = NULL, updated_at = $2 WHERE email = $3",
		newPasswordHash, time.Now().UTC(), email,
	)
	return err
}

func (r *postgresRepo) Close() error {
	return r.db.Close()
}
