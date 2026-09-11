package main

import (
	"altoai_mvp/internal/middleware"
	"altoai_mvp/internal/router"
	"altoai_mvp/internal/visallm"
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
	srv := &http.Server{
		Addr:        ":8080",
		Handler:     handler,
		ReadTimeout: 10 * time.Second,
		// Derived from the evaluation timeout rather than written as its own
		// number, because the ordering between the two is load-bearing.
		//
		// WriteTimeout is measured from the moment the request arrives, so it
		// covers the account lookup and the entitlement queries as well as the
		// call to the sidecar. When it expires Go closes the connection without
		// writing anything — the handler never gets to send its error, and Caddy
		// turns the dropped upstream into a bare 502 with an empty body. That is
		// what "Evaluation failed (502)" on the results page was: not a scoring
		// failure, but the server hanging up on a scoring run still in progress.
		//
		// Both numbers used to be 120s, which looks safe and is not: the write
		// deadline starts first, so it always won the race.
		WriteTimeout: visallm.EvaluateTimeout + 60*time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Println("HTTP server listening on :8080")
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
