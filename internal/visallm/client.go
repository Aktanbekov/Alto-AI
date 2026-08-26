// Package visallm is a thin client for the visa-llm sidecar, a Python service
// that evaluates a student's planned answers against a corpus of ~16k real
// F-1 interview reviews. Every claim it returns is grounded in that corpus
// rather than model priors, which is why it lives outside the Go codebase.
package visallm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

// Client talks to the sidecar over HTTP. A zero BaseURL means the service is
// not configured; callers should treat that as "feature unavailable" rather
// than an error, so the app still works without the sidecar deployed.
type Client struct {
	BaseURL string
	HTTP    *http.Client
}

// New reads VISA_LLM_URL. Evaluation calls an LLM behind the scenes and can
// take a while, hence the generous timeout.
func New() *Client {
	return &Client{
		BaseURL: strings.TrimRight(os.Getenv("VISA_LLM_URL"), "/"),
		HTTP:    &http.Client{Timeout: 120 * time.Second},
	}
}

// Configured reports whether a sidecar URL is set.
func (c *Client) Configured() bool { return c.BaseURL != "" }

type PlannedAnswer struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

// ProfileRequest mirrors the sidecar's pydantic ProfileRequest. Optional
// fields are omitted when empty so the service applies its own defaults.
type ProfileRequest struct {
	ConsulateCity    string            `json:"consulate_city,omitempty"`
	ConsulateCountry string            `json:"consulate_country,omitempty"`
	University       string            `json:"university,omitempty"`
	Course           string            `json:"course,omitempty"`
	DegreeLevel      string            `json:"degree_level,omitempty"`
	Major            string            `json:"major,omitempty"`
	GPA              string            `json:"gpa,omitempty"`
	GPAScale         string            `json:"gpa_scale,omitempty"`
	WorkExperience   string            `json:"work_experience,omitempty"`
	FundingSource    string            `json:"funding_source,omitempty"`
	Scholarship      string            `json:"scholarship,omitempty"`
	AttemptNumber    int               `json:"attempt_number,omitempty"`
	TestScores       map[string]string `json:"test_scores,omitempty"`
	PlannedAnswers   []PlannedAnswer   `json:"planned_answers"`
}

type AnswerFeedback struct {
	Question          string   `json:"question"`
	Verdict           string   `json:"verdict"`
	Strengths         []string `json:"strengths"`
	Risks             []string `json:"risks"`
	SuggestedRevision string   `json:"suggested_revision"`
}

type LikelyQuestion struct {
	QuestionType    string `json:"question_type"`
	ExampleQuestion string `json:"example_question"`
	AskedInShare    string `json:"asked_in_share"`
	WhyLikely       string `json:"why_likely"`
	HowToPrepare    string `json:"how_to_prepare"`
}

type RiskFactor struct {
	Factor   string `json:"factor"`
	Severity string `json:"severity"`
	Evidence string `json:"evidence"`
}

type Evaluation struct {
	Readiness            string           `json:"readiness"`
	Summary              string           `json:"summary"`
	AnswerFeedback       []AnswerFeedback `json:"answer_feedback"`
	LikelyQuestions      []LikelyQuestion `json:"likely_questions"`
	RiskFactors          []RiskFactor     `json:"risk_factors"`
	ComparableInterviews []string         `json:"comparable_interviews"`
	Caveat               string           `json:"caveat"`
}

type Health struct {
	APIKeyConfigured bool   `json:"api_key_configured"`
	Detail           string `json:"detail"`
}

var ErrNotConfigured = fmt.Errorf("visa-llm is not configured (set VISA_LLM_URL)")

func (c *Client) Health(ctx context.Context) (Health, error) {
	var h Health
	if !c.Configured() {
		return h, ErrNotConfigured
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/api/health", nil)
	if err != nil {
		return h, err
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return h, fmt.Errorf("visa-llm unreachable: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return h, fmt.Errorf("visa-llm health returned %d", resp.StatusCode)
	}
	return h, json.NewDecoder(resp.Body).Decode(&h)
}

// Evaluate submits a profile and returns the grounded evaluation. The sidecar
// uses specific status codes for actionable failures (402 no credit, 401 bad
// key), so its error text is passed through rather than flattened to a 500.
func (c *Client) Evaluate(ctx context.Context, p ProfileRequest) (Evaluation, error) {
	var out Evaluation
	if !c.Configured() {
		return out, ErrNotConfigured
	}
	body, err := json.Marshal(p)
	if err != nil {
		return out, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/api/evaluate", bytes.NewReader(body))
	if err != nil {
		return out, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return out, fmt.Errorf("visa-llm unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var e struct {
			Detail string `json:"detail"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&e)
		if e.Detail == "" {
			e.Detail = fmt.Sprintf("visa-llm returned %d", resp.StatusCode)
		}
		return out, fmt.Errorf("%s", e.Detail)
	}
	return out, json.NewDecoder(resp.Body).Decode(&out)
}
