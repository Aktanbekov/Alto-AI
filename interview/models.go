package interview

import "time"

// Question represents one node in your interview graph.
type Question struct {
	ID                 string   `json:"id"`                  // e.g. "q1_purpose"
	Category           string   `json:"category"`            // e.g. "Purpose of Study"
	Text               string   `json:"text"`                // full question text
	Type               string   `json:"type,omitempty"`      // "factual_yesno", "factual_short", or "elaboration"
	NextID             string   `json:"next_id"`             // linear next question in normal flow
	FollowupCandidates []string `json:"followup_candidates"` // allowed followups from this node
	Tags               []string `json:"tags"`                // semantic tags: ["purpose", "intent", "risk"]
}

// Answer is one student response.
type Answer struct {
	QuestionID   string    `json:"question_id"`
	QuestionText string    `json:"question_text"`
	Category     string    `json:"category,omitempty"`
	Text         string    `json:"text"`
	CreatedAt    time.Time `json:"created_at"`
	// Optional: store AI eval snapshot per answer for analytics
	Eval *EvalResult `json:"eval,omitempty"`
	// V1 grading system analysis (deprecated, used when ANALYSIS_V2 is off)
	Analysis *AnalysisResponse `json:"analysis,omitempty"`
	// V2: lightweight per-answer analysis (during interview)
	Lightweight *LightweightAnalysis `json:"lightweight,omitempty"`
}

// Scores are cumulative across the entire session.
type Scores struct {
	Academic       int `json:"academic"`
	Financial      int `json:"financial"`
	IntentToReturn int `json:"intent_to_return"`
	OverallRisk    int `json:"overall_risk"`
}

// SessionStatus allows you to extend states later (paused, aborted, etc.).
type SessionStatus string

const (
	SessionStatusActive   SessionStatus = "active"
	SessionStatusFinished SessionStatus = "finished"
	SessionStatusAborted  SessionStatus = "aborted"
)

// Session holds the state of one full interview attempt.
type Session struct {
	ID                string        `json:"id"`
	UserID            string        `json:"user_id,omitempty"`  // if you later have accounts
	CurrentQuestion   string        `json:"current_question"`   // question ID
	SelectedQuestions []Question    `json:"selected_questions"` // questions selected for this session
	QuestionIndex     int           `json:"question_index"`     // current question index in SelectedQuestions
	Answers           []Answer      `json:"answers"`
	Scores            Scores        `json:"scores"`
	Status            SessionStatus `json:"status"`
	CreatedAt         time.Time     `json:"created_at"`
	UpdatedAt         time.Time     `json:"updated_at"`
	// Session summary for completed interviews (V1)
	Summary *SessionSummary `json:"summary,omitempty"`
	// V2: full post-session evaluation
	SessionEval *SessionEvaluation `json:"session_eval,omitempty"`
}

// AnalysisScores represents the dynamic grading system for a single answer
// Criteria are nullable (*int) to support N/A when not relevant to the question
type AnalysisScores struct {
	MigrationIntent       *int `json:"migration_intent"`        // 1–5 or null
	FinancialUnderstanding *int `json:"financial_understanding"` // 1–5 or null
	AcademicCredibility   *int `json:"academic_credibility"`    // 1–5 or null
	SpecificityResearch   *int `json:"specificity_research"`    // 1–5 or null
	Consistency           *int `json:"consistency"`             // 1–5 or null
	CommunicationQuality  *int `json:"communication_quality"`   // 1–5 or null
	RedFlags              *int `json:"red_flags"`               // 1–5 or null (inverted: 5 = no flags, 1 = major flags)
	TotalScore            int  `json:"total_score"`              // Sum of non-null criteria
}

// FeedbackByCriterion contains feedback for each scoring criterion
type FeedbackByCriterion struct {
	MigrationIntent       string `json:"migration_intent"`
	FinancialUnderstanding string `json:"financial_understanding"`
	AcademicCredibility   string `json:"academic_credibility"`
	SpecificityResearch   string `json:"specificity_research"`
	Consistency           string `json:"consistency"`
	CommunicationQuality  string `json:"communication_quality"`
	RedFlags              string `json:"red_flags"`
}

// StructuredFeedback contains detailed feedback in the new format
type StructuredFeedback struct {
	Overall      string              `json:"overall"`
	ByCriterion  FeedbackByCriterion `json:"by_criterion"`
	Improvements []string            `json:"improvements"`
}

