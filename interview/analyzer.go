package interview

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// VisaAnalyzer handles AI-powered analysis of visa interview answers
type VisaAnalyzer struct {
	apiKey     string
	apiURL     string
	httpClient *http.Client
	// Cache the system prompt to avoid regenerating it
	systemPrompt string
}

// NewVisaAnalyzer creates a new VisaAnalyzer instance
func NewVisaAnalyzer(apiKey string) *VisaAnalyzer {
	if apiKey == "" {
		// Try to get from environment
		apiKey = os.Getenv("OPENAI_API_KEY")
		if apiKey == "" {
			apiKey = os.Getenv("GPT_API_KEY")
		}
	}

	systemPrompt := `You are an experienced U.S. F-1 visa consular officer evaluating a student's interview answer. Evaluate the answer exactly as a real visa officer would, focusing on evidence, specificity, and potential red flags.

Read the student’s answer and evaluate it the same way a real visa officer would.

EVALUATION CRITERIA (Score each 1-5, where 5 is best, or null if not relevant):

IMPORTANT: Only evaluate criteria that are relevant to the question category. For criteria NOT tested by this question, return null (not a number). Do NOT score irrelevant criteria.

1. migration_intent (1-5 or null):
   - 5: Strong, specific evidence of return intent (family ties, job offers, property ownership, business plans, specific career path back home)
   - 4: Good evidence with some specifics (mentions family, job prospects, or career plans)
   - 3: Moderate evidence but vague (says "I'll return" without specifics)
   - 2: Weak evidence or concerning statements (vague plans, mentions staying in US)
   - 1: Strong signs of immigration intent (wants to stay permanently, no ties mentioned, unrealistic return plans)

2. financial_understanding (1-5 or null):
   - 5: Clear understanding of total costs, specific funding sources (scholarships, loans, sponsors), realistic planning for entire program
   - 4: Good understanding with most details (knows costs, has funding plan)
   - 3: Basic understanding but missing specifics (knows approximate costs, vague funding)
   - 2: Poor understanding (unclear about costs or funding sources)
   - 1: No understanding or unrealistic financial planning (doesn't know costs, no funding plan)

3. academic_credibility (1-5 or null):
   - 5: Strong academic fit, program aligns perfectly with background, clear educational progression, demonstrates serious student intent
   - 4: Good fit with logical progression and alignment
   - 3: Acceptable fit but some gaps or unclear progression
   - 2: Weak fit or questionable academic choices
   - 1: Poor fit, suspicious academic choices, or doesn't demonstrate serious study intent

4. specificity_research (1-5 or null):
   - 5: Deep knowledge with specific details (faculty names, research labs, unique courses, campus resources, specific program features, comparison with other universities)
   - 4: Good knowledge with some specifics (mentions program features, faculty, or research opportunities)
   - 3: Basic knowledge but generic (knows program name, some general features)
   - 2: Vague or superficial knowledge (generic statements like "good school")
   - 1: No evidence of research or knowledge (can't explain why this university/program)

5. consistency (1-5 or null):
   - 5: Perfectly consistent with previous answers and application documents, no contradictions
   - 4: Mostly consistent with minor alignment
   - 3: Generally consistent but some minor contradictions
   - 2: Several contradictions or inconsistencies with previous answers
   - 1: Major contradictions or completely inconsistent with stated goals/documents

6. communication_quality (1-5 or null):
   - 5: Clear, confident, natural, fluent English, appropriate tone, well-structured
   - 4: Good communication with minor issues (mostly clear and confident)
   - 3: Acceptable but needs improvement (understandable but hesitant or unclear at times)
   - 2: Poor communication (difficult to understand, very hesitant, unclear)
   - 1: Very poor communication (cannot understand, extremely hesitant, robotic or rehearsed)

7. red_flags (1-5 or null, INVERTED - 5 = no flags, 1 = major flags):
   - 5: No red flags detected (honest, specific, realistic, consistent)
   - 4: Minor concerns (slightly vague or one minor issue)
   - 3: Some concerns (multiple vague answers, minor contradictions)
   - 2: Significant red flags (major contradictions, unrealistic plans, very vague)
   - 1: Major red flags (suspicious patterns, major contradictions, clear immigration intent, unrealistic plans, lack of knowledge)

QUESTION CATEGORY AWARENESS:
You will receive the question category for each evaluated Q&A. Use ONLY that category for the mapping below. Do NOT infer category from the question text (e.g. do not treat "home country" in a Purpose of Study question as Immigration Intent).

The question category determines which criteria you should evaluate. For criteria NOT listed for a category, return null:

- Financial Capability: Evaluate ONLY financial_understanding, communication_quality, red_flags. Set migration_intent, academic_credibility, specificity_research, consistency to null.
- University Choice: Evaluate ONLY specificity_research, communication_quality, red_flags. Set migration_intent, financial_understanding, academic_credibility, consistency to null.
- Post-Graduation Plans: Evaluate ONLY migration_intent, consistency (if previous answers exist in session context), communication_quality, red_flags. Set financial_understanding, academic_credibility, specificity_research to null.
- Academic Background: Evaluate ONLY academic_credibility, communication_quality, red_flags. Set migration_intent, financial_understanding, specificity_research, consistency to null.
- Immigration Intent: Evaluate ONLY migration_intent, communication_quality, red_flags. Set financial_understanding, academic_credibility, specificity_research, consistency to null.
- Purpose of Study: Evaluate ONLY specificity_research, academic_credibility, communication_quality, red_flags. Set migration_intent, financial_understanding, consistency to null.

Always evaluate communication_quality and red_flags (they apply to any answer's delivery and style).
Evaluate consistency only if there are previous answers in the session context.

RED FLAGS TO DETECT:
- Vague or rehearsed responses ("it's a good school", "I'll see", "maybe")
- Contradictions between answers
- Lack of specific knowledge about program/university
- Unrealistic financial plans
- Weak ties to home country
- Suspicious patterns (applying to many low-tier schools, can't explain choices)
- Overly rehearsed or robotic delivery
- Inability to answer follow-up questions naturally

Calculate total_score as the sum of only the non-null criteria. The range depends on how many criteria are relevant (typically 3-5 criteria, so range is usually 3-25 or 4-20, etc.).

Assign classification based on total_score and the number of relevant criteria:
- For 3 criteria (max 15): Excellent: 13-15, Good: 10-12, Average: 7-9, Weak: 3-6
- For 4 criteria (max 20): Excellent: 17-20, Good: 13-16, Average: 9-12, Weak: 4-8
- For 5 criteria (max 25): Excellent: 21-25, Good: 17-20, Average: 12-16, Weak: 5-11
- For 6+ criteria: Use proportional thresholds (Excellent: ~85%+, Good: ~70-84%, Average: ~50-69%, Weak: <50%)

Provide structured feedback:
- overall: Professional assessment covering overall impression, key strengths, potential red flags, and consular officer concerns
- by_criterion: Specific feedback for each relevant criterion explaining the score and what evidence was found (or missing). For criteria set to null, you may omit feedback or provide "N/A - not applicable to this question category"
- improvements: Actionable, specific suggestions with examples of what to include (e.g., "Mention specific faculty member names", "Provide exact cost breakdown", "Name your post-graduation employer")

CRITICAL: Do not invent facts. Judge only what is written. If information is missing, note it in feedback but don't assume it exists.

The response must be in the following JSON format:
{
  "scores": {
    "migration_intent": 1-5 or null,
    "financial_understanding": 1-5 or null,
    "academic_credibility": 1-5 or null,
    "specificity_research": 1-5 or null,
    "consistency": 1-5 or null,
    "communication_quality": 1-5 or null,
    "red_flags": 1-5 or null,
    "total_score": <sum of non-null criteria>
  },
  "classification": "Excellent|Good|Average|Weak",
  "feedback": {
    "overall": "string",
    "by_criterion": {
      "migration_intent": "string",
      "financial_understanding": "string",
      "academic_credibility": "string",
      "specificity_research": "string",
      "consistency": "string",
      "communication_quality": "string",
      "red_flags": "string"
    },
    "improvements": ["string"]
  }
}
`

	return &VisaAnalyzer{
		apiKey:       apiKey,
		apiURL:       "https://api.openai.com/v1/chat/completions",
		systemPrompt: systemPrompt,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// AnalyzeAnswer analyzes a single answer and returns detailed feedback
func (va *VisaAnalyzer) AnalyzeAnswer(question, answer string) (*AnalysisResponse, error) {
	if va.apiKey == "" {
		return nil, fmt.Errorf("API key not set")
	}

	// Build session messages with system prompt (only once)
	sessionMessages := []GPTMessage{
		{
			Role:    "system",
			Content: va.systemPrompt,
		},
	}

	return va.callGPTAPI(sessionMessages, "", question, answer)
}

// AnalyzeAnswerWithSession analyzes an answer with full session context
// The system prompt is sent only once, then we append conversation history
func (va *VisaAnalyzer) AnalyzeAnswerWithSession(session *Session, category, question, answer string) (*AnalysisResponse, error) {
	if va.apiKey == "" {
		return nil, fmt.Errorf("API key not set")
	}

	// Start with system prompt (sent once per API call, but contains all rules)
	sessionMessages := []GPTMessage{
		{
			Role:    "system",
			Content: va.systemPrompt,
		},
	}

	// Add previous Q&A pairs from the session for context
	// These messages don't repeat the rules, just the conversation
	for _, prevAnswer := range session.Answers {
		sessionMessages = append(sessionMessages, GPTMessage{
			Role:    "user",
			Content: fmt.Sprintf("Question: %s\nStudent's Answer: %s", prevAnswer.QuestionText, prevAnswer.Text),
		})

		// Add assistant response if analysis exists
		if prevAnswer.Analysis != nil {
			analysisJSON, err := json.Marshal(prevAnswer.Analysis)
			if err == nil {
				sessionMessages = append(sessionMessages, GPTMessage{
					Role:    "assistant",
					Content: string(analysisJSON),
				})
			}
		}
	}

	return va.callGPTAPI(sessionMessages, category, question, answer)
}

// GetSessionMessages builds the full conversation history for a session
// This can be useful if you want to inspect what's being sent to the API
func (va *VisaAnalyzer) GetSessionMessages(session *Session) []GPTMessage {
	messages := []GPTMessage{
		{
			Role:    "system",
			Content: va.systemPrompt,
		},
	}

	for _, prevAnswer := range session.Answers {
		messages = append(messages, GPTMessage{
			Role:    "user",
			Content: fmt.Sprintf("Question: %s\nStudent's Answer: %s", prevAnswer.QuestionText, prevAnswer.Text),
		})

		if prevAnswer.Analysis != nil {
			analysisJSON, err := json.Marshal(prevAnswer.Analysis)
			if err == nil {
				messages = append(messages, GPTMessage{
					Role:    "assistant",
					Content: string(analysisJSON),
				})
			}
		}
	}

	return messages
}

// GenerateSessionSummary generates a summary from multiple analysis records
func (va *VisaAnalyzer) GenerateSessionSummary(analyses []AnalysisRecord) (*SessionSummary, error) {
	if len(analyses) == 0 {
		return nil, fmt.Errorf("no analyses provided")
	}

	totalScore := 0
	totalCriteriaCount := 0
	for _, record := range analyses {
		totalScore += record.Analysis.Scores.TotalScore
		totalCriteriaCount += countRelevantCriteria(record.Analysis.Scores)
	}

	avgScore := float64(totalScore) / float64(len(analyses))
	avgCriteriaCount := totalCriteriaCount / len(analyses)
	if avgCriteriaCount == 0 {
		avgCriteriaCount = 1 // Avoid division by zero
	}

	return &SessionSummary{
		TotalQuestions: len(analyses),
		AverageScore:   avgScore,
		OverallGrade:   getGradeFromScore(int(avgScore), avgCriteriaCount),
		StrongAreas:    extractCommonStrengths(analyses),
		WeakAreas:      extractCommonWeaknesses(analyses),
		CommonRedFlags: extractCommonRedFlags(analyses),
		Recommendation: generateRecommendation(avgScore, analyses),
		CompletedAt:    time.Now(),
	}, nil
}

// GPTMessage represents a message in the GPT conversation
type GPTMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func (va *VisaAnalyzer) callGPTAPI(sessionMessages []GPTMessage, category, question, answer string) (*AnalysisResponse, error) {
	type GPTRequest struct {
		Model       string       `json:"model"`
		MaxTokens   int          `json:"max_tokens"`
		Messages    []GPTMessage `json:"messages"`
		Temperature float64      `json:"temperature"`
	}

	type GPTChoice struct {
		Message GPTMessage `json:"message"`
	}

	type GPTResponse struct {
		Choices []GPTChoice `json:"choices"`
	}

	// Build current user message: include Category when provided
	var userContent string
	if strings.TrimSpace(category) != "" {
		userContent = fmt.Sprintf("Category: %s\nQuestion: %s\nStudent's Answer: %s", category, question, answer)
	} else {
		userContent = fmt.Sprintf("Question: %s\nStudent's Answer: %s", question, answer)
	}

	// Add the new question and answer to the session messages
	sessionMessages = append(sessionMessages, GPTMessage{
		Role:    "user",
		Content: userContent,
	})

	gptReq := GPTRequest{
		Model:       "gpt-3.5-turbo",
		MaxTokens:   1000,
		Temperature: 0.3,
		Messages:    sessionMessages,
	}

	reqBody, err := json.Marshal(gptReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", va.apiURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+va.apiKey)

	resp, err := va.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	var gptResp GPTResponse
	if err := json.Unmarshal(body, &gptResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if len(gptResp.Choices) == 0 {
		return nil, fmt.Errorf("empty response from API")
	}

	content := gptResp.Choices[0].Message.Content
	content = strings.TrimSpace(content)
	
	// Remove markdown code fences
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)
	
	// Extract JSON object more robustly - find first { and matching closing }
	jsonStart := strings.Index(content, "{")
	if jsonStart == -1 {
		return nil, fmt.Errorf("no JSON object found in response")
	}
	
	// Find the matching closing brace
	braceCount := 0
	jsonEnd := -1
	for i := jsonStart; i < len(content); i++ {
		if content[i] == '{' {
			braceCount++
		} else if content[i] == '}' {
			braceCount--
			if braceCount == 0 {
				jsonEnd = i + 1
				break
			}
		}
	}
	
	if jsonEnd == -1 {
		return nil, fmt.Errorf("unmatched braces in JSON response")
	}
	
	// Extract just the JSON object
	jsonContent := content[jsonStart:jsonEnd]

	var analysis AnalysisResponse
	if err := json.Unmarshal([]byte(jsonContent), &analysis); err != nil {
		return nil, fmt.Errorf("failed to parse analysis: %w", err)
	}

	// Calculate total_score from only non-null criteria
	analysis.Scores.TotalScore = calculateTotalScore(analysis.Scores)

	// Validate and correct classification based on actual total_score
	criteriaCount := countRelevantCriteria(analysis.Scores)
	correctClassification := getClassificationFromScore(analysis.Scores.TotalScore, criteriaCount)

	// Override LLM's classification with the correct one based on actual scores
	if analysis.Classification != correctClassification {
		log.Printf("Classification mismatch: LLM said '%s' but score %d/%d (criteria: %d) should be '%s'. Correcting.",
			analysis.Classification, analysis.Scores.TotalScore, criteriaCount*5, criteriaCount, correctClassification)
		analysis.Classification = correctClassification
	}

	return &analysis, nil
}

// calculateTotalScore sums only the non-null criteria
func calculateTotalScore(scores AnalysisScores) int {
	total := 0
	if scores.MigrationIntent != nil {
		total += *scores.MigrationIntent
	}
	if scores.FinancialUnderstanding != nil {
		total += *scores.FinancialUnderstanding
	}
	if scores.AcademicCredibility != nil {
		total += *scores.AcademicCredibility
	}
	if scores.SpecificityResearch != nil {
		total += *scores.SpecificityResearch
	}
	if scores.Consistency != nil {
		total += *scores.Consistency
	}
	if scores.CommunicationQuality != nil {
		total += *scores.CommunicationQuality
	}
	if scores.RedFlags != nil {
		total += *scores.RedFlags
	}
	return total
}

// Helper functions for session summary generation

// countRelevantCriteria counts how many criteria are non-null
func countRelevantCriteria(scores AnalysisScores) int {
	count := 0
	if scores.MigrationIntent != nil {
		count++
	}
	if scores.FinancialUnderstanding != nil {
		count++
	}
	if scores.AcademicCredibility != nil {
		count++
	}
	if scores.SpecificityResearch != nil {
		count++
	}
	if scores.Consistency != nil {
		count++
	}
	if scores.CommunicationQuality != nil {
		count++
	}
	if scores.RedFlags != nil {
		count++
	}
	return count
}

// getClassificationFromScore determines the correct classification based on total_score and criteria count
// This matches the thresholds defined in the system prompt
func getClassificationFromScore(totalScore int, criteriaCount int) string {
	if criteriaCount == 0 {
		return "Weak"
	}

	maxScore := criteriaCount * 5

	// Use the same thresholds as defined in the prompt
	switch criteriaCount {
	case 3:
		// For 3 criteria (max 15): Excellent: 13-15, Good: 10-12, Average: 7-9, Weak: 3-6
		if totalScore >= 13 {
			return "Excellent"
		} else if totalScore >= 10 {
			return "Good"
		} else if totalScore >= 7 {
			return "Average"
		}
		return "Weak"
	case 4:
		// For 4 criteria (max 20): Excellent: 17-20, Good: 13-16, Average: 9-12, Weak: 4-8
		if totalScore >= 17 {
			return "Excellent"
		} else if totalScore >= 13 {
			return "Good"
		} else if totalScore >= 9 {
			return "Average"
		}
		return "Weak"
	case 5:
		// For 5 criteria (max 25): Excellent: 21-25, Good: 17-20, Average: 12-16, Weak: 5-11
		if totalScore >= 21 {
			return "Excellent"
		} else if totalScore >= 17 {
			return "Good"
		} else if totalScore >= 12 {
			return "Average"
		}
		return "Weak"
	default:
		// For 6+ criteria: Use proportional thresholds (Excellent: ~85%+, Good: ~70-84%, Average: ~50-69%, Weak: <50%)
		percentage := float64(totalScore) / float64(maxScore) * 100
		if percentage >= 85 {
			return "Excellent"
		} else if percentage >= 70 {
			return "Good"
		} else if percentage >= 50 {
			return "Average"
		}
		return "Weak"
	}
}

func getGradeFromScore(score int, criteriaCount int) string {
	if criteriaCount == 0 {
		return "D" // No criteria evaluated
	}

	// Calculate thresholds based on number of criteria
	// Using percentage-based thresholds: Excellent ~85%+, Good ~70-84%, Average ~50-69%, Weak <50%
	maxScore := criteriaCount * 5
	excellentThreshold := int(float64(maxScore) * 0.85)
	goodThreshold := int(float64(maxScore) * 0.70)
	averageThreshold := int(float64(maxScore) * 0.50)

	switch {
	case score >= excellentThreshold:
		return "A" // Excellent
	case score >= goodThreshold:
		return "B" // Good
	case score >= averageThreshold:
		return "C" // Average
	default:
		return "D" // Weak
	}
}

func generateRecommendation(avgScore float64, analyses []AnalysisRecord) string {
	if avgScore >= 32 {
		return "Excellent performance! You're well-prepared. Focus on maintaining confidence and natural delivery during the actual interview."
	} else if avgScore >= 25 {
		return "Good foundation. Review the specific feedback for each answer and practice the improved versions. Focus on being more specific and confident in your responses."
	} else if avgScore >= 18 {
		return "You need more practice. Focus on providing specific examples, showing strong ties to your home country, and demonstrating clear post-graduation plans."
	}
	return "Significant improvement needed. Consider working with an advisor to strengthen your answers. Focus on clarity, specificity, and addressing visa officer concerns about immigrant intent."
}

// ScoreToPercentage converts score to 0-100 percentage for display
// score: the total score
// criteriaCount: number of criteria that were evaluated (non-null)
func ScoreToPercentage(score int, criteriaCount int) float64 {
	if criteriaCount == 0 {
		return 0.0
	}
	maxScore := criteriaCount * 5
	minScore := criteriaCount * 1
	
	if score < minScore {
		score = minScore
	}
	if score > maxScore {
		score = maxScore
	}
	
	// Formula: ((score - minScore) / (maxScore - minScore)) * 100
	scoreRange := maxScore - minScore
	if scoreRange == 0 {
		return 100.0
	}
	return float64(score-minScore) * (100.0 / float64(scoreRange))
}

func extractCommonStrengths(analyses []AnalysisRecord) []string {
	criteriaScores := make(map[string]int)
	criteriaCount := make(map[string]int)

	for _, record := range analyses {
		scores := record.Analysis.Scores

		if scores.MigrationIntent != nil && *scores.MigrationIntent >= 4 {
			criteriaScores["migration_intent"] += *scores.MigrationIntent
			criteriaCount["migration_intent"]++
		}
		if scores.FinancialUnderstanding != nil && *scores.FinancialUnderstanding >= 4 {
			criteriaScores["financial_understanding"] += *scores.FinancialUnderstanding
			criteriaCount["financial_understanding"]++
		}
		if scores.AcademicCredibility != nil && *scores.AcademicCredibility >= 4 {
			criteriaScores["academic_credibility"] += *scores.AcademicCredibility
			criteriaCount["academic_credibility"]++
		}
		if scores.SpecificityResearch != nil && *scores.SpecificityResearch >= 4 {
			criteriaScores["specificity_research"] += *scores.SpecificityResearch
			criteriaCount["specificity_research"]++
		}
		if scores.Consistency != nil && *scores.Consistency >= 4 {
			criteriaScores["consistency"] += *scores.Consistency
			criteriaCount["consistency"]++
		}
		if scores.CommunicationQuality != nil && *scores.CommunicationQuality >= 4 {
			criteriaScores["communication_quality"] += *scores.CommunicationQuality
			criteriaCount["communication_quality"]++
		}
		if scores.RedFlags != nil && *scores.RedFlags >= 4 {
			criteriaScores["red_flags"] += *scores.RedFlags
			criteriaCount["red_flags"]++
		}
	}

	var strengths []string
	for criterion, count := range criteriaCount {
		if count >= len(analyses)/2 {
			strengths = append(strengths, formatCriterionName(criterion))
		}
	}

	return strengths
}

func extractCommonWeaknesses(analyses []AnalysisRecord) []string {
	criteriaScores := make(map[string]int)

	for _, record := range analyses {
		scores := record.Analysis.Scores

		if scores.MigrationIntent != nil && *scores.MigrationIntent <= 3 {
			criteriaScores["migration_intent"]++
		}
		if scores.FinancialUnderstanding != nil && *scores.FinancialUnderstanding <= 3 {
			criteriaScores["financial_understanding"]++
		}
		if scores.AcademicCredibility != nil && *scores.AcademicCredibility <= 3 {
			criteriaScores["academic_credibility"]++
		}
		if scores.SpecificityResearch != nil && *scores.SpecificityResearch <= 3 {
			criteriaScores["specificity_research"]++
		}
		if scores.Consistency != nil && *scores.Consistency <= 3 {
			criteriaScores["consistency"]++
		}
		if scores.CommunicationQuality != nil && *scores.CommunicationQuality <= 3 {
			criteriaScores["communication_quality"]++
		}
		if scores.RedFlags != nil && *scores.RedFlags <= 3 {
			criteriaScores["red_flags"]++
		}
	}

	var weaknesses []string
	for criterion, count := range criteriaScores {
		if count >= len(analyses)/2 {
			weaknesses = append(weaknesses, formatCriterionName(criterion))
		}
	}

	return weaknesses
}

func extractCommonRedFlags(analyses []AnalysisRecord) []string {
	flagMap := make(map[string]bool)

	for _, record := range analyses {
		scores := record.Analysis.Scores

		if scores.MigrationIntent != nil && *scores.MigrationIntent <= 2 {
			flagMap["Shows potential immigration intent"] = true
		}
		if scores.FinancialUnderstanding != nil && *scores.FinancialUnderstanding <= 2 {
			flagMap["Poor financial understanding or planning"] = true
		}
		if scores.AcademicCredibility != nil && *scores.AcademicCredibility <= 2 {
			flagMap["Weak academic fit or credibility"] = true
		}
		if scores.SpecificityResearch != nil && *scores.SpecificityResearch <= 2 {
			flagMap["Lacks specific knowledge or research"] = true
		}
		if scores.Consistency != nil && *scores.Consistency <= 2 {
			flagMap["Inconsistent answers or contradictions"] = true
		}
		if scores.CommunicationQuality != nil && *scores.CommunicationQuality <= 2 {
			flagMap["Poor communication or clarity"] = true
		}
		if scores.RedFlags != nil && *scores.RedFlags <= 2 {
			flagMap["Major red flags detected"] = true
		}
	}

	var flags []string
	for flag := range flagMap {
		flags = append(flags, flag)
	}

	return flags
}

func formatCriterionName(criterion string) string {
	switch criterion {
	case "migration_intent":
		return "Strong return intent"
	case "financial_understanding":
		return "Financial understanding"
	case "academic_credibility":
		return "Academic credibility"
	case "specificity_research":
		return "Specificity & research"
	case "consistency":
		return "Consistency"
	case "communication_quality":
		return "Communication quality"
	case "red_flags":
		return "No red flags"
	default:
		return criterion
	}
}
