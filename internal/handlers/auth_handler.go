package handlers

import (
	"errors"

	"altoai_mvp/internal/models"
	"altoai_mvp/internal/services"
	errs "altoai_mvp/pkg/errors"
	"altoai_mvp/pkg/response"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	authSvc services.AuthService
}

func NewAuthHandler(authSvc services.AuthService) *AuthHandler {
	return &AuthHandler{authSvc: authSvc}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var dto models.LoginDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		response.ValidationError(c, errs.FromBinding(err))
		return
	}

	accessToken, refreshToken, user, err := h.authSvc.Login(c.Request.Context(), dto)
	if err != nil {
		response.Error(c, http.StatusUnauthorized, err.Error())
		return
	}

	// Set refresh token cookie (HttpOnly, Secure)
	cookieDomain := os.Getenv("COOKIE_DOMAIN")
	if cookieDomain == "" {
		cookieDomain = ""
	}
	// Refresh token expires in 30 days (720 hours)
	c.SetCookie("refresh_token", refreshToken, 30*24*60*60, "/", cookieDomain, os.Getenv("GIN_MODE") == "release", true)

	// Return access token in JSON response
	response.OK(c, gin.H{
		"access_token": accessToken,
		"user": gin.H{
			"email": user.Email,
			"name":  user.Name,
		},
	})
}

func (h *AuthHandler) Register(c *gin.Context) {
	var dto models.CreateUserDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		response.ValidationError(c, errs.FromBinding(err))
		return
	}

	emailSent, err := h.authSvc.Register(c.Request.Context(), dto)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	// The account exists either way. When the code could not be mailed, say so
	// instead of sending the user to a verification screen that will never be
	// satisfied.
	message := "Registration successful. Please check your email for verification code."
	if !emailSent {
		message = "Account created, but we could not send the verification email. Please contact support to finish activating your account."
	}

	response.OK(c, gin.H{
		"message":    message,
		"email_sent": emailSent,
	})
}

func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	var dto models.VerifyEmailDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		response.ValidationError(c, errs.FromBinding(err))
		return
	}

	accessToken, refreshToken, user, err := h.authSvc.VerifyEmail(c.Request.Context(), dto)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	// Set refresh token cookie (HttpOnly, Secure)
	cookieDomain := os.Getenv("COOKIE_DOMAIN")
	if cookieDomain == "" {
		cookieDomain = ""
	}
	// Refresh token expires in 30 days (720 hours)
	c.SetCookie("refresh_token", refreshToken, 30*24*60*60, "/", cookieDomain, os.Getenv("GIN_MODE") == "release", true)

	// Return access token in JSON response
	response.OK(c, gin.H{
		"access_token": accessToken,
		"user": gin.H{
			"email": user.Email,
			"name":  user.Name,
		},
	})
}

func (h *AuthHandler) ResendVerificationCode(c *gin.Context) {
	var dto models.ResendVerificationDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		response.ValidationError(c, errs.FromBinding(err))
		return
	}

	err := h.authSvc.ResendVerificationCode(c.Request.Context(), dto)
	if err != nil {
		// Unconfigured mail is a server-side gap, not bad input from the user.
		if errors.Is(err, services.ErrEmailNotConfigured) {
			response.Error(c, http.StatusServiceUnavailable, err.Error())
			return
		}
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	// Don't reveal if user exists or not
	response.OK(c, gin.H{
		"message": "If an account exists with this email and is not verified, a new verification code has been sent.",
	})
}

func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var dto models.ForgotPasswordDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		response.ValidationError(c, errs.FromBinding(err))
		return
	}

	err := h.authSvc.ForgotPassword(c.Request.Context(), dto)
	if err != nil {
		if errors.Is(err, services.ErrEmailNotConfigured) {
			response.Error(c, http.StatusServiceUnavailable, err.Error())
			return
		}
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	// Don't reveal if user exists or not
	response.OK(c, gin.H{
		"message": "If an account exists with this email, a password reset code has been sent.",
	})
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var dto models.ResetPasswordDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		response.ValidationError(c, errs.FromBinding(err))
		return
	}

	err := h.authSvc.ResetPassword(c.Request.Context(), dto)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.OK(c, gin.H{
		"message": "Password reset successful. You can now login with your new password.",
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	// Clear the refresh token cookie
	cookieDomain := os.Getenv("COOKIE_DOMAIN")
	if cookieDomain == "" {
		cookieDomain = ""
	}
	c.SetCookie("refresh_token", "", -1, "/", cookieDomain, os.Getenv("GIN_MODE") == "release", true)
	c.Status(http.StatusNoContent)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	// Get refresh token from cookie (ignore any access token)
	refreshToken, err := c.Cookie("refresh_token")
	if err != nil {
		response.Error(c, http.StatusUnauthorized, "no refresh token found")
		return
	}

	newAccessToken, newRefreshToken, err := h.authSvc.RefreshToken(c.Request.Context(), refreshToken)
	if err != nil {
		response.Error(c, http.StatusUnauthorized, err.Error())
		return
	}

	// Set new refresh token cookie
	cookieDomain := os.Getenv("COOKIE_DOMAIN")
	if cookieDomain == "" {
		cookieDomain = ""
	}
	// Refresh token expires in 30 days (720 hours)
	c.SetCookie("refresh_token", newRefreshToken, 30*24*60*60, "/", cookieDomain, os.Getenv("GIN_MODE") == "release", true)

	// Return new access token in JSON response
	response.OK(c, gin.H{
		"access_token": newAccessToken,
	})
}
