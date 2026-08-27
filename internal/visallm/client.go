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
	"strconv"
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

// UpstreamError carries the sidecar's status code alongside its message. The
// code is what separates an operator problem (402 out of credit, 401 bad key)
// from a genuine fault, and callers need that distinction to decide what the
// student is allowed to see.
type UpstreamError struct {
	StatusCode int
	Detail     string
}

func (e *UpstreamError) Error() string { return e.Detail }

// Billing reports whether the account cannot pay for the call. The sidecar maps
// Anthropic's credit-balance failure to 402.
func (e *UpstreamError) Billing() bool { return e.StatusCode == http.StatusPaymentRequired }

// Credentials reports a rejected or missing API key.
func (e *UpstreamError) Credentials() bool { return e.StatusCode == http.StatusUnauthorized }

// Operator reports whether this is ours to fix rather than the student's. Both
// billing and credential failures are invisible to the student and unfixable by
// them, so both are hidden behind a neutral message.
func (e *UpstreamError) Operator() bool { return e.Billing() || e.Credentials() }

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
// key); those come back as *UpstreamError so the handler can tell an operator
// problem from a genuine fault.
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
		return out, &UpstreamError{StatusCode: resp.StatusCode, Detail: e.Detail}
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return out, err
	}
	return out, nil
}

// Usage is what one evaluation cost, read from the sidecar's response headers.
type Usage struct {
	Model        string  `json:"model"`
	InputTokens  int     `json:"input_tokens"`
	CachedTokens int     `json:"cached_tokens"`
	OutputTokens int     `json:"output_tokens"`
	CostUSD      float64 `json:"cost_usd"`
}

func usageFromHeaders(h http.Header) Usage {
	atoi := func(s string) int { n, _ := strconv.Atoi(s); return n }
	cost, _ := strconv.ParseFloat(h.Get("X-Eval-Cost-Usd"), 64)
	return Usage{
		Model:        h.Get("X-Eval-Model"),
		InputTokens:  atoi(h.Get("X-Eval-Input-Tokens")),
		CachedTokens: atoi(h.Get("X-Eval-Cached-Tokens")),
		OutputTokens: atoi(h.Get("X-Eval-Output-Tokens")),
		CostUSD:      cost,
	}
}

// EvaluateWithUsage is Evaluate plus what the call cost. Callers that do not
// care about spend can keep using Evaluate.
func (c *Client) EvaluateWithUsage(ctx context.Context, p ProfileRequest) (Evaluation, Usage, error) {
	var out Evaluation
	var use Usage
	if !c.Configured() {
		return out, use, ErrNotConfigured
	}
	body, err := json.Marshal(p)
	if err != nil {
		return out, use, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/api/evaluate", bytes.NewReader(body))
	if err != nil {
		return out, use, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return out, use, fmt.Errorf("visa-llm unreachable: %w", err)
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
		return out, use, &UpstreamError{StatusCode: resp.StatusCode, Detail: e.Detail}
	}
	use = usageFromHeaders(resp.Header)
	return out, use, json.NewDecoder(resp.Body).Decode(&out)
}
