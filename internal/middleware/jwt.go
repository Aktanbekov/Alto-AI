package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type MyClaims struct {
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
	Type    string `json:"type"`
	jwt.RegisteredClaims
}

func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Read from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		// Extract token from "Bearer <token>"
		tok := strings.TrimPrefix(authHeader, "Bearer ")
		if tok == "" {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		claims, ok := parseAccessToken(tok)
		if !ok {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		c.Set("user", claims)
		c.Next()
	}
}

// OptionalJWT attaches valid access-token claims when present while allowing
// guest requests through. An invalid supplied token is still rejected; this
// prevents an expired account session from silently becoming a fresh guest.
func OptionalJWT() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		claims, ok := parseAccessToken(strings.TrimPrefix(authHeader, "Bearer "))
		if !ok {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		c.Set("user", claims)
		c.Next()
	}
}

func parseAccessToken(raw string) (*MyClaims, bool) {
	if raw == "" {
		return nil, false
	}
	secret := os.Getenv("JWT_SECRET")
	token, err := jwt.ParseWithClaims(raw, &MyClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return nil, false
	}
	claims, ok := token.Claims.(*MyClaims)
	if !ok || (claims.Type != "" && claims.Type != "access") {
		return nil, false
	}
	return claims, true
}
