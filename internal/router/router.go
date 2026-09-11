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
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// Extensions the SPA never serves a page for. A request for one of these that
// reached the fallback is a genuine miss - a stale asset hash, a bad link, a
// scanner - and deserves a 404 rather than a 200 that says "this page exists".
var assetExtensions = map[string]bool{
	".js": true, ".mjs": true, ".css": true, ".map": true,
	".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".svg": true,
	".webp": true, ".avif": true, ".ico": true,
	".woff": true, ".woff2": true, ".ttf": true, ".otf": true, ".eot": true,
	".json": true, ".txt": true, ".xml": true, ".webmanifest": true,
	".pdf": true, ".zip": true, ".gz": true, ".mp4": true, ".webm": true,
}

func looksLikeAsset(p string) bool {
	return assetExtensions[strings.ToLower(path.Ext(p))]
}

// routeShell returns the pre-rendered HTML file for a route, or "" when there
// isn't one and the generic shell should be served instead.
//
// The path is cleaned and confined to dist before it touches the filesystem:
// it arrives from the request line, so ".." in it must not be able to walk out
// of the served directory.
func routeShell(urlPath string) string {
	const dist = "./frontend/dist"
	clean := path.Clean("/" + strings.Trim(urlPath, "/"))
	if clean == "/" || strings.Contains(clean, "..") {
		return ""
	}
	candidate := filepath.Join(dist, filepath.FromSlash(clean), "index.html")
	root, err := filepath.Abs(dist)
	if err != nil {
		return ""
	}
	abs, err := filepath.Abs(candidate)
	if err != nil || !strings.HasPrefix(abs, root+string(os.PathSeparator)) {
		return ""
	}
	if info, err := os.Stat(abs); err != nil || info.IsDir() {
		return ""
	}
	return candidate
}

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

	// Short feedback, the unlock survey, the sets it grants, and the premium
	// waitlist — everything the progressive validation flow reads and writes.
	if err := repository.EnsureValidationSchema(dbProvider.DB()); err != nil {
		return nil, fmt.Errorf("failed to initialize validation storage: %v", err)
	}
	validationRepo := repository.NewValidationRepo(dbProvider.DB())

	// Named tracking links for the admin panel. Only the label and destination
	// live here; the traffic itself is read back out of the event stream by src.
	if err := repository.EnsureReferralSchema(dbProvider.DB()); err != nil {
		return nil, fmt.Errorf("failed to initialize referral link storage: %v", err)
	}
	referralRepo := repository.NewReferralRepo(dbProvider.DB())

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
		visallm.New(), userSvc, evalIncidents, evalRepo, analyticsRepo, validationRepo)
	accessH := handlers.NewAccessHandler(evalRepo, validationRepo, userSvc, analyticsRepo)
	analyticsH := handlers.NewAnalyticsHandler(analyticsRepo, userSvc)
	adminAnalyticsH := handlers.NewAdminAnalyticsHandler(analyticsRepo, evalRepo)
	adminLinksH := handlers.NewAdminLinksHandler(referralRepo, analyticsRepo)
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

	// Crawler files, registered as real routes.
	//
	// Without these the SPA fallback below answers /robots.txt with index.html
	// and a text/html content type, which is not a robots file at all: there is
	// then nowhere to declare the sitemap or to state a policy for the answer
	// engines that students actually ask.
	r.StaticFile("/robots.txt", "./frontend/dist/robots.txt")
	r.StaticFile("/sitemap.xml", "./frontend/dist/sitemap.xml")
	// The link-preview card. Registered explicitly so a scraper never receives
	// HTML where it asked for an image.
	r.StaticFile("/og-image.png", "./frontend/dist/og-image.png")

	// AUTH - Google (must be registered before NoRoute so /auth/google is never caught by SPA fallback)
	r.GET("/auth/google", auth.HandleGoogleLogin)
	r.GET("/auth/google/callback", auth.HandleGoogleCallback)

	// Serve index.html for all non-API routes (React Router).
	//
	// The SPA owns its own routing, so an unknown page path has to reach the
	// browser as index.html rather than a 404. A path that looks like a *file*
	// is different: nothing in the app routes to one, and answering those with
	// HTML makes every mistyped asset URL look like a real page.
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		// strings.HasPrefix, because the old length-indexed comparison could
		// never match: it sliced "/.well-known" to 11 bytes and compared it
		// against the full 12-byte literal.
		if strings.HasPrefix(path, "/api") || strings.HasPrefix(path, "/.well-known") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		if looksLikeAsset(path) {
			c.String(http.StatusNotFound, "Not found")
			return
		}
		// The SEO build emits one static HTML file per public route, each with
		// its own title, description, canonical and Open Graph tags. Serve that
		// when it exists: a crawler or a link scraper that does not run
		// JavaScript would otherwise get the homepage's tags on every URL,
		// which is the whole reason those files are generated.
		if page := routeShell(path); page != "" {
			c.File(page)
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
		v1.GET("/evaluate/status", middleware.OptionalJWT(), evaluateH.Status)
		v1.POST("/evaluate", middleware.OptionalJWT(), evaluateH.Evaluate)

		// Progressive validation: how many sets are left, the two short
		// feedback prompts, the survey that unlocks three more, and the
		// waitlist. All OptionalJWT — the flow is built to work for someone who
		// never signs up, keyed to the guest cookie instead.
		v1.GET("/access", middleware.OptionalJWT(), accessH.State)
		v1.POST("/feedback/quick", middleware.OptionalJWT(), accessH.QuickFeedback)
		v1.POST("/feedback/detail", middleware.OptionalJWT(), accessH.DetailFeedback)
		v1.POST("/survey", middleware.OptionalJWT(), accessH.Survey)
		v1.POST("/waitlist", middleware.OptionalJWT(), accessH.Waitlist)

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

			// Tracking links. GET carries the numbers as well as the rows, so
			// the screen is one request rather than a list plus a stats call.
			admin.GET("/links", adminLinksH.List)
			admin.POST("/links", adminLinksH.Create)
			admin.PUT("/links/:code", adminLinksH.Update)
			admin.POST("/links/:code/archive", adminLinksH.Archive)
			admin.DELETE("/links/:code", adminLinksH.Delete)
			admin.GET("/users", adminH.ListUsers)
			admin.GET("/users/:id", adminH.GetUser)
			admin.DELETE("/users/:id", adminH.DeleteUser)
			admin.POST("/users/:id/verify", adminH.VerifyUser)
			admin.GET("/interviews", adminH.ListSessions)
			admin.GET("/interviews/:id", adminH.GetSession)
			// Scores one profile with every comparison model at once. Admin
			// only: it spends three model calls on three vendors per press.
			admin.POST("/evaluate-compare", evaluateH.Compare)
			admin.GET("/questions", adminH.ListQuestions)
			admin.PUT("/questions", adminH.UpdateQuestions)
		}
	}

	return r, nil
}
