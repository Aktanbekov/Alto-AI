package auth

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"time"

	"altoai_mvp/internal/models"
	"altoai_mvp/internal/repository"
	"altoai_mvp/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

var sharedUserRepo repository.UserRepo

// SetUserRepo sets the shared user repository for Google auth
func SetUserRepo(repo repository.UserRepo) {
	sharedUserRepo = repo
}

type googleUser struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func googleConf() *oauth2.Config {
	_ = godotenv.Load() // ok if .env not present; will use OS env

	// Get redirect URL from environment or use default
	redirectURL := os.Getenv("GOOGLE_REDIRECT_URL")
	if redirectURL == "" {
		// Default based on environment
		if os.Getenv("GIN_MODE") == "release" {
			redirectURL = "http://localhost:8080/auth/google/callback" // Docker default (same port as app)
		} else {
			redirectURL = "http://localhost:8080/auth/google/callback" // Local dev
		}
	}

	return &oauth2.Config{
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		RedirectURL:  redirectURL,
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}
}

// JWT CLAIMS
type MyClaims struct {
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
	jwt.RegisteredClaims
}

// GET /auth/google
func HandleGoogleLogin(c *gin.Context) {
	conf := googleConf()
	if conf.ClientID == "" {
		redirectToFrontendWithError(c, "Google sign-in is not configured (missing GOOGLE_CLIENT_ID). Check server .env.")
		return
	}
	redirect := c.Query("redirect")
	if redirect == "" {
		redirect = "/"
	}
	cookieDomain := os.Getenv("COOKIE_DOMAIN")
	if cookieDomain == "" {
		cookieDomain = ""
	}
	isSecure := os.Getenv("GIN_MODE") == "release"
	c.SetCookie("oauth_redirect", redirect, 300, "/", cookieDomain, isSecure, false)
	authURL := conf.AuthCodeURL("state-123", oauth2.AccessTypeOffline)
	c.Redirect(http.StatusFound, authURL)
}

