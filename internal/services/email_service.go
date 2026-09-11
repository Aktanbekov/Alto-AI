package services

import (
	"crypto/rand"
	"crypto/tls"
	"errors"
	"fmt"
	"math/big"
	"net/smtp"
	"os"
	"time"
)

// ErrEmailNotConfigured separates "this deployment has no mail server" from
// "the mail server rejected the message". Registration keeps working in the
// first case, but the caller has to tell the user no code is coming.
var ErrEmailNotConfigured = errors.New("email delivery is not configured on this server")

type EmailService interface {
	SendVerificationCode(email, name, code string) error
	SendPasswordResetCode(email, name, code string) error
	GenerateCode() (string, error)
	// Configured reports whether SMTP credentials are present. Callers use it
	// to decide what to promise the user before attempting a send.
	Configured() bool
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

func (s *emailService) Configured() bool {
	return s.smtpHost != "" && s.smtpPort != "" && s.smtpUser != "" && s.smtpPassword != ""
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

func (s *emailService) from() string {
	if s.fromEmail != "" {
		return s.fromEmail
	}
	return s.smtpUser
}

// buildMessage assembles RFC 5322 headers. Without at least From, Date and a
// Content-Type, Gmail and Outlook either reject the message outright or file it
// as spam, which looks identical to "the code never arrived".
func (s *emailService) buildMessage(to, subject, body string) []byte {
	headers := "From: Altovisas <" + s.from() + ">\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"Date: " + time.Now().Format(time.RFC1123Z) + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/plain; charset=\"UTF-8\"\r\n" +
		"\r\n"
	return []byte(headers + body + "\r\n")
}

func (s *emailService) sendEmail(to, subject, body string) error {
	if !s.Configured() {
		// Log the body so a self-hosted or local deployment can still read the
		// code out of the server log instead of being stuck on the verify step.
		fmt.Printf("[EMAIL] SMTP not configured. Would send to: %s, Subject: %s\n%s\n", to, subject, body)
		return ErrEmailNotConfigured
	}

	addr := fmt.Sprintf("%s:%s", s.smtpHost, s.smtpPort)
	auth := smtp.PlainAuth("", s.smtpUser, s.smtpPassword, s.smtpHost)
	msg := s.buildMessage(to, subject, body)

	// Port 465 is implicit TLS: the connection is encrypted before any SMTP
	// command, so smtp.SendMail (which speaks plaintext then STARTTLS) hangs
	// on it. Ports 587 and 25 negotiate STARTTLS and go the normal route.
	if s.smtpPort == "465" {
		return s.sendEmailTLS(addr, auth, to, msg)
	}

	return smtp.SendMail(addr, auth, s.from(), []string{to}, msg)
}

func (s *emailService) sendEmailTLS(addr string, auth smtp.Auth, to string, msg []byte) error {
	conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: s.smtpHost})
	if err != nil {
		return err
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, s.smtpHost)
	if err != nil {
		return err
	}
	defer client.Quit()

	if err := client.Auth(auth); err != nil {
		return err
	}
	if err := client.Mail(s.from()); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(msg); err != nil {
		return err
	}
	return w.Close()
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
