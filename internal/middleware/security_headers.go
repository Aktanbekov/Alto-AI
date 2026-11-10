package middleware

import (
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// contentSecurityPolicy is the browser's last line of defence against XSS: even
// if some text ever reached the page as markup, a script it injects cannot run
// unless it comes from this origin or the one analytics host.
//
// Every allowance below is something the site actually loads:
//   - scripts: the built bundle (same origin) and Umami's tracker. No inline
//     scripts are allowed; the build emits none (JSON-LD blocks are data, not
//     script, and are not subject to script-src).
//   - styles: the bundle, Google Fonts' stylesheet, and inline style
//     attributes, which React components set for chart widths and bars.
//   - fonts: Google Fonts' files.
//   - images: same origin, data: URIs, and any HTTPS host (account pictures).
//   - connect: the API (same origin in production) and Umami's collector.
//   - media: recorded audio for the voice preview, played back from blob: URLs.
//
// frame-ancestors 'none' stops the site being framed (clickjacking); object-src
// and base-uri close two classic injection footholds.
var contentSecurityPolicy = strings.Join([]string{
	"default-src 'self'",
	"script-src 'self' https://cloud.umami.is",
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
	"font-src 'self' https://fonts.gstatic.com data:",
	"img-src 'self' data: https:",
	"connect-src 'self' https://cloud.umami.is https://api-gateway.umami.dev",
	"media-src 'self' blob:",
	"worker-src 'self' blob:",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'none'",
}, "; ")

// SecurityHeaders sets the response headers that harden every page and API
// response. Production (GIN_MODE=release) also gets HSTS and an upgrade of any
// stray http:// subresource; a local http://localhost run must not, or the
// browser would refuse it afterwards.
func SecurityHeaders() gin.HandlerFunc {
	release := os.Getenv("GIN_MODE") == "release"
	csp := contentSecurityPolicy
	if release {
		csp += "; upgrade-insecure-requests"
	}
	return func(c *gin.Context) {
		h := c.Writer.Header()
		h.Set("Content-Security-Policy", csp)
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		// The microphone is for the voice interview on this site only.
		h.Set("Permissions-Policy", "camera=(), geolocation=(), microphone=(self), payment=()")
		h.Set("Cross-Origin-Opener-Policy", "same-origin")
		if release {
			h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		c.Next()
	}
}
