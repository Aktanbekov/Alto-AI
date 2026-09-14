package main

import (
	"altoai_mvp/internal/middleware"
	"altoai_mvp/internal/router"
	"altoai_mvp/interview"
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
)

func init() {
	// Only try to load .env file in development (when running locally)
	// In Docker, environment variables are set by docker-compose via env_file
	if os.Getenv("GIN_MODE") != "release" {
		if err := godotenv.Load(); err != nil {
			// Silently ignore - env vars may be set via environment
		}
	}

	// Initialize interview questions
	if err := interview.InitQuestions(); err != nil {
		log.Printf("⚠️ Warning: Failed to load interview questions: %v", err)
		log.Println("⚠️ Interview functionality may not work correctly")
	} else {
		log.Println("✅ Interview questions loaded successfully")
	}
}

func main() {
	r, err := router.New()
	if err != nil {
		log.Fatalf("Failed to initialize router: %v", err)
	}

	handler := middleware.CORSLegacy(r)
	addr := listenAddress()
	srv := &http.Server{
		Addr:         addr,
		Handler:      handler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("HTTP server listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	// graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	<-quit
	log.Println("Shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	log.Println("Server exited")
}

// listenAddress honours the dynamic port assigned by platforms such as
// Vercel. Local and Docker deployments keep their established port when the
// platform does not provide one.
func listenAddress() string {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	return ":" + port
}
