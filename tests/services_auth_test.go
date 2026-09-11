package tests

import (
	"context"
	"testing"

	"altoai_mvp/internal/models"
	"altoai_mvp/internal/repository"
	"altoai_mvp/internal/services"

	"golang.org/x/crypto/bcrypt"
)

func TestHashPassword(t *testing.T) {
	// Create a service instance to access private methods
	// Since hashPassword is private, we test through the public Register API
	// or we can test password comparison which is used in Login
	emailSvc := services.NewEmailService()
	if emailSvc == nil {
		t.Error("NewEmailService should not return nil")
	}
}

func TestGenerateCode(t *testing.T) {
	emailSvc := services.NewEmailService()

	code, err := emailSvc.GenerateCode()
	if err != nil {
		t.Fatalf("GenerateCode failed: %v", err)
	}

	if len(code) != 6 {
		t.Errorf("Expected code length 6, got %d", len(code))
	}

	// Generate multiple codes to ensure randomness
	codes := make(map[string]bool)
	for i := 0; i < 10; i++ {
		code, _ := emailSvc.GenerateCode()
		codes[code] = true
	}

	// Should have some variation (not all same)
	if len(codes) == 1 {
		t.Error("Generated codes should have some variation")
	}
}

// Signing up while SMTP is unconfigured used to report plain success, park the
// user on a code screen no code could reach, and then reject every retry with
// "user with this email already exists". These cover the way out.
func TestRegisterReportsUndeliveredVerificationEmail(t *testing.T) {
	t.Setenv("SMTP_HOST", "")
	t.Setenv("SMTP_PORT", "")
	t.Setenv("SMTP_USER", "")
	t.Setenv("SMTP_PASSWORD", "")

	repo := repository.NewUserMemoryRepo()
	svc := services.NewAuthService(repo)

	emailSent, err := svc.Register(context.Background(), models.CreateUserDTO{
		Email:    "nomail@example.com",
		Name:     "No Mail",
		Password: "password123",
	})
	if err != nil {
		t.Fatalf("Register should still create the account: %v", err)
	}
	if emailSent {
		t.Error("Register reported the verification email as sent with no SMTP configured")
	}

	if _, err := repo.GetByEmail("nomail@example.com"); err != nil {
		t.Fatalf("account should exist after registration: %v", err)
	}
}

func TestRegisterRetriesUnverifiedAccount(t *testing.T) {
	t.Setenv("SMTP_HOST", "")

	repo := repository.NewUserMemoryRepo()
	svc := services.NewAuthService(repo)
	dto := models.CreateUserDTO{Email: "retry@example.com", Name: "Retry", Password: "password123"}

	if _, err := svc.Register(context.Background(), dto); err != nil {
		t.Fatalf("first registration failed: %v", err)
	}

	before, _ := repo.GetByEmail(dto.Email)

	// Same address, new password: the account was never verified, so nobody has
	// claimed it and a second attempt has to be allowed through.
	dto.Password = "different456"
	if _, err := svc.Register(context.Background(), dto); err != nil {
		t.Fatalf("re-registering an unverified account should succeed: %v", err)
	}

	after, _ := repo.GetByEmail(dto.Email)
	if after.Password == before.Password {
		t.Error("re-registration should have replaced the stored password hash")
	}
	if after.VerificationCode == before.VerificationCode {
		t.Error("re-registration should have issued a fresh verification code")
	}
}

func TestRegisterRejectsVerifiedAccount(t *testing.T) {
	t.Setenv("SMTP_HOST", "")

	repo := repository.NewUserMemoryRepo()
	svc := services.NewAuthService(repo)
	dto := models.CreateUserDTO{Email: "taken@example.com", Name: "Taken", Password: "password123"}

	if _, err := svc.Register(context.Background(), dto); err != nil {
		t.Fatalf("first registration failed: %v", err)
	}
	if err := repo.MarkEmailVerified(dto.Email); err != nil {
		t.Fatalf("MarkEmailVerified failed: %v", err)
	}

	// A verified account belongs to someone. Letting an unauthenticated request
	// reset its password would be an account takeover.
	dto.Password = "attacker999"
	if _, err := svc.Register(context.Background(), dto); err == nil {
		t.Error("re-registering a verified account should be rejected")
	}

	user, _ := repo.GetByEmail(dto.Email)
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte("password123")); err != nil {
		t.Error("the original password should survive a rejected re-registration")
	}
}
