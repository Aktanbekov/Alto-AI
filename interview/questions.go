package interview

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"time"
)

// QuestionDef is the on-disk representation of a question in questions.json.
type QuestionDef struct {
	Text string `json:"text"`
	Type string `json:"type"` // "factual_yesno", "factual_short", "elaboration"
}

// QuestionsByCategory stores questions organized by category
var QuestionsByCategory map[string][]QuestionDef

// loadedPath records which file QuestionsByCategory came from, so the admin
// API can write edits back to the same location it was loaded from.
var loadedPath string

// QuestionsPath returns the file the question bank was loaded from, or "" if
// questions have not been loaded yet.
func QuestionsPath() string { return loadedPath }

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

	var categories map[string][]QuestionDef
	if err := json.Unmarshal(data, &categories); err != nil {
		return fmt.Errorf("unmarshal questions: %w", err)
	}

	// Validate before swapping in, so a bad file leaves the previously loaded
	// questions intact rather than wiping them.
	for category := range QuestionSelectionRules {
		if len(categories[category]) == 0 {
			return fmt.Errorf("required category '%s' not found in questions file", category)
		}
	}

	QuestionsByCategory = make(map[string][]QuestionDef)
	for category, questions := range categories {
		QuestionsByCategory[category] = questions
	}
	loadedPath = path

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

			available := make([]QuestionDef, len(questions))
			copy(available, questions)
			
			rand.Shuffle(len(available), func(i, j int) {
				available[i], available[j] = available[j], available[i]
			})

			questionID := fmt.Sprintf("q%d_%s", len(selectedQuestions)+1, sanitizeCategory(category))
			selectedQuestions = append(selectedQuestions, Question{
				ID:       questionID,
				Category: category,
				Text:     available[0].Text,
				Type:     available[0].Type,
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

		selectedTexts := make(map[string]bool)

		for _, category := range allCategories {
			questions, ok := QuestionsByCategory[category]
			if !ok || len(questions) == 0 {
				continue
			}

			available := make([]QuestionDef, len(questions))
			copy(available, questions)
			
			rand.Shuffle(len(available), func(i, j int) {
				available[i], available[j] = available[j], available[i]
			})

			selected := available[0]
			selectedTexts[selected.Text] = true

			questionID := fmt.Sprintf("q%d_%s", len(selectedQuestions)+1, sanitizeCategory(category))
			selectedQuestions = append(selectedQuestions, Question{
				ID:       questionID,
				Category: category,
				Text:     selected.Text,
				Type:     selected.Type,
			})
		}

		// Add 1 extra question from a random category (avoid duplicates)
		if len(allCategories) > 0 {
			randomCategory := allCategories[rand.Intn(len(allCategories))]
			questions, ok := QuestionsByCategory[randomCategory]
			
			if ok && len(questions) > 0 {
				var available []QuestionDef
				for _, q := range questions {
					if !selectedTexts[q.Text] {
						available = append(available, q)
					}
				}

				if len(available) > 0 {
					rand.Shuffle(len(available), func(i, j int) {
						available[i], available[j] = available[j], available[i]
					})

					questionID := fmt.Sprintf("q%d_%s", len(selectedQuestions)+1, sanitizeCategory(randomCategory))
					selectedQuestions = append(selectedQuestions, Question{
						ID:       questionID,
						Category: randomCategory,
						Text:     available[0].Text,
						Type:     available[0].Type,
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

		selectedTexts := make(map[string]bool)

		for _, category := range allCategories {
			questions, ok := QuestionsByCategory[category]
			if !ok || len(questions) == 0 {
				continue
			}

			var available []QuestionDef
			for _, q := range questions {
				if !selectedTexts[q.Text] {
					available = append(available, q)
				}
			}

			if len(available) == 0 {
				continue
			}

			rand.Shuffle(len(available), func(i, j int) {
				available[i], available[j] = available[j], available[i]
			})

			count := 2
			if len(available) < count {
				count = len(available)
			}

			for i := 0; i < count; i++ {
				selected := available[i]
				selectedTexts[selected.Text] = true

				questionID := fmt.Sprintf("q%d_%s", len(selectedQuestions)+1, sanitizeCategory(category))
				selectedQuestions = append(selectedQuestions, Question{
					ID:       questionID,
					Category: category,
					Text:     selected.Text,
					Type:     selected.Type,
				})
			}
		}

		return selectedQuestions
	}

	return selectedQuestions
}

// sanitizeCategory converts category name to a valid ID suffix
func sanitizeCategory(category string) string {
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
