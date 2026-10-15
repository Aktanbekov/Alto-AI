package tests

import (
	"altoai_mvp/internal/middleware"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCORS(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(middleware.CORS())
	r.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "ok"})
	})

	tests := []struct {
		name           string
		origin         string
		expectedOrigin string
		method         string
	}{
		{"No origin header", "", "", "GET"},
		{"localhost:5173", "http://localhost:5173", "http://localhost:5173", "GET"},
		{"localhost:3000", "http://localhost:3000", "http://localhost:3000", "GET"},
		{"Configured frontend", "https://alto-ai.vercel.app", "https://alto-ai.vercel.app", "GET"},
		{"Additional configured frontend", "https://alto-ai-preview.vercel.app", "https://alto-ai-preview.vercel.app", "GET"},
		{"Untrusted origin", "https://attacker.example", "", "GET"},
		{"OPTIONS request", "http://localhost:5173", "http://localhost:5173", "OPTIONS"},
	}
	t.Setenv("FRONTEND_URL", "https://alto-ai.vercel.app/app")
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://alto-ai-preview.vercel.app, not-a-url")

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/test", nil)
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}
			w := httptest.NewRecorder()

			r.ServeHTTP(w, req)

			if tt.method == "OPTIONS" {
				if w.Code != http.StatusNoContent {
					t.Errorf("Expected status %d, got %d", http.StatusNoContent, w.Code)
				}
			} else {
				origin := w.Header().Get("Access-Control-Allow-Origin")
				if origin != tt.expectedOrigin {
					t.Errorf("Expected origin %s, got %s", tt.expectedOrigin, origin)
				}
				credentials := w.Header().Get("Access-Control-Allow-Credentials")
				if credentials != "true" {
					t.Errorf("Expected credentials 'true', got %s", credentials)
				}
			}
		})
	}
}
