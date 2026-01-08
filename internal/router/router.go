package router

import (
	"fmt"
	"altoai_mvp/internal/auth"
	"altoai_mvp/internal/handlers"
	"altoai_mvp/internal/middleware"
	"altoai_mvp/internal/repository"
	"altoai_mvp/internal/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

func New() (*gin.Engine, error) {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery(), middleware.RequestLogger())

	// wiring (DI) - Use PostgreSQL repository
	userRepo, err := repository.NewPostgresRepo()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize PostgreSQL: %v", err)
	}

	userSvc := services.NewUserService(userRepo)
	authSvc := services.NewAuthService(userRepo)
	userH := handlers.NewUserHandler(userSvc)
	authH := handlers.NewAuthHandler(authSvc)
	chatH := handlers.NewChatHandler(userSvc)

	// Initialize Google auth with the user repository
	auth.SetUserRepo(userRepo)

	// health endpoint (supports both GET and HEAD for health checks)
	r.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })
	r.HEAD("/health", func(c *gin.Context) { c.Status(200) })

	// Serve static files from frontend/dist
	r.Static("/assets", "./frontend/dist/assets")
	r.StaticFile("/vite.svg", "./frontend/dist/vite.svg")
	
	// Serve index.html for all non-API routes (React Router)
	r.NoRoute(func(c *gin.Context) {
		// Don't serve index.html for API routes
		path := c.Request.URL.Path
		if len(path) >= 4 && path[:4] == "/api" {
			c.JSON(404, gin.H{"error": "Not found"})
			return
		}
		// Don't serve index.html for auth/google routes (they're handled separately)
		if len(path) >= 5 && path[:5] == "/auth" {
			c.JSON(404, gin.H{"error": "Not found"})
			return
		}
		// Don't serve index.html for .well-known paths (used by Let's Encrypt, etc.)
		if len(path) >= 11 && path[:11] == "/.well-known" {
			c.JSON(404, gin.H{"error": "Not found"})
			return
		}
		c.File("./frontend/dist/index.html")
	})

	// AUTH - Google
	r.GET("/auth/google", auth.HandleGoogleLogin)
	r.GET("/auth/google/callback", auth.HandleGoogleCallback)
	
	// User info endpoint (requires auth)
	r.GET("/me", middleware.JWTAuth(), func(c *gin.Context) {
		claims := c.MustGet("user").(*middleware.MyClaims)
		// Get full user data from database
		dbUser, err := userSvc.GetByEmail(c.Request.Context(), claims.Email)
		if err != nil {
			// Fallback to claims if user not found in DB
			c.JSON(http.StatusOK, gin.H{
				"email": claims.Email,
				"name": claims.Name,
				"picture": claims.Picture,
				"college": "",
				"major": "",
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"email": dbUser.Email,
			"name": dbUser.Name,
			"picture": claims.Picture,
			"college": dbUser.College,
			"major": dbUser.Major,
		})
	})

	// versioned API
	v1 := r.Group("/api/v1")
	{
		// Auth routes
		v1.POST("/auth/login", authH.Login)
		v1.POST("/auth/register", authH.Register)
		v1.POST("/auth/verify-email", authH.VerifyEmail)
		v1.POST("/auth/refresh", authH.Refresh) // No auth middleware needed
		v1.POST("/auth/logout", authH.Logout)
		v1.POST("/auth/forgot-password", authH.ForgotPassword)
		v1.POST("/auth/reset-password", authH.ResetPassword)
		v1.POST("/auth/resend-verification", authH.ResendVerificationCode)
		
		// User routes
		v1.GET("/users", userH.List)
		v1.POST("/users", userH.Create)
		v1.GET("/users/:id", userH.Get)
		v1.PUT("/users/:id", middleware.JWTAuth(), userH.Update)
		v1.DELETE("/users/:id", userH.Delete)
		v1.PUT("/users/me/profile", middleware.JWTAuth(), userH.UpdateProfile)
		
		// Chat route (requires auth)
		v1.POST("/chat", middleware.JWTAuth(), chatH.Chat)
	}

	return r, nil
}
