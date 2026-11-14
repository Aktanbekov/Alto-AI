package repository

import (
	"database/sql"
	"fmt"
)

// SettingsRepo is a small key-value store for settings an admin changes from
// the panel rather than through a deploy - today, which Telegram chat receives
// new payment requests.
type SettingsRepo interface {
	Get(key string) (string, error) // "" when unset
	Set(key, value string) error
	Delete(key string) error
}

type settingsRepo struct{ db *sql.DB }

func NewSettingsRepo(db *sql.DB) SettingsRepo { return &settingsRepo{db: db} }

func EnsureSettingsSchema(db *sql.DB) error {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS app_settings (
		key        VARCHAR(64) PRIMARY KEY,
		value      TEXT        NOT NULL,
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
	if err != nil {
		return fmt.Errorf("settings schema: %w", err)
	}
	return nil
}

func (r *settingsRepo) Get(key string) (string, error) {
	var v string
	err := r.db.QueryRow(`SELECT value FROM app_settings WHERE key = $1`, key).Scan(&v)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return v, err
}

func (r *settingsRepo) Set(key, value string) error {
	_, err := r.db.Exec(`
		INSERT INTO app_settings (key, value) VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, key, value)
	return err
}

func (r *settingsRepo) Delete(key string) error {
	_, err := r.db.Exec(`DELETE FROM app_settings WHERE key = $1`, key)
	return err
}
