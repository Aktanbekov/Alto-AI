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

// --- V2 Entry Points ---

// AnalyzeAnswerLightweight runs prefilter + lightweight AI (2 criteria only).
// Used per-answer during the interview for real-time feedback.
func AnalyzeAnswerLightweight(session *Session, q Question, answer string) (*LightweightAnalysis, error) {
	prefilter := RunPrefilter(q.Category, q.Type, q.Text, answer)

	if !prefilter.NeedsAI {
		comm := 1
		rf := 3
		if prefilter.AutoCommScore != nil {
			comm = *prefilter.AutoCommScore
		}
		if prefilter.AutoRedFlagScore != nil {
			rf = *prefilter.AutoRedFlagScore
		}
		return &LightweightAnalysis{
			CommunicationQuality: comm,
			RedFlags:             rf,
			QuickFeedback:        summarizePrefilterFlags(prefilter),
			Prefilter:            prefilter,
		}, nil
	}

	va := GetAnalyzer()
	if va == nil {
		return &LightweightAnalysis{
			CommunicationQuality: 3,
			RedFlags:             3,
			QuickFeedback:        summarizePrefilterFlags(prefilter),
			Prefilter:            prefilter,
		}, nil
	}
	if va.apiKey == "" {
		return &LightweightAnalysis{
			CommunicationQuality: 3,
			RedFlags:             3,
			QuickFeedback:        "AI analysis unavailable. " + summarizePrefilterFlags(prefilter),
			Prefilter:            prefilter,
		}, nil
	}

	result, err := va.AnalyzeLightweight(q.Text, answer, q.Type)
	if err != nil {
		return &LightweightAnalysis{
			CommunicationQuality: 3,
			RedFlags:             3,
			QuickFeedback:        "AI analysis failed. " + summarizePrefilterFlags(prefilter),
			Prefilter:            prefilter,
		}, nil
	}

	result.Prefilter = prefilter

	if prefilter.AutoRedFlagScore != nil && *prefilter.AutoRedFlagScore < result.RedFlags {
		result.RedFlags = *prefilter.AutoRedFlagScore
	}

	if result.QuickFeedback == "" {
		result.QuickFeedback = summarizePrefilterFlags(prefilter)
	}

	return result, nil
}

// EvaluateSessionDeep runs the full batch evaluation + consistency check after the interview.
// Returns a SessionEvaluation combining deep per-answer scores, consistency, and overall verdict.
func EvaluateSessionDeep(session *Session) (*SessionEvaluation, error) {
	va := GetAnalyzer()
	if va == nil {
		return nil, ErrAnalyzerNotInitialized
	}
	if va.apiKey == "" {
		return nil, fmt.Errorf("API key not set for analyzer")
	}

	deepAnswers, err := va.EvaluateSessionBatch(session)
	if err != nil {
		return nil, fmt.Errorf("deep batch evaluation failed: %w", err)
	}

	consistency, err := va.CheckSessionConsistency(session)
	if err != nil {
		// Non-fatal: continue without consistency
		consistency = nil
	}

	return buildSessionEvaluation(deepAnswers, consistency), nil
}

// CheckConsistency runs only the consistency check (can be called independently).
func CheckConsistency(session *Session) (*ConsistencyReport, error) {
	va := GetAnalyzer()
	if va == nil {
		return nil, ErrAnalyzerNotInitialized
	}
	return va.CheckSessionConsistency(session)
}

func summarizePrefilterFlags(pf *PrefilterResult) string {
	if pf == nil || len(pf.Flags) == 0 {
		return ""
	}
	messages := make([]string, 0, len(pf.Flags))
	for _, f := range pf.Flags {
		messages = append(messages, f.Message)
	}
	return strings.Join(messages, " ")
}

func buildSessionEvaluation(answers []DeepAnswerAnalysis, consistency *ConsistencyReport) *SessionEvaluation {
	eval := &SessionEvaluation{
		Answers:     answers,
		Consistency: consistency,
	}

	if len(answers) == 0 {
		eval.OverallGrade = "D"
		eval.Verdict = "High Risk"
		eval.Recommendation = "No answers were evaluated."
		return eval
	}

	totalScore := 0
	totalCriteria := 0
	strengthMap := make(map[string]int)
	weakMap := make(map[string]int)

	for _, a := range answers {
		totalScore += a.Scores.TotalScore
		totalCriteria += countRelevantCriteria(a.Scores)
		trackStrengthsAndWeaknesses(a.Scores, strengthMap, weakMap)
	}

	if totalCriteria == 0 {
		totalCriteria = 1
	}
	percentage := ScoreToPercentage(totalScore, totalCriteria)

	if consistency != nil && consistency.OverallScore <= 2 {
		penalty := float64(15)
		if consistency.OverallScore == 1 {
			penalty = 25
		}
		percentage = percentage - penalty
		if percentage < 0 {
			percentage = 0
		}
	}

	eval.OverallScore = int(percentage)

	switch {
	case percentage >= 80:
		eval.OverallGrade = "A"
		eval.Verdict = "Likely Approved"
		eval.Recommendation = "Strong performance. Focus on maintaining confidence and natural delivery during the actual interview."
	case percentage >= 65:
		eval.OverallGrade = "B"
		eval.Verdict = "Likely Approved"
		eval.Recommendation = "Good foundation. Review the feedback for each answer and practice the specific improvements suggested."
	case percentage >= 45:
		eval.OverallGrade = "C"
		eval.Verdict = "Needs Work"
		eval.Recommendation = "You need more practice. Focus on providing specific examples, showing strong ties to your home country, and demonstrating clear post-graduation plans."
	default:
		eval.OverallGrade = "D"
		eval.Verdict = "High Risk"
		eval.Recommendation = "Significant improvement needed. Consider working with an advisor. Focus on clarity, specificity, and addressing visa officer concerns about immigrant intent."
	}

	for k, count := range strengthMap {
		if count >= len(answers)/2 {
			eval.StrongAreas = append(eval.StrongAreas, formatCriterionName(k))
		}
	}
	for k, count := range weakMap {
		if count >= len(answers)/2 {
			eval.WeakAreas = append(eval.WeakAreas, formatCriterionName(k))
		}
	}

	return eval
}

func trackStrengthsAndWeaknesses(scores AnalysisScores, strengths, weaknesses map[string]int) {
	check := func(name string, val *int) {
		if val == nil {
			return
		}
		if *val >= 4 {
			strengths[name]++
		} else if *val <= 2 {
			weaknesses[name]++
		}
	}
	check("migration_intent", scores.MigrationIntent)
	check("financial_understanding", scores.FinancialUnderstanding)
	check("academic_credibility", scores.AcademicCredibility)
	check("specificity_research", scores.SpecificityResearch)
	check("consistency", scores.Consistency)
	check("communication_quality", scores.CommunicationQuality)
	check("red_flags", scores.RedFlags)
}

// IsAnalysisV2Enabled checks if the V2 analysis system is active
func IsAnalysisV2Enabled() bool {
	return os.Getenv("ANALYSIS_V2") == "true"
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
