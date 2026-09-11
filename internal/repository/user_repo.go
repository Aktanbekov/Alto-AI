package repository

import (
	"errors"
	"sync"
	"time"

	"altoai_mvp/internal/models"

	"github.com/google/uuid"
)

var ErrNotFound = errors.New("not found")

type UserRepo interface {
	List() ([]models.User, error)
	Get(id string) (models.User, error)
	GetByEmail(email string) (models.User, error)
	Create(email, name, passwordHash string) (models.User, error)
	Update(id string, email, name *string) (models.User, error)
	UpdateCollegeMajor(id string, college, major *string) (models.User, error)
	Delete(id string) error
	SetVerificationCode(email, code string, expiresAt time.Time) error
	SetPassword(email, passwordHash string) error
	VerifyEmail(email, code string) error
	MarkEmailVerified(email string) error
	SetResetCode(email, code string, expiresAt time.Time) error
	ResetPassword(email, code, newPasswordHash string) error
	Close() error
}

type userMemoryRepo struct {
	mu    sync.RWMutex
	store map[string]models.User
}

func NewUserMemoryRepo() UserRepo {
	return &userMemoryRepo{store: map[string]models.User{}}
}

func (r *userMemoryRepo) List() ([]models.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]models.User, 0, len(r.store))
	for _, u := range r.store {
		out = append(out, u)
	}
	return out, nil
}

func (r *userMemoryRepo) Get(id string) (models.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	u, ok := r.store[id]
	if !ok {
		return models.User{}, ErrNotFound
	}
	return u, nil
}

func (r *userMemoryRepo) GetByEmail(email string) (models.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, u := range r.store {
		if u.Email == email {
			return u, nil
		}
	}
	return models.User{}, ErrNotFound
}

func (r *userMemoryRepo) Create(email, name, passwordHash string) (models.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
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
	r.store[u.ID] = u
	return u, nil
}

func (r *userMemoryRepo) Update(id string, email, name *string) (models.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	u, ok := r.store[id]
	if !ok {
		return models.User{}, ErrNotFound
	}
	if email != nil {
		u.Email = *email
	}
	if name != nil {
		u.Name = *name
	}
	u.UpdatedAt = time.Now().UTC()
	r.store[id] = u
	return u, nil
}

func (r *userMemoryRepo) UpdateCollegeMajor(id string, college, major *string) (models.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	u, ok := r.store[id]
	if !ok {
		return models.User{}, ErrNotFound
	}
	if college != nil {
		u.College = *college
	}
	if major != nil {
		u.Major = *major
	}
	u.UpdatedAt = time.Now().UTC()
	r.store[id] = u
	return u, nil
}

func (r *userMemoryRepo) Delete(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.store[id]; !ok {
		return ErrNotFound
	}
	delete(r.store, id)
	return nil
}

func (r *userMemoryRepo) SetVerificationCode(email, code string, expiresAt time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, u := range r.store {
		if u.Email == email {
			u.VerificationCode = code
			u.VerificationCodeExpires = expiresAt
			u.UpdatedAt = time.Now().UTC()
			r.store[id] = u
			return nil
		}
	}
	return ErrNotFound
}

// SetPassword overwrites the stored hash without requiring a reset code.
// Register uses it when someone signs up again on an account that never got
// verified; every other caller must go through ResetPassword.
func (r *userMemoryRepo) SetPassword(email, passwordHash string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, u := range r.store {
		if u.Email == email {
			u.Password = passwordHash
			u.UpdatedAt = time.Now().UTC()
			r.store[id] = u
			return nil
		}
	}
	return ErrNotFound
}

func (r *userMemoryRepo) VerifyEmail(email, code string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, u := range r.store {
		if u.Email == email {
			if u.VerificationCode != code {
				return errors.New("invalid verification code")
			}
			if time.Now().After(u.VerificationCodeExpires) {
				return errors.New("verification code expired")
			}
			u.EmailVerified = true
			u.VerificationCode = ""
			u.VerificationCodeExpires = time.Time{}
			u.UpdatedAt = time.Now().UTC()
			r.store[id] = u
			return nil
		}
	}
	return ErrNotFound
}

func (r *userMemoryRepo) MarkEmailVerified(email string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, u := range r.store {
		if u.Email == email {
			u.EmailVerified = true
			u.UpdatedAt = time.Now().UTC()
			r.store[id] = u
			return nil
		}
	}
	return ErrNotFound
}

func (r *userMemoryRepo) SetResetCode(email, code string, expiresAt time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, u := range r.store {
		if u.Email == email {
			u.ResetCode = code
			u.ResetCodeExpires = expiresAt
			u.UpdatedAt = time.Now().UTC()
			r.store[id] = u
			return nil
		}
	}
	return ErrNotFound
}

func (r *userMemoryRepo) ResetPassword(email, code, newPasswordHash string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, u := range r.store {
		if u.Email == email {
			if u.ResetCode != code {
				return errors.New("invalid reset code")
			}
			if time.Now().After(u.ResetCodeExpires) {
				return errors.New("reset code expired")
			}
			u.Password = newPasswordHash
			u.ResetCode = ""
			u.ResetCodeExpires = time.Time{}
			u.UpdatedAt = time.Now().UTC()
			r.store[id] = u
			return nil
		}
	}
	return ErrNotFound
}

func (r *userMemoryRepo) Close() error {
	// Nothing to close for in-memory repository
	return nil
}