// GET /auth/google/callback?code=...
func HandleGoogleCallback(c *gin.Context) {
	conf := googleConf()

	code := c.Query("code")
	if code == "" {
		redirectToFrontendWithError(c, "Google sign-in was cancelled or no code was returned.")
		return
	}

	tok, err := conf.Exchange(c, code)
	if err != nil {
		redirectToFrontendWithError(c, "Token exchange failed. Try again or use email login.")
		return
	}

	resp, err := http.Get("https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + tok.AccessToken)
	if err != nil || resp.StatusCode != http.StatusOK {
		redirectToFrontendWithError(c, "Could not fetch your Google profile. Try again.")
		return
	}
	defer resp.Body.Close()

	var gu googleUser
	if err := json.NewDecoder(resp.Body).Decode(&gu); err != nil {
		redirectToFrontendWithError(c, "Invalid response from Google. Try again.")
		return
	}

	if sharedUserRepo == nil {
		redirectToFrontendWithError(c, "Server configuration error. Please try again later.")
		return
	}

	userService := services.NewUserService(sharedUserRepo)

	// Check if user already exists
	existingUser, err := sharedUserRepo.GetByEmail(gu.Email)
	if err != nil && err != repository.ErrNotFound {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "failed to check user existence"})
		return
	}

	// If user doesn't exist, create them (OAuth users don't need password)
	if err == repository.ErrNotFound {
		_, err = userService.Create(c.Request.Context(), models.CreateUserDTO{
			Email:    gu.Email,
			Name:     gu.Name,
			Password: "", // OAuth users don't have passwords
		})
		if err != nil {
			redirectToFrontendWithError(c, "Could not create your account. Try again or use email sign up.")
			return
		}
		// Mark email as verified for OAuth users (Google already verified the email)
		err = sharedUserRepo.MarkEmailVerified(gu.Email)
		if err != nil {
			// Log but don't fail the auth flow
			_ = err
		}
	} else {
		// User exists - update their name if it changed and mark email as verified
		if existingUser.Name != gu.Name {
			_, err = userService.Update(c.Request.Context(), existingUser.ID, models.UpdateUserDTO{
				Name: &gu.Name,
			})
			if err != nil {
				// Log but don't fail the auth flow
				_ = err
			}
		}
		// Ensure OAuth users have verified email
		if !existingUser.EmailVerified {
			err = sharedUserRepo.MarkEmailVerified(gu.Email)
			if err != nil {
				// Log but don't fail the auth flow
				_ = err
			}
		}
	}

	finalUser, err := sharedUserRepo.GetByEmail(gu.Email)
	if err != nil {
		redirectToFrontendWithError(c, "Could not load your account. Try again.")
		return
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		redirectToFrontendWithError(c, "Server configuration error. Please try again later.")
		return
	}

	// Generate access token (30 minutes)
	accessExpiryStr := os.Getenv("ACCESS_TOKEN_EXPIRY")
	if accessExpiryStr == "" {
		accessExpiryStr = "30m"
	}
	var accessExpiry time.Duration
	if len(accessExpiryStr) > 0 && accessExpiryStr[len(accessExpiryStr)-1] == 'm' {
		minutes := 30
		if len(accessExpiryStr) > 1 {
			_, _ = fmt.Sscanf(accessExpiryStr[:len(accessExpiryStr)-1], "%d", &minutes)
		}
		accessExpiry = time.Duration(minutes) * time.Minute
	} else {
		accessExpiry = 30 * time.Minute
	}

	accessClaims := jwt.MapClaims{
		"email":   finalUser.Email,
		"name":    finalUser.Name,
		"picture": gu.Picture,
		"exp":     time.Now().Add(accessExpiry).Unix(),
		"iat":     time.Now().Unix(),
		"iss":     "altoai_mvp",
		"type":    "access",
	}
	accessTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessToken, err := accessTokenObj.SignedString([]byte(secret))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "could not sign access token"})
		return
	}

	// Generate refresh token (30 days)
	refreshExpiryStr := os.Getenv("REFRESH_TOKEN_EXPIRY")
	if refreshExpiryStr == "" {
		refreshExpiryStr = "720h"
	}
	var refreshExpiry time.Duration
	if len(refreshExpiryStr) > 0 && refreshExpiryStr[len(refreshExpiryStr)-1] == 'h' {
		hours := 720
		if len(refreshExpiryStr) > 1 {
			_, _ = fmt.Sscanf(refreshExpiryStr[:len(refreshExpiryStr)-1], "%d", &hours)
		}
		refreshExpiry = time.Duration(hours) * time.Hour
	} else {
		refreshExpiry = 30 * 24 * time.Hour
	}

	refreshClaims := jwt.MapClaims{
		"email":   finalUser.Email,
		"name":    finalUser.Name,
		"picture": gu.Picture,
		"exp":     time.Now().Add(refreshExpiry).Unix(),
		"iat":     time.Now().Unix(),
		"iss":     "altoai_mvp",
		"type":    "refresh",
	}
	refreshTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshToken, err := refreshTokenObj.SignedString([]byte(secret))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "could not sign refresh token"})
		return
	}

	// Get frontend URL from environment or use default
	frontendURL := os.Getenv("FRONTEND_URL")

	// In Docker/release mode, always use port 8080 (same as the app server)
	// This ensures OAuth redirects work correctly in Docker even if .env has dev server URL
	if os.Getenv("GIN_MODE") == "release" {
		// Override with Docker port if FRONTEND_URL points to dev server port
		if frontendURL == "" || frontendURL == "http://localhost:5173" || frontendURL == "http://localhost:3000" {
			frontendURL = "http://localhost:8080"
		}
	} else if frontendURL == "" {
		// Development mode - use Vite dev server
		frontendURL = "http://localhost:5173"
	}

	// Get redirect destination from cookie (set during login initiation)
	redirectPath := "/" // Default: authentication returns to the main page.
	if redirectCookie, err := c.Cookie("oauth_redirect"); err == nil && redirectCookie != "" {
		redirectPath = redirectCookie
		// Clear the cookie after reading
		cookieDomain := os.Getenv("COOKIE_DOMAIN")
		if cookieDomain == "" {
			cookieDomain = ""
		}
		isSecure := os.Getenv("GIN_MODE") == "release"
		c.SetCookie("oauth_redirect", "", -1, "/", cookieDomain, isSecure, false)
	}

	// Set refresh token cookie (HttpOnly, Secure)
	cookieDomain := os.Getenv("COOKIE_DOMAIN")
	if cookieDomain == "" {
		cookieDomain = "" // Empty means same origin
	}
	isSecure := os.Getenv("GIN_MODE") == "release"
	c.SetCookie("refresh_token", refreshToken, 30*24*60*60, "/", cookieDomain, isSecure, true)

	// Redirect to frontend with access token and redirect in query parameters
	redirectURL := frontendURL + "/?access_token=" + url.QueryEscape(accessToken) + "&redirect=" + url.QueryEscape(redirectPath)
	c.Redirect(http.StatusFound, redirectURL)
}

// getFrontendURL returns the frontend base URL for redirects.
func getFrontendURL() string {
	frontendURL := os.Getenv("FRONTEND_URL")
	if os.Getenv("GIN_MODE") == "release" {
		if frontendURL == "" || frontendURL == "http://localhost:5173" || frontendURL == "http://localhost:3000" {
			frontendURL = "http://localhost:8080"
		}
	} else if frontendURL == "" {
		frontendURL = "http://localhost:5173"
	}
	return frontendURL
}

// redirectToFrontendWithError sends the user to the frontend login page with an error query param.
func redirectToFrontendWithError(c *gin.Context, errMsg string) {
	u := getFrontendURL() + "/login?error=" + url.QueryEscape(errMsg)
	c.Redirect(http.StatusFound, u)
}
