package interview

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"time"
)

// QuestionsByCategory stores questions organized by category
var QuestionsByCategory map[string][]string

// InitQuestions tries to load questions from the questions.json file
// It tries multiple possible paths to find the file
func InitQuestions() error {
	var possiblePaths []string
	
	// Try relative to working directory first
	if wd, err := os.Getwd(); err == nil {
		possiblePaths = append(possiblePaths,
			filepath.Join(wd, "interview/questions.json"),
			filepath.Join(wd, "questions.json"),
		)
	}
	
	// Try relative paths (for development)
	possiblePaths = append(possiblePaths,
		"interview/questions.json",
		"./interview/questions.json",
		"questions.json",
		"./questions.json",
	)
	
	// Try relative to executable (for production/Docker)
	if execPath, err := os.Executable(); err == nil {
		execDir := filepath.Dir(execPath)
		possiblePaths = append(possiblePaths,
			filepath.Join(execDir, "interview/questions.json"),
			filepath.Join(execDir, "questions.json"),
		)
	}
	
	// Try each path until one works
	var lastErr error
	for _, path := range possiblePaths {
		if err := LoadQuestions(path); err == nil {
			return nil
		} else {
			lastErr = err
		}
	}
	
	// Return the last error if all paths failed
	return fmt.Errorf("could not load questions.json from any of the tried paths: %w", lastErr)
}

// QuestionSelectionRules defines how many questions to ask from each category
// For hard level, we use 1 question per category (6 total)
var QuestionSelectionRules = map[string]int{
	"Purpose of Study":       1,
	"Academic Background":    1,
	"University Choice":      1,
	"Financial Capability":   1,
	"Post-Graduation Plans":  1,
	"Immigration Intent":     1,
}

// CategoryOrder defines the order in which categories should be asked
var CategoryOrder = []string{
	"Purpose of Study",
	"Academic Background",
	"University Choice",
	"Financial Capability",
	"Post-Graduation Plans",
	"Immigration Intent",
}

func LoadQuestions(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read questions file: %w", err)
	}

	var categories map[string][]string
	if err := json.Unmarshal(data, &categories); err != nil {
		return fmt.Errorf("unmarshal questions: %w", err)
	}

	QuestionsByCategory = make(map[string][]string)
	for category, questions := range categories {
		QuestionsByCategory[category] = questions
	}

	// Validate that all required categories exist
	for category := range QuestionSelectionRules {
		if _, ok := QuestionsByCategory[category]; !ok {
			return fmt.Errorf("required category '%s' not found in questions file", category)
		}
	}

	return nil
}

// SelectQuestionsForSession selects questions according to the rules
// level can be "easy", "medium", "hard", or "" for default
// Always includes college and major questions at the start
func SelectQuestionsForSession(level string) []Question {
	var selectedQuestions []Question
	rand.Seed(time.Now().UnixNano())

	// Always add college and major questions first
	selectedQuestions = append(selectedQuestions, Question{
		ID:       "q0_college",
		Category: "University Choice",
		Text:     "Which college or university will you attend?",
	})
	selectedQuestions = append(selectedQuestions, Question{
		ID:       "q0_major",
		Category: "Academic Background",
		Text:     "What is your major?",
	})

	// For easy level, select exactly 1 question from each of 4 specific categories
	if level == "easy" {
		easyCategories := []string{
			"Purpose of Study",
			"University Choice",
			"Financial Capability",
			"Post-Graduation Plans",
		}

		for _, category := range easyCategories {
			questions, ok := QuestionsByCategory[category]
			if !ok || len(questions) == 0 {
				continue
			}

			// Select one random question from this category
			available := make([]string, len(questions))
			copy(available, questions)
			
			// Shuffle and take 1 question
			rand.Shuffle(len(available), func(i, j int) {
				available[i], available[j] = available[j], available[i]
			})

			questionID := fmt.Sprintf("q%d_%s", len(selectedQuestions)+1, sanitizeCategory(category))
			selectedQuestions = append(selectedQuestions, Question{
				ID:       questionID,
				Category: category,
				Text:     available[0],
			})
		}

		return selectedQuestions
	}

	// For medium level, select exactly 1 question from each of 6 categories
	if level == "medium" {
		mediumCategories := []string{
			"Purpose of Study",
			"Academic Background",
			"University Choice",
			"Financial Capability",
			"Post-Graduation Plans",
			"Immigration Intent",
		}

		for _, category := range mediumCategories {
			questions, ok := QuestionsByCategory[category]
			if !ok || len(questions) == 0 {
				continue
			}

			// Select one random question from this category
			available := make([]string, len(questions))
			copy(available, questions)
			
			// Shuffle and take 1 question
			rand.Shuffle(len(available), func(i, j int) {
				available[i], available[j] = available[j], available[i]
			})

			questionID := fmt.Sprintf("q%d_%s", len(selectedQuestions)+1, sanitizeCategory(category))
			selectedQuestions = append(selectedQuestions, Question{
				ID:       questionID,
				Category: category,
				Text:     available[0],
			})
		}

		return selectedQuestions
	}

	// For hard level, select exactly 1 question from each of 6 categories (same as medium)
	if level == "hard" || level == "" {
		hardCategories := []string{
			"Purpose of Study",
			"Academic Background",
			"University Choice",
			"Financial Capability",
			"Post-Graduation Plans",
			"Immigration Intent",
		}

		for _, category := range hardCategories {
			questions, ok := QuestionsByCategory[category]
			if !ok || len(questions) == 0 {
				continue
			}

			// Select one random question from this category
			available := make([]string, len(questions))
			copy(available, questions)
			
			// Shuffle and take 1 question
			rand.Shuffle(len(available), func(i, j int) {
				available[i], available[j] = available[j], available[i]
			})

			questionID := fmt.Sprintf("q%d_%s", len(selectedQuestions)+1, sanitizeCategory(category))
			selectedQuestions = append(selectedQuestions, Question{
				ID:       questionID,
				Category: category,
				Text:     available[0],
			})
		}

		return selectedQuestions
	}

	return selectedQuestions
}

// sanitizeCategory converts category name to a valid ID suffix
func sanitizeCategory(category string) string {
	// Simple sanitization - replace spaces and special chars
	result := ""
	for _, char := range category {
		if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') {
			result += string(char)
		} else if char == ' ' || char == '/' {
			result += "_"
		}
	}
	return result
}
