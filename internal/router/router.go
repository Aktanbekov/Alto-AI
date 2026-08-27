package router

import (
	"altoai_mvp/internal/auth"
	"altoai_mvp/internal/handlers"
	"altoai_mvp/internal/middleware"
	"altoai_mvp/internal/repository"
	"altoai_mvp/internal/services"
	"altoai_mvp/internal/visallm"
	"fmt"
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

	// Interview results share the user repository's connection pool.
	dbProvider, ok := userRepo.(repository.DBProvider)
	if !ok {
		return nil, fmt.Errorf("user repository does not expose a database handle")
	}
	interviewRepo, err := repository.NewInterviewRepo(dbProvider.DB())
	if err != nil {
		return nil, fmt.Errorf("failed to initialize interview storage: %v", err)
	}

	// Product analytics share the same pool.
	if err := repository.EnsureAnalyticsSchema(dbProvider.DB()); err != nil {
		return nil, fmt.Errorf("failed to initialize analytics storage: %v", err)
	}
	analyticsRepo := repository.NewAnalyticsRepo(dbProvider.DB())

	// Submitted profiles, answers and generated reports. Private, user-linked,
	// and deletable — the counterpart to the non-identifying event stream.
	if err := repository.EnsureEvaluationSchema(dbProvider.DB()); err != nil {
		return nil, fmt.Errorf("failed to initialize evaluation storage: %v", err)
	}
	evalRepo := repository.NewEvaluationRepo(dbProvider.DB())

	userSvc := services.NewUserService(userRepo)
	authSvc := services.NewAuthService(userRepo)
	userH := handlers.NewUserHandler(userSvc)
	authH := handlers.NewAuthHandler(authSvc)
	chatH := handlers.NewChatHandler(userSvc, interviewRepo)
	// Shared by both handlers: the evaluate path writes failures the student was
	// not shown, the admin path reads them.
	evalIncidents := visallm.NewIncidentLog()
	adminH := handlers.NewAdminHandler(userRepo, interviewRepo, evalIncidents)
	evaluateH := handlers.NewEvaluateHandler(
		visallm.New(), userSvc, evalIncidents, evalRepo, analyticsRepo)
	analyticsH := handlers.NewAnalyticsHandler(analyticsRepo, userSvc)
	adminAnalyticsH := handlers.NewAdminAnalyticsHandler(analyticsRepo, evalRepo)
	statsH := handlers.NewStatsHandler()
	questionsH := handlers.NewQuestionsHandler()

	// Initialize Google auth with the user repository
	auth.SetUserRepo(userRepo)

	// health endpoint (supports both GET and HEAD for health checks)
	r.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })
	r.HEAD("/health", func(c *gin.Context) { c.Status(200) })

	// Serve static files from frontend/dist
	r.Static("/assets", "./frontend/dist/assets")
	r.StaticFile("/vite.svg", "./frontend/dist/vite.svg")
	r.StaticFile("/logo.svg", "./frontend/dist/logo.svg")
	r.StaticFile("/logo.png", "./frontend/dist/logo.png")

	// AUTH - Google (must be registered before NoRoute so /auth/google is never caught by SPA fallback)
	r.GET("/auth/google", auth.HandleGoogleLogin)
	r.GET("/auth/google/callback", auth.HandleGoogleCallback)

	// Serve index.html for all non-API routes (React Router)
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		if len(path) >= 4 && path[:4] == "/api" {
			c.JSON(404, gin.H{"error": "Not found"})
			return
		}
		if len(path) >= 11 && path[:11] == "/.well-known" {
			c.JSON(404, gin.H{"error": "Not found"})
			return
		}
		c.File("./frontend/dist/index.html")
	})

	// User info endpoint (requires auth)
	r.GET("/me", middleware.JWTAuth(), func(c *gin.Context) {
		claims := c.MustGet("user").(*middleware.MyClaims)
		// Get full user data from database
		dbUser, err := userSvc.GetByEmail(c.Request.Context(), claims.Email)
		if err != nil {
			// Fallback to claims if user not found in DB
			c.JSON(http.StatusOK, gin.H{
				"email":   claims.Email,
				"name":    claims.Name,
				"picture": claims.Picture,
				"college": "",
				"major":   "",
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"email":   dbUser.Email,
			"name":    dbUser.Name,
			"picture": claims.Picture,
			"college": dbUser.College,
			"major":   dbUser.Major,
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

		// User routes.
		// These expose and mutate every account, so they are admin-only.
		// Public signup goes through /auth/register, not POST /users.
		v1.GET("/users", middleware.JWTAuth(), middleware.AdminOnly(), userH.List)
		v1.POST("/users", middleware.JWTAuth(), middleware.AdminOnly(), userH.Create)
		v1.GET("/users/:id", middleware.JWTAuth(), middleware.AdminOnly(), userH.Get)
		v1.DELETE("/users/:id", middleware.JWTAuth(), middleware.AdminOnly(), userH.Delete)
		v1.PUT("/users/:id", middleware.JWTAuth(), userH.Update)
		v1.PUT("/users/me/profile", middleware.JWTAuth(), userH.UpdateProfile)

		// Chat route (requires auth)
		v1.POST("/chat", middleware.JWTAuth(), chatH.Chat)

		// Corpus statistics for the public dashboard on the landing page.
		// Deliberately unauthenticated — logged-out visitors see the charts.
		v1.GET("/stats", statsH.Get)

		// The question bank the test draws its rounds from. Also public: the
		// page loads its first three questions before asking anyone to sign in.
		// Not to be confused with admin.GET("/questions") below, which lists
		// the interview-practice questions held in the database.
		v1.GET("/questions", questionsH.Get)

		// Product analytics. Ingest is public and deliberately silent: most of
		// the funnel happens before anyone signs in, and a tracking failure must
		// never surface to the student.
		v1.POST("/events", analyticsH.Ingest)
		v1.POST("/events/identify", middleware.JWTAuth(), analyticsH.Identify)
		v1.DELETE("/events/mine", middleware.JWTAuth(), analyticsH.DeleteMine)

		// Grounded evaluation, backed by the visa-llm sidecar
		v1.GET("/evaluate/status", middleware.JWTAuth(), evaluateH.Status)
		v1.POST("/evaluate", middleware.JWTAuth(), evaluateH.Evaluate)

		// Any authenticated user may ask whether they are an admin; the
		// frontend uses this to decide whether to show the panel.
		v1.GET("/admin/me", middleware.JWTAuth(), adminH.Me)

		// Admin panel API
		admin := v1.Group("/admin", middleware.JWTAuth(), middleware.AdminOnly())
		{
			admin.GET("/stats", adminH.Stats)
			admin.GET("/evaluator-health", adminH.EvaluatorHealth)

			// The five analytics screens.
			admin.GET("/analytics/funnel", adminAnalyticsH.Funnel)
			admin.GET("/analytics/report-quality", adminAnalyticsH.ReportQuality)
			admin.GET("/analytics/coverage", adminAnalyticsH.CoverageGaps)
			admin.GET("/analytics/feedback", adminAnalyticsH.Feedback)
			admin.GET("/analytics/corpus-growth", adminAnalyticsH.CorpusGrowth)
			admin.GET("/users", adminH.ListUsers)
			admin.GET("/users/:id", adminH.GetUser)
			admin.DELETE("/users/:id", adminH.DeleteUser)
			admin.POST("/users/:id/verify", adminH.VerifyUser)
			admin.GET("/interviews", adminH.ListSessions)
			admin.GET("/interviews/:id", adminH.GetSession)
			admin.GET("/questions", adminH.ListQuestions)
			admin.PUT("/questions", adminH.UpdateQuestions)
		}
	}

	return r, nil
}
