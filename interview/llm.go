package interview

import (
	"fmt"
	"os"
	"strings"
	"sync"
)

var (
	analyzer     *VisaAnalyzer
	analyzerOnce sync.Once
)

// GetAnalyzer returns a singleton VisaAnalyzer instance
func GetAnalyzer() *VisaAnalyzer {
	analyzerOnce.Do(func() {
		apiKey := os.Getenv("OPENAI_API_KEY")
		if apiKey == "" {
			apiKey = os.Getenv("GPT_API_KEY")
		}
		analyzer = NewVisaAnalyzer(apiKey)
	})
	return analyzer
}

// AnalyzeAnswer analyzes a question-answer pair using the VisaAnalyzer with session context
// This replaces the old CallLLM function and provides detailed feedback
func AnalyzeAnswer(session *Session, q Question, answer string) (*AnalysisResponse, error) {
	va := GetAnalyzer()
	if va == nil {
		return nil, ErrAnalyzerNotInitialized
	}
	if va.apiKey == "" {
		return nil, fmt.Errorf("API key not set for analyzer")
	}
	return va.AnalyzeAnswerWithSession(session, q.Category, q.Text, answer)
}

// CallLLM is kept for backward compatibility but now uses the new analyzer
// Deprecated: Use AnalyzeAnswer instead
func CallLLM(session *Session, q Question, answer string) (*EvalResult, error) {
	analysis, err := AnalyzeAnswer(session, q, answer)
	if err != nil {
		return nil, err
	}
	// Convert AnalysisResponse to EvalResult for backward compatibility
	return convertAnalysisToEval(analysis, q), nil
}

// ConvertAnalysisToEval converts the new AnalysisResponse to the old EvalResult format
// This allows backward compatibility with existing code
func ConvertAnalysisToEval(analysis *AnalysisResponse, q Question) *EvalResult {
	if analysis == nil {
		return nil
	}
	return convertAnalysisToEval(analysis, q)
}

// convertAnalysisToEval converts the new AnalysisResponse to the old EvalResult format
// This allows backward compatibility with existing code
func convertAnalysisToEval(analysis *AnalysisResponse, q Question) *EvalResult {
	// New grading system: scores are on a 3–15 scale (via AnalysisScores.TotalScore)
	// We convert this to a 0–100 percentage using ScoreToPercentage, then to 0–10 buckets.

	// Safeguard if scores are missing
	totalScore := 0
	if analysis.Scores.TotalScore != 0 {
		totalScore = analysis.Scores.TotalScore
	}

	// Count relevant criteria
	criteriaCount := 0
	if analysis.Scores.MigrationIntent != nil {
		criteriaCount++
	}
	if analysis.Scores.FinancialUnderstanding != nil {
		criteriaCount++
	}
	if analysis.Scores.AcademicCredibility != nil {
		criteriaCount++
	}
	if analysis.Scores.SpecificityResearch != nil {
		criteriaCount++
	}
	if analysis.Scores.Consistency != nil {
		criteriaCount++
	}
	if analysis.Scores.CommunicationQuality != nil {
		criteriaCount++
	}
	if analysis.Scores.RedFlags != nil {
		criteriaCount++
	}
	if criteriaCount == 0 {
		criteriaCount = 1 // Avoid division by zero
	}

	percentage := int(ScoreToPercentage(totalScore, criteriaCount)) // 0–100

	// Map overall percentage (0–100) to quality (0–10)
	quality := percentage / 10
	if quality > 10 {
		quality = 10
	}

	// Map criteria scores (1–5) to 0–10 scale using simple *2 scaling
	// Use communication_quality as a proxy for clarity
	clarity := 0
	if analysis.Scores.CommunicationQuality != nil {
		clarity = *analysis.Scores.CommunicationQuality * 2
		if clarity > 10 {
			clarity = 10
		}
	}
	// Use specificity_research as a proxy for confidence
	confidence := 0
	if analysis.Scores.SpecificityResearch != nil {
		confidence = *analysis.Scores.SpecificityResearch * 2
		if confidence > 10 {
			confidence = 10
		}
	}

	// Map overall percentage score to intent risk (inverse: higher score = lower risk)
	intentRisk := 10 - (percentage / 10)
	if intentRisk < 0 {
		intentRisk = 0
	}

	// Determine if followup is needed based on low score
	// Roughly: below ~70% overall needs followup
	needsFollowup := percentage < 70
	suggestedFollowup := ""
	if needsFollowup {
		// Use feedback text to guess the main followup area
		feedbackText := analysis.Feedback.Overall + " " + analysis.Feedback.ByCriterion.SpecificityResearch
		if contains(feedbackText, "purpose", "study", "why", "goal") {
			suggestedFollowup = "clarify_purpose"
		} else if contains(feedbackText, "university", "school", "college", "program") {
			suggestedFollowup = "clarify_university"
		} else if contains(feedbackText, "financial", "money", "fund", "sponsor", "income") {
			suggestedFollowup = "clarify_financial"
		} else if contains(feedbackText, "home", "country", "return", "ties", "family") {
			suggestedFollowup = "clarify_home_ties"
		}
	}

	// Calculate score deltas based on overall score
	// Lower scores increase risk, higher scores decrease risk
	scoreDelta := ScoreDelta{}
	if percentage < 60 {
		// Poor answer increases risk
		scoreDelta.OverallRisk = 5
		if q.Category == "Academic Background" {
			scoreDelta.Academic = 5
		} else if q.Category == "Financial Capability" {
			scoreDelta.Financial = 5
		} else if q.Category == "Immigration Intent" || q.Category == "Post-Graduation Plans" {
			scoreDelta.IntentToReturn = 5
		}
	} else if percentage >= 80 {
		// Good answer decreases risk
		scoreDelta.OverallRisk = -3
		if q.Category == "Academic Background" {
			scoreDelta.Academic = -3
		} else if q.Category == "Financial Capability" {
			scoreDelta.Financial = -3
		} else if q.Category == "Immigration Intent" || q.Category == "Post-Graduation Plans" {
			scoreDelta.IntentToReturn = -3
		}
	}

	// Build flags list from classification and feedback
	var flags []string
	if strings.TrimSpace(analysis.Classification) != "" {
		flags = append(flags, "classification:"+analysis.Classification)
	}
	if strings.TrimSpace(analysis.Feedback.Overall) != "" {
		flags = append(flags, "feedback:"+analysis.Feedback.Overall)
	}

	return &EvalResult{
		Quality:            quality,
		Clarity:            clarity,
		Confidence:         confidence,
		Flags:              flags,
		IntentToReturnRisk: intentRisk,
		SuggestedFollowup:  suggestedFollowup,
		NeedsFollowup:      needsFollowup,
		ScoreDelta:         scoreDelta,
	}
}

// Helper function to check if a string contains any of the given substrings (case-insensitive)
func contains(s string, substrings ...string) bool {
	sLower := strings.ToLower(s)
	for _, sub := range substrings {
		if strings.Contains(sLower, strings.ToLower(sub)) {
			return true
		}
	}
	return false
}

// ErrAnalyzerNotInitialized is returned when the analyzer is not properly initialized
var ErrAnalyzerNotInitialized = &AnalyzerError{Message: "analyzer not initialized"}

// AnalyzerError represents an error from the analyzer
type AnalyzerError struct {
	Message string
}

func (e *AnalyzerError) Error() string {
	return e.Message
}
