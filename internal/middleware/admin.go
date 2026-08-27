package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// adminEmails returns the set of emails allowed admin access, read from the
// ADMIN_EMAILS environment variable (comma-separated). Comparison is
// case-insensitive because Google may return a differently-cased address than
// the one configured.
func adminEmails() map[string]bool {
	raw := os.Getenv("ADMIN_EMAILS")
	set := make(map[string]bool)
	for _, e := range strings.Split(raw, ",") {
		e = strings.ToLower(strings.TrimSpace(e))
		if e != "" {
			set[e] = true
		}
	}
	return set
}

// IsAdminEmail reports whether the given email is on the admin allowlist.
// An empty ADMIN_EMAILS grants nobody access, so a misconfigured deployment
// fails closed rather than exposing the panel to every logged-in user.
func IsAdminEmail(email string) bool {
	if email == "" {
		return false
	}
	return adminEmails()[strings.ToLower(strings.TrimSpace(email))]
}

// AdminOnly must run after JWTAuth, which puts *MyClaims in the "user" key.
func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		val, ok := c.Get("user")
		if !ok {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		claims, ok := val.(*MyClaims)
		if !ok || !IsAdminEmail(claims.Email) {
			// 404 rather than 403: don't confirm the admin API exists to
			// non-admins probing for it.
			c.AbortWithStatus(http.StatusNotFound)
			return
		}
		c.Next()
	}
}
