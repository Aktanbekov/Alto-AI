package services

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"altoai_mvp/internal/models"
	"altoai_mvp/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthService interface {
	Login(ctx context.Context, dto models.LoginDTO) (string, string, *models.User, error) // accessToken, refreshToken, user, error
	Register(ctx context.Context, dto models.CreateUserDTO) error
	VerifyEmail(ctx context.Context, dto models.VerifyEmailDTO) (string, string, *models.User, error) // accessToken, refreshToken, user, error
	ResendVerificationCode(ctx context.Context, dto models.ResendVerificationDTO) error
	ForgotPassword(ctx context.Context, dto models.ForgotPasswordDTO) error
	ResetPassword(ctx context.Context, dto models.ResetPasswordDTO) error
	RefreshToken(ctx context.Context, refreshTokenString string) (string, string, error) // newAccessToken, newRefreshToken, error
}

type authService struct {
	userRepo repository.UserRepo
	emailSvc EmailService
}

func NewAuthService(userRepo repository.UserRepo) AuthService {
	return &authService{
		userRepo: userRepo,
		emailSvc: NewEmailService(),
	}
}

func (s *authService) hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func (s *authService) comparePassword(hashedPassword, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
}

func (s *authService) generateAccessToken(user models.User) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "", errors.New("JWT_SECRET not set")
	}

	// Get expiration from env or default to 30 minutes
	expiryStr := os.Getenv("ACCESS_TOKEN_EXPIRY")
	if expiryStr == "" {
		expiryStr = "30m"
	}
	
	var expiry time.Duration
	if expiryStr[len(expiryStr)-1] == 'm' {
		minutes := 30
		if len(expiryStr) > 1 {
			_, _ = fmt.Sscanf(expiryStr[:len(expiryStr)-1], "%d", &minutes)
		}
		expiry = time.Duration(minutes) * time.Minute
	} else {
		expiry = 30 * time.Minute // default
	}

	claims := jwt.MapClaims{
		"email":   user.Email,
		"name":    user.Name,
		"picture": "",
		"exp":     time.Now().Add(expiry).Unix(),
		"iat":     time.Now().Unix(),
		"iss":     "altoai_mvp",
		"type":    "access",
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func (s *authService) generateRefreshToken(user models.User) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "", errors.New("JWT_SECRET not set")
	}

	// Get expiration from env or default to 30 days
	expiryStr := os.Getenv("REFRESH_TOKEN_EXPIRY")
	if expiryStr == "" {
		expiryStr = "720h" // 30 days
	}
	
	var expiry time.Duration
	if expiryStr[len(expiryStr)-1] == 'h' {
		hours := 720
		if len(expiryStr) > 1 {
			_, _ = fmt.Sscanf(expiryStr[:len(expiryStr)-1], "%d", &hours)
		}
		expiry = time.Duration(hours) * time.Hour
	} else {
		expiry = 30 * 24 * time.Hour // default 30 days
	}

	claims := jwt.MapClaims{
		"email":   user.Email,
		"name":    user.Name,
		"picture": "",
		"exp":     time.Now().Add(expiry).Unix(),
		"iat":     time.Now().Unix(),
		"iss":     "altoai_mvp",
		"type":    "refresh",
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func (s *authService) Login(ctx context.Context, dto models.LoginDTO) (string, string, *models.User, error) {
	user, err := s.userRepo.GetByEmail(dto.Email)
	if err != nil {
		if err == repository.ErrNotFound {
			return "", "", nil, errors.New("invalid email or password")
		}
		return "", "", nil, err
	}

	// Check if email is verified
	if !user.EmailVerified {
		return "", "", nil, errors.New("email not verified. Please check your email for verification code")
	}

	// Check if user has a password (OAuth users might not have one)
	if user.Password == "" {
		return "", "", nil, errors.New("invalid email or password")
	}

	// Verify password
	if err := s.comparePassword(user.Password, dto.Password); err != nil {
		return "", "", nil, errors.New("invalid email or password")
	}

	// Generate access and refresh tokens
	accessToken, err := s.generateAccessToken(user)
	if err != nil {
		return "", "", nil, err
	}

	refreshToken, err := s.generateRefreshToken(user)
	if err != nil {
		return "", "", nil, err
	}

	return accessToken, refreshToken, &user, nil
}

func (s *authService) Register(ctx context.Context, dto models.CreateUserDTO) error {
	// Password is required for registration
	if dto.Password == "" {
		return errors.New("password is required")
	}

	// Check if user already exists
	_, err := s.userRepo.GetByEmail(dto.Email)
	if err == nil {
		return errors.New("user with this email already exists")
	}
	if err != repository.ErrNotFound {
		return err
	}

	// Hash password
	passwordHash, err := s.hashPassword(dto.Password)
	if err != nil {
		return err
	}

	// Create user
	user, err := s.userRepo.Create(dto.Email, dto.Name, passwordHash)
	if err != nil {
		return err
	}

	// Generate verification code
	code, err := s.emailSvc.GenerateCode()
	if err != nil {
		return err
	}

	// Set verification code (expires in 15 minutes) - use UTC
	expiresAt := time.Now().UTC().Add(15 * time.Minute)
	if err := s.userRepo.SetVerificationCode(user.Email, code, expiresAt); err != nil {
		return err
	}

	// Send verification email (non-blocking - don't fail registration if email fails)
	// User is created successfully and can verify using resend verification code later
	if err := s.emailSvc.SendVerificationCode(user.Email, user.Name, code); err != nil {
		// Log the error but don't fail registration
		// The user is created and can verify their email later using resend verification
		fmt.Printf("[WARNING] Failed to send verification email to %s: %v\n", user.Email, err)
		fmt.Printf("[INFO] Verification code for %s: %s (expires in 15 minutes)\n", user.Email, code)
	}

	return nil
}

func (s *authService) VerifyEmail(ctx context.Context, dto models.VerifyEmailDTO) (string, string, *models.User, error) {
	// Verify the code
	if err := s.userRepo.VerifyEmail(dto.Email, dto.Code); err != nil {
		return "", "", nil, err
	}

	// Get the verified user
	user, err := s.userRepo.GetByEmail(dto.Email)
	if err != nil {
		return "", "", nil, err
	}

	// Generate access and refresh tokens
	accessToken, err := s.generateAccessToken(user)
	if err != nil {
		return "", "", nil, err
	}

	refreshToken, err := s.generateRefreshToken(user)
	if err != nil {
		return "", "", nil, err
	}

	return accessToken, refreshToken, &user, nil
}

func (s *authService) ResendVerificationCode(ctx context.Context, dto models.ResendVerificationDTO) error {
	// Check if user exists
	user, err := s.userRepo.GetByEmail(dto.Email)
	if err != nil {
		if err == repository.ErrNotFound {
			// Don't reveal if user exists or not for security
			return nil
		}
		return err
	}

	// Check if email is already verified
	if user.EmailVerified {
		return errors.New("email is already verified")
	}

	// Generate new verification code
	code, err := s.emailSvc.GenerateCode()
	if err != nil {
		return err
	}

	// Set verification code (expires in 15 minutes) - use UTC
	expiresAt := time.Now().UTC().Add(15 * time.Minute)
	if err := s.userRepo.SetVerificationCode(user.Email, code, expiresAt); err != nil {
		return err
	}

	// Send verification email
	if err := s.emailSvc.SendVerificationCode(user.Email, user.Name, code); err != nil {
		return errors.New("failed to send verification email")
	}

	return nil
}

func (s *authService) ForgotPassword(ctx context.Context, dto models.ForgotPasswordDTO) error {
	// Check if user exists
	user, err := s.userRepo.GetByEmail(dto.Email)
	if err != nil {
		if err == repository.ErrNotFound {
			// Don't reveal if user exists or not for security
			return nil
		}
		return err
	}

	// Generate reset code
	code, err := s.emailSvc.GenerateCode()
	if err != nil {
		return err
	}

	// Set reset code (expires in 15 minutes) - use UTC
	expiresAt := time.Now().UTC().Add(15 * time.Minute)
	if err := s.userRepo.SetResetCode(user.Email, code, expiresAt); err != nil {
		return err
	}

	// Send reset email
	if err := s.emailSvc.SendPasswordResetCode(user.Email, user.Name, code); err != nil {
		return errors.New("failed to send reset email")
	}

	return nil
}

func (s *authService) ResetPassword(ctx context.Context, dto models.ResetPasswordDTO) error {
	// Verify reset code and update password
	passwordHash, err := s.hashPassword(dto.Password)
	if err != nil {
		return err
	}

	if err := s.userRepo.ResetPassword(dto.Email, dto.Code, passwordHash); err != nil {
		return err
	}

	return nil
}

func (s *authService) RefreshToken(ctx context.Context, refreshTokenString string) (string, string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "", "", errors.New("JWT_SECRET not set")
	}

	// Parse and validate refresh token (ignore access token completely)
	token, err := jwt.Parse(refreshTokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})

	if err != nil || !token.Valid {
		return "", "", errors.New("invalid refresh token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", "", errors.New("invalid token claims")
	}

	// Verify this is a refresh token (not an access token)
	tokenType, ok := claims["type"].(string)
	if !ok || tokenType != "refresh" {
		return "", "", errors.New("invalid token type")
	}

	// Get user email from claims
	email, ok := claims["email"].(string)
	if !ok {
		return "", "", errors.New("invalid token claims")
	}

	// Get user from database
	user, err := s.userRepo.GetByEmail(email)
	if err != nil {
		return "", "", errors.New("user not found")
	}

	// Generate new access and refresh tokens (rotation)
	newAccessToken, err := s.generateAccessToken(user)
	if err != nil {
		return "", "", err
	}

	newRefreshToken, err := s.generateRefreshToken(user)
	if err != nil {
		return "", "", err
	}

	return newAccessToken, newRefreshToken, nil
}
