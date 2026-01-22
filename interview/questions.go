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
func SelectQuestionsForSession(level string) []Question {
	var selectedQuestions []Question
	rand.Seed(time.Now().UnixNano())

	// For easy level, select exactly 1 question from each of 4 specific categories
	if level == "easy" {
		easyCategories := []string{
			"Purpose of Study",
			"Academic Background",
			"University Choice",
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

	// For medium level, select exactly 1 question from each of 6 categories, then 1 extra from a random category
	if level == "medium" {
		allCategories := []string{
			"Purpose of Study",
			"Academic Background",
			"University Choice",
			"Financial Capability",
			"Post-Graduation Plans",
			"Immigration Intent",
		}

		selectedTexts := make(map[string]bool) // Track selected questions to avoid duplicates

		// First, select 1 question from each category
		for _, category := range allCategories {
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

			selectedText := available[0]
			selectedTexts[selectedText] = true

			questionID := fmt.Sprintf("q%d_%s", len(selectedQuestions)+1, sanitizeCategory(category))
			selectedQuestions = append(selectedQuestions, Question{
				ID:       questionID,
				Category: category,
				Text:     selectedText,
			})
		}

		// Add 1 extra question from a random category (avoid duplicates)
		if len(allCategories) > 0 {
			// Pick a random category
			randomCategory := allCategories[rand.Intn(len(allCategories))]
			questions, ok := QuestionsByCategory[randomCategory]
			
			if ok && len(questions) > 0 {
				// Filter out already selected questions
				available := make([]string, 0)
				for _, q := range questions {
					if !selectedTexts[q] {
						available = append(available, q)
					}
				}

				// If there are available questions, select one
				if len(available) > 0 {
					rand.Shuffle(len(available), func(i, j int) {
						available[i], available[j] = available[j], available[i]
					})

					questionID := fmt.Sprintf("q%d_%s", len(selectedQuestions)+1, sanitizeCategory(randomCategory))
					selectedQuestions = append(selectedQuestions, Question{
						ID:       questionID,
						Category: randomCategory,
						Text:     available[0],
					})
				}
			}
		}

		return selectedQuestions
	}

	// For hard level, select exactly 2 questions from each of 6 categories (check for duplicates)
	if level == "hard" || level == "" {
		allCategories := []string{
			"Purpose of Study",
			"Academic Background",
			"University Choice",
			"Financial Capability",
			"Post-Graduation Plans",
			"Immigration Intent",
		}

		selectedTexts := make(map[string]bool) // Track selected questions to avoid duplicates

		for _, category := range allCategories {
			questions, ok := QuestionsByCategory[category]
			if !ok || len(questions) == 0 {
				continue
			}

			// Filter out already selected questions from this category
			available := make([]string, 0)
			for _, q := range questions {
				if !selectedTexts[q] {
					available = append(available, q)
				}
			}

			// If we don't have enough questions, use what we have
			if len(available) == 0 {
				continue
			}

			// Shuffle available questions
			rand.Shuffle(len(available), func(i, j int) {
				available[i], available[j] = available[j], available[i]
			})

			// Select up to 2 questions from this category
			count := 2
			if len(available) < count {
				count = len(available)
			}

			for i := 0; i < count; i++ {
				selectedText := available[i]
				selectedTexts[selectedText] = true

				questionID := fmt.Sprintf("q%d_%s", len(selectedQuestions)+1, sanitizeCategory(category))
				selectedQuestions = append(selectedQuestions, Question{
					ID:       questionID,
					Category: category,
					Text:     selectedText,
				})
			}
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