// AnalysisResponse contains detailed analysis of a single answer (new grading system)
type AnalysisResponse struct {
	Scores         AnalysisScores     `json:"scores"`
	Classification string             `json:"classification"` // Excellent, Good, Average, Weak
	Feedback       StructuredFeedback `json:"feedback"`       // Structured feedback with overall, by_criterion, and improvements
}

// AnalysisRecord stores a complete analysis record
type AnalysisRecord struct {
	ID        string           `json:"id"`
	SessionID string           `json:"sessionId,omitempty"`
	Question  string           `json:"question"`
	Answer    string           `json:"answer"`
	Analysis  AnalysisResponse `json:"analysis"`
	CreatedAt time.Time        `json:"createdAt"`
}

// SessionSummary provides overall assessment of a completed interview session
type SessionSummary struct {
	SessionID      string    `json:"sessionId"`
	TotalQuestions int       `json:"totalQuestions"`
	AverageScore   float64   `json:"averageScore"`
	OverallGrade   string    `json:"overallGrade"`
	StrongAreas    []string  `json:"strongAreas"`
	WeakAreas      []string  `json:"weakAreas"`
	CommonRedFlags []string  `json:"commonRedFlags"`
	Recommendation string    `json:"recommendation"`
	CompletedAt    time.Time `json:"completedAt"`
}

// --- V2 Analysis Types (Hybrid 3-Layer System) ---

// PrefilterFlag represents a single deterministic check result
type PrefilterFlag struct {
	Code     string `json:"code"`     // e.g. "too_short", "hedging_language"
	Severity string `json:"severity"` // "warning" or "critical"
	Message  string `json:"message"`  // Human-readable explanation
}

// PrefilterResult contains all rule-based pre-filter results for a single answer
type PrefilterResult struct {
	Flags            []PrefilterFlag `json:"flags"`
	NeedsAI          bool            `json:"needs_ai"`
	AutoCommScore    *int            `json:"auto_comm_score,omitempty"`
	AutoRedFlagScore *int            `json:"auto_red_flag_score,omitempty"`
}

// LightweightAnalysis is returned per-answer during the interview.
// Only scores communication_quality and red_flags (the 2 universally relevant criteria).
type LightweightAnalysis struct {
	CommunicationQuality int             `json:"communication_quality"` // 1-5
	RedFlags             int             `json:"red_flags"`             // 1-5 (inverted: 5 = no flags)
	QuickFeedback        string          `json:"quick_feedback"`        // One-sentence assessment
	Prefilter            *PrefilterResult `json:"prefilter,omitempty"`
}

// DeepAnswerAnalysis is the full 7-criteria evaluation for a single Q&A,
// produced as part of a batch post-session evaluation.
type DeepAnswerAnalysis struct {
	QuestionID     string           `json:"question_id"`
	QuestionText   string           `json:"question_text"`
	Category       string           `json:"category"`
	AnswerText     string           `json:"answer_text"`
	Scores         AnalysisScores   `json:"scores"`
	Classification string           `json:"classification"`
	Feedback       StructuredFeedback `json:"feedback"`
}

// Contradiction represents a specific inconsistency found between two answers
type Contradiction struct {
	AnswerIndexA int    `json:"answer_index_a"` // 0-based index into session answers
	AnswerIndexB int    `json:"answer_index_b"`
	Description  string `json:"description"`
	Severity     string `json:"severity"` // "minor" or "major"
}

// ConsistencyReport contains the results of cross-answer consistency checking
type ConsistencyReport struct {
	Contradictions []Contradiction `json:"contradictions"`
	OverallScore   int             `json:"overall_score"` // 1-5 (5 = perfectly consistent)
	Summary        string          `json:"summary"`
}

// SessionEvaluation is the final combined result returned when the interview finishes.
// It replaces the old per-answer AnalysisResponse approach.
type SessionEvaluation struct {
	Answers        []DeepAnswerAnalysis `json:"answers"`
	Consistency    *ConsistencyReport   `json:"consistency,omitempty"`
	OverallScore   int                  `json:"overall_score"`   // Weighted composite 0-100
	OverallGrade   string               `json:"overall_grade"`   // A, B, C, D
	Verdict        string               `json:"verdict"`         // "Likely Approved", "Needs Work", "High Risk"
	Recommendation string               `json:"recommendation"`
	StrongAreas    []string             `json:"strong_areas"`
	WeakAreas      []string             `json:"weak_areas"`
}
