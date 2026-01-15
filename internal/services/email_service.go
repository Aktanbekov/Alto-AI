package services

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"net/smtp"
	"os"
)

type EmailService interface {
	SendVerificationCode(email, name, code string) error
	SendPasswordResetCode(email, name, code string) error
	GenerateCode() (string, error)
}

type emailService struct {
	smtpHost     string
	smtpPort     string
	smtpUser     string
	smtpPassword string
	fromEmail    string
}

func NewEmailService() EmailService {
	return &emailService{
		smtpHost:     os.Getenv("SMTP_HOST"),
		smtpPort:     os.Getenv("SMTP_PORT"),
		smtpUser:     os.Getenv("SMTP_USER"),
		smtpPassword: os.Getenv("SMTP_PASSWORD"),
		fromEmail:    os.Getenv("SMTP_FROM_EMAIL"),
	}
}

func (s *emailService) GenerateCode() (string, error) {
	// Generate a random 6-digit code (000000-999999)
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func (s *emailService) sendEmail(to, subject, body string) error {
	// If SMTP is not configured, log and return error
	if s.smtpHost == "" || s.smtpPort == "" {
		fmt.Printf("[EMAIL] SMTP not configured. Would send to: %s, Subject: %s\n%s\n", to, subject, body)
		return fmt.Errorf("SMTP not configured: SMTP_HOST and SMTP_PORT must be set")
	}
	
	// Check if SMTP credentials are provided
	if s.smtpUser == "" || s.smtpPassword == "" {
		fmt.Printf("[EMAIL] SMTP credentials missing. Would send to: %s, Subject: %s\n%s\n", to, subject, body)
		return fmt.Errorf("SMTP credentials not configured: SMTP_USER and SMTP_PASSWORD must be set")
	}

	from := s.fromEmail
	if from == "" {
		from = s.smtpUser
	}

	addr := fmt.Sprintf("%s:%s", s.smtpHost, s.smtpPort)
	auth := smtp.PlainAuth("", s.smtpUser, s.smtpPassword, s.smtpHost)

	msg := []byte(fmt.Sprintf("To: %s\r\nSubject: %s\r\n\r\n%s\r\n", to, subject, body))

	return smtp.SendMail(addr, auth, from, []string{to}, msg)
}

func (s *emailService) SendVerificationCode(email, name, code string) error {
	subject := "Verify Your Email - AI Interviewer"
	body := fmt.Sprintf(`Hello %s,

Thank you for signing up for AI Interviewer!

Your verification code is: %s

This code will expire in 15 minutes.

If you didn't create an account, please ignore this email.

Best regards,
AI Interviewer Team`, name, code)

	return s.sendEmail(email, subject, body)
}

func (s *emailService) SendPasswordResetCode(email, name, code string) error {
	subject := "Password Reset Code - AI Interviewer"
	body := fmt.Sprintf(`Hello %s,

You requested to reset your password for AI Interviewer.

Your reset code is: %s

This code will expire in 15 minutes.

If you didn't request this, please ignore this email and your password will remain unchanged.

Best regards,
AI Interviewer Team`, name, code)

	return s.sendEmail(email, subject, body)
}
