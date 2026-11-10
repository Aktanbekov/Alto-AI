package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSecurityHeadersAreSetOnEveryResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(SecurityHeaders())
	r.GET("/", func(c *gin.Context) { c.String(http.StatusOK, "ok") })

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))

	csp := w.Header().Get("Content-Security-Policy")
	for _, must := range []string{
		"default-src 'self'",
		"script-src 'self' https://cloud.umami.is",
		"object-src 'none'",
		"frame-ancestors 'none'",
		"base-uri 'self'",
	} {
		if !strings.Contains(csp, must) {
			t.Errorf("CSP missing %q: %s", must, csp)
		}
	}
	// No inline or eval'd script may ever be allowed: that is what makes the
	// policy an XSS defence rather than decoration.
	scriptSrc := ""
	for _, d := range strings.Split(csp, ";") {
		if strings.HasPrefix(strings.TrimSpace(d), "script-src") {
			scriptSrc = d
		}
	}
	if strings.Contains(scriptSrc, "unsafe-inline") || strings.Contains(scriptSrc, "unsafe-eval") {
		t.Errorf("script-src must not allow inline or eval: %s", scriptSrc)
	}

	for header, want := range map[string]string{
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options":        "DENY",
		"Referrer-Policy":        "strict-origin-when-cross-origin",
	} {
		if got := w.Header().Get(header); got != want {
			t.Errorf("%s = %q, want %q", header, got, want)
		}
	}
}

func TestCORSAlwaysVariesOnOrigin(t *testing.T) {
	h := http.Header{}
	setCORSHeaders(h, "") // a same-origin request carries no Origin header
	if h.Get("Vary") != "Origin" {
		t.Errorf("Vary = %q, want Origin even without an Origin header", h.Get("Vary"))
	}
}
