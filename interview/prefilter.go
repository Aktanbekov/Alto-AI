package interview

import (
	"regexp"
	"strings"
	"unicode"
)

var (
	hedgingPhrases = []string{
		"i don't know", "i dont know", "i'm not sure", "im not sure",
		"maybe", "i'll see", "ill see", "i guess", "not really sure",
		"i have no idea", "no idea", "haven't decided", "havent decided",
		"i will figure it out", "we'll see", "well see",
	}

	immigrationKeywords = []string{
		"stay in us", "stay in the us", "stay in america", "stay in the united states",
		"settle in", "settle down in", "live in america", "live in the us",
		"green card", "permanent resident", "citizenship",
		"work after graduation and stay", "not go back", "not going back",
		"don't want to return", "dont want to return",
	}

	numberPattern = regexp.MustCompile(`\d[\d,]*\.?\d*`)

	academicKeywords = []string{
		"professor", "prof.", "dr.", "faculty", "department", "lab",
		"research", "thesis", "dissertation", "curriculum", "course",
		"program", "degree", "gpa", "credits", "semester",
	}
)

func minWordCount(questionType string) int {
	switch questionType {
	case "factual_yesno":
		return 3
	case "factual_short":
		return 5
	case "elaboration":
		return 25
	default:
		return 15
	}
}

// RunPrefilter runs deterministic checks on an answer before any AI call.
// Returns flags and whether the answer needs AI analysis at all.
func RunPrefilter(category, questionType, question, answer string) *PrefilterResult {
	result := &PrefilterResult{
		Flags:   []PrefilterFlag{},
		NeedsAI: true,
	}

	trimmed := strings.TrimSpace(answer)
	lower := strings.ToLower(trimmed)
	wordCount := countWords(trimmed)

	minWords := minWordCount(questionType)
	if wordCount < minWords {
		result.Flags = append(result.Flags, PrefilterFlag{
			Code:     "too_short",
			Severity: "warning",
			Message:  "Answer is very brief. Visa officers expect detailed, specific responses.",
		})
	}

	for _, phrase := range hedgingPhrases {
		if strings.Contains(lower, phrase) {
			result.Flags = append(result.Flags, PrefilterFlag{
				Code:     "hedging_language",
				Severity: "warning",
				Message:  "Vague or uncertain language detected. Avoid phrases like \"" + phrase + "\" — be direct and confident.",
			})
			break
		}
	}

	for _, kw := range immigrationKeywords {
		if strings.Contains(lower, kw) {
			result.Flags = append(result.Flags, PrefilterFlag{
				Code:     "immigration_intent_keyword",
				Severity: "critical",
				Message:  "Your answer contains language that suggests immigration intent (\"" + kw + "\"). This is the single biggest red flag for visa officers.",
			})
			break
		}
	}

	catLower := strings.ToLower(category)

	// Only check for financial specifics on elaboration questions in financial category
	if questionType == "elaboration" && strings.Contains(catLower, "financial") {
		if !numberPattern.MatchString(trimmed) {
			result.Flags = append(result.Flags, PrefilterFlag{
				Code:     "no_financial_specifics",
				Severity: "warning",
				Message:  "Financial questions expect specific numbers (tuition costs, savings, sponsor income). No numbers detected in your answer.",
			})
		}
	}

	// Only check for academic specifics on elaboration questions in relevant categories
	if questionType == "elaboration" &&
		(strings.Contains(catLower, "university") || strings.Contains(catLower, "purpose of study")) {
		hasSpecifics := false
		for _, kw := range academicKeywords {
			if strings.Contains(lower, kw) {
				hasSpecifics = true
				break
			}
		}
		if !hasSpecifics && wordCount > 5 {
			result.Flags = append(result.Flags, PrefilterFlag{
				Code:     "no_university_specifics",
				Severity: "warning",
				Message:  "Consider mentioning specific details like professor names, research labs, courses, or program features.",
			})
		}
	}

	questionLower := strings.ToLower(question)
	if wordCount > 5 && textSimilarity(lower, questionLower) > 0.7 {
		result.Flags = append(result.Flags, PrefilterFlag{
			Code:     "non_answer",
			Severity: "warning",
			Message:  "Your answer appears to repeat the question rather than providing a substantive response.",
		})
	}

	hasCritical := false
	warningCount := 0
	for _, f := range result.Flags {
		if f.Severity == "critical" {
			hasCritical = true
		}
		if f.Severity == "warning" {
			warningCount++
		}
	}

	if hasCritical {
		result.AutoRedFlagScore = intPtr(1)
	} else if warningCount >= 3 {
		result.AutoRedFlagScore = intPtr(2)
	}

	// For factual questions, only skip AI on truly empty answers
	autoSkipThreshold := 5
	if questionType == "factual_yesno" || questionType == "factual_short" {
		autoSkipThreshold = 2
	}
	if wordCount < autoSkipThreshold {
		result.AutoCommScore = intPtr(1)
		result.NeedsAI = false
	}

	return result
}

func countWords(s string) int {
	count := 0
	inWord := false
	for _, r := range s {
		if unicode.IsSpace(r) {
			inWord = false
		} else if !inWord {
			inWord = true
			count++
		}
	}
	return count
}

// textSimilarity returns a rough Jaccard similarity between two strings' word sets.
func textSimilarity(a, b string) float64 {
	wordsA := strings.Fields(a)
	wordsB := strings.Fields(b)
	if len(wordsA) == 0 || len(wordsB) == 0 {
		return 0
	}

	setA := make(map[string]bool, len(wordsA))
	for _, w := range wordsA {
		setA[w] = true
	}
	setB := make(map[string]bool, len(wordsB))
	for _, w := range wordsB {
		setB[w] = true
	}

	intersection := 0
	for w := range setA {
		if setB[w] {
			intersection++
		}
	}

	union := len(setA) + len(setB) - intersection
	if union == 0 {
		return 0
	}
	return float64(intersection) / float64(union)
}

func intPtr(v int) *int {
	return &v
}
