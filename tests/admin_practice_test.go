package tests

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"altoai_mvp/internal/handlers"
	"altoai_mvp/internal/middleware"
	"altoai_mvp/internal/models"
	"altoai_mvp/internal/repository"
	"altoai_mvp/internal/services"
	"altoai_mvp/internal/visallm"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type exhaustedPracticeRepo struct {
	repository.EvaluationRepo
	saved int
}

func (r *exhaustedPracticeRepo) SetsUsed(repository.Subject) (int, int, error) {
	return 7, 100, nil // Exceeds both the free allowance and the repeat-scoring cap.
}

func (r *exhaustedPracticeRepo) ClaimForUser(string, string) error { return nil }

func (r *exhaustedPracticeRepo) Save(repository.StoredEvaluation) (string, error) {
	r.saved++
	return "test-evaluation", nil
}

type practiceUsers struct{ services.UserService }

func (practiceUsers) GetByEmail(_ context.Context, email string) (models.User, error) {
	return models.User{ID: "test-user", Email: email}, nil
}

func TestOnlyAuthenticatedAdminsHaveUnlimitedPractice(t *testing.T) {
	const admin = "aktaiaktan@gmail.com"
	const secret = "admin-practice-test-secret"
	t.Setenv("ADMIN_EMAILS", admin)
	t.Setenv("JWT_SECRET", secret)

	for _, tc := range []struct {
		name      string
		email     string
		unlimited bool
	}{
		{"admin", admin, true},
		{"admin mixed case", "AKTAIAKTAN@gmail.com", true},
		{"ordinary account", "student@example.com", false},
		{"guest claiming admin in request", "", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := &exhaustedPracticeRepo{}
			spy := &modelSpy{}
			sidecar := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/api/health" {
					w.Header().Set("Content-Type", "application/json")
					_, _ = w.Write([]byte(`{"api_key_configured":true}`))
					return
				}
				spy.handler()(w, r)
			}))
			t.Cleanup(sidecar.Close)
			users := practiceUsers{}
			evaluate := handlers.NewEvaluateHandler(
				&visallm.Client{BaseURL: sidecar.URL, HTTP: sidecar.Client()},
				users, nil, repo, nil, nil)
			access := handlers.NewAccessHandler(repo, nil, users, nil)
			gin.SetMode(gin.TestMode)
			router := gin.New()
			router.Use(middleware.OptionalJWT())
			router.GET("/access", access.State)
			router.GET("/status", evaluate.Status)
			router.POST("/evaluate", evaluate.Evaluate)

			var token string
			if tc.email != "" {
				claims := middleware.MyClaims{
					Email: tc.email, Type: "access",
					RegisteredClaims: jwt.RegisteredClaims{
						ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
					},
				}
				var err error
				token, err = jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
				if err != nil {
					t.Fatal(err)
				}
			}
			do := func(method, path, body string) *httptest.ResponseRecorder {
				req := httptest.NewRequest(method, path, strings.NewReader(body))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("X-User-Email", admin)
				if token != "" {
					req.Header.Set("Authorization", "Bearer "+token)
				}
				w := httptest.NewRecorder()
				router.ServeHTTP(w, req)
				return w
			}

			for _, path := range []string{"/access", "/status"} {
				w := do(http.MethodGet, path, "")
				var response struct{ Data json.RawMessage }
				if w.Code != http.StatusOK || json.Unmarshal(w.Body.Bytes(), &response) != nil {
					t.Fatalf("%s: %d %s", path, w.Code, w.Body.String())
				}
				data := response.Data
				if path == "/status" {
					var status struct{ Access json.RawMessage }
					if err := json.Unmarshal(data, &status); err != nil {
						t.Fatal(err)
					}
					data = status.Access
				}
				var state struct {
					Unlimited bool `json:"unlimited"`
					Used      int  `json:"sets_used"`
					Remaining int  `json:"sets_remaining"`
				}
				if err := json.Unmarshal(data, &state); err != nil {
					t.Fatal(err)
				}
				if state.Unlimited != tc.unlimited || state.Used != 7 || state.Remaining != 0 {
					t.Fatalf("%s: unexpected access state %+v", path, state)
				}
			}

			// A caller-controlled email or unlimited flag must never grant access.
			body := `{"email":"aktaiaktan@gmail.com","unlimited":true,"set_index":8,"planned_answers":[{"question":"Q","answer":"A"}]}`
			w := do(http.MethodPost, "/evaluate", body)
			want := http.StatusForbidden
			if tc.unlimited {
				want = http.StatusOK
			}
			if w.Code != want {
				t.Fatalf("evaluate: want %d, got %d: %s", want, w.Code, w.Body.String())
			}
			if tc.unlimited && repo.saved != 1 {
				t.Fatal("admin evaluations must still be saved")
			}
			if !tc.unlimited && len(spy.seen) != 0 {
				t.Fatal("an exhausted non-admin must not trigger paid model calls")
			}
		})
	}
}
