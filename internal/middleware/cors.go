package middleware

import (
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// The analytics headers ride along on tracked requests, so a preflight that
// omits them fails the whole call — which in dev, where the frontend is on
// :5173 and the API on :8080, takes the evaluator down with it. Production is
// same-origin and never preflights, so this only ever bit local runs.
const allowedHeaders = "Content-Type, Authorization, X-Requested-With, " +
	"X-Visitor-Id, X-Session-Id, X-Src"

var developmentOrigins = map[string]struct{}{
	"http://localhost:3000": {},
	"http://localhost:5173": {},
	"http://localhost:8080": {},
	"http://127.0.0.1:3000": {},
	"http://127.0.0.1:5173": {},
}

// configuredOrigins returns the browser origins allowed to call the API.
// FRONTEND_URL is already required for OAuth redirects, so it is also the
// canonical production CORS origin. CORS_ALLOWED_ORIGINS supports additional
// deployments (for example, an explicitly trusted Vercel preview URL).
func configuredOrigins() map[string]struct{} {
	origins := make(map[string]struct{}, len(developmentOrigins)+1)
	for origin := range developmentOrigins {
		origins[origin] = struct{}{}
	}

	values := append(strings.Split(os.Getenv("CORS_ALLOWED_ORIGINS"), ","), os.Getenv("FRONTEND_URL"))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		parsed, err := url.Parse(value)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			continue
		}
		origins[parsed.Scheme+"://"+parsed.Host] = struct{}{}
	}
	return origins
}

func setCORSHeaders(headers http.Header, origin string) {
	if origin != "" {
		if _, allowed := configuredOrigins()[origin]; allowed {
			headers.Set("Access-Control-Allow-Origin", origin)
		}
		headers.Add("Vary", "Origin")
	}
	headers.Set("Access-Control-Allow-Credentials", "true")
	headers.Set("Access-Control-Allow-Headers", allowedHeaders)
	headers.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
}

// CORS returns a Gin middleware handler for CORS
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		setCORSHeaders(c.Writer.Header(), c.Request.Header.Get("Origin"))

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// Legacy CORS for http.Handler (used in main.go)
func CORSLegacy(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		setCORSHeaders(w.Header(), r.Header.Get("Origin"))
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
