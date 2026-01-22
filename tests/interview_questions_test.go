package tests

import (
	"testing"
	"altoai_mvp/interview"
)

func TestLoadQuestions(t *testing.T) {
	// Test loading questions from JSON file
	err := interview.LoadQuestions("../interview/questions.json")
	if err != nil {
		t.Fatalf("LoadQuestions failed: %v", err)
	}
	
	if len(interview.QuestionsByCategory) == 0 {
		t.Error("Questions should be loaded")
	}
	
	// Check that categories exist (6 categories, Family/Sponsor Info removed)
	requiredCategories := []string{
		"Purpose of Study",
		"Academic Background",
		"University Choice",
		"Financial Capability",
		"Post-Graduation Plans",
		"Immigration Intent",
	}
	
	for _, category := range requiredCategories {
		questions, ok := interview.QuestionsByCategory[category]
		if !ok {
			t.Errorf("Category %s should exist", category)
		}
		if len(questions) == 0 {
			t.Errorf("Category %s should have questions", category)
		}
	}
}

func TestQuestionSelection(t *testing.T) {
	err := interview.LoadQuestions("../interview/questions.json")
	if err != nil {
		t.Fatalf("LoadQuestions failed: %v", err)
	}
	
	// Test default/hard level selection
	selected := interview.SelectQuestionsForSession("")
	if len(selected) == 0 {
		t.Error("Should select questions for session")
	}
	
	// Check that we have the right number of questions for default level (hard)
	// Hard level: 2 questions from each of 6 categories = 12 total
	expectedTotal := 12
	if len(selected) != expectedTotal {
		t.Errorf("Expected %d questions for hard level (2 from each category), got %d", expectedTotal, len(selected))
	}
	
	// Check that all selected questions have valid structure
	for _, q := range selected {
		if q.ID == "" {
			t.Error("Selected question should have ID")
		}
		if q.Text == "" {
			t.Error("Selected question should have text")
		}
		if q.Category == "" {
			t.Error("Selected question should have category")
		}
	}
}

func TestEasyLevelSelection(t *testing.T) {
	err := interview.LoadQuestions("../interview/questions.json")
	if err != nil {
		t.Fatalf("LoadQuestions failed: %v", err)
	}
	
	// Test easy level selection
	selected := interview.SelectQuestionsForSession("easy")
	if len(selected) == 0 {
		t.Error("Should select questions for easy level session")
	}
	
	// Easy level should have exactly 4 questions (1 from each of 4 categories)
	expectedTotal := 4
	if len(selected) != expectedTotal {
		t.Errorf("Expected %d questions for easy level (1 from each of 4 categories), got %d", expectedTotal, len(selected))
	}
	
	// Check that we have exactly one question from each required category
	requiredCategories := map[string]bool{
		"Purpose of Study":      false,
		"Academic Background":   false,
		"University Choice":     false,
		"Post-Graduation Plans": false,
	}
	
	for _, q := range selected {
		if _, ok := requiredCategories[q.Category]; ok {
			requiredCategories[q.Category] = true
		}
		if q.ID == "" {
			t.Error("Selected question should have ID")
		}
		if q.Text == "" {
			t.Error("Selected question should have text")
		}
		if q.Category == "" {
			t.Error("Selected question should have category")
		}
	}
	
	// Verify all required categories are present
	for category, found := range requiredCategories {
		if !found {
			t.Errorf("Easy level should include a question from category: %s", category)
		}
	}
}

func TestMediumLevelSelection(t *testing.T) {
	err := interview.LoadQuestions("../interview/questions.json")
	if err != nil {
		t.Fatalf("LoadQuestions failed: %v", err)
	}
	
	// Test medium level selection
	selected := interview.SelectQuestionsForSession("medium")
	if len(selected) == 0 {
		t.Error("Should select questions for medium level session")
	}
	
	// Medium level should have exactly 7 questions (1 from each of 6 categories + 1 extra from random category)
	expectedTotal := 7
	if len(selected) != expectedTotal {
		t.Errorf("Expected %d questions for medium level (6 + 1 extra), got %d", expectedTotal, len(selected))
	}
	
	// Check that we have at least one question from each of all 6 categories
	requiredCategories := map[string]bool{
		"Purpose of Study":      false,
		"Academic Background":   false,
		"University Choice":     false,
		"Financial Capability":  false,
		"Post-Graduation Plans": false,
		"Immigration Intent":    false,
	}
	
	// Track selected question texts to check for duplicates
	selectedTexts := make(map[string]bool)
	
	for _, q := range selected {
		if _, ok := requiredCategories[q.Category]; ok {
			requiredCategories[q.Category] = true
		}
		if q.ID == "" {
			t.Error("Selected question should have ID")
		}
		if q.Text == "" {
			t.Error("Selected question should have text")
		}
		if q.Category == "" {
			t.Error("Selected question should have category")
		}
		// Check for duplicates
		if selectedTexts[q.Text] {
			t.Errorf("Duplicate question found: %s", q.Text)
		}
		selectedTexts[q.Text] = true
	}
	
	// Verify all required categories are present
	for category, found := range requiredCategories {
		if !found {
			t.Errorf("Medium level should include a question from category: %s", category)
		}
	}
}

func TestHardLevelSelection(t *testing.T) {
	err := interview.LoadQuestions("../interview/questions.json")
	if err != nil {
		t.Fatalf("LoadQuestions failed: %v", err)
	}
	
	// Test hard level selection (should use 2 questions from each category)
	selected := interview.SelectQuestionsForSession("hard")
	if len(selected) == 0 {
		t.Error("Should select questions for hard level session")
	}
	
	// Hard level should have exactly 12 questions (2 from each of 6 categories)
	expectedTotal := 12
	if len(selected) != expectedTotal {
		t.Errorf("Expected %d questions for hard level (2 from each category), got %d", expectedTotal, len(selected))
	}
	
	// Check that we have exactly 2 questions from each of all 6 categories
	requiredCategories := map[string]int{
		"Purpose of Study":      0,
		"Academic Background":   0,
		"University Choice":     0,
		"Financial Capability":  0,
		"Post-Graduation Plans": 0,
		"Immigration Intent":    0,
	}
	
	// Track selected question texts to check for duplicates
	selectedTexts := make(map[string]bool)
	
	for _, q := range selected {
		if count, ok := requiredCategories[q.Category]; ok {
			requiredCategories[q.Category] = count + 1
		}
		if q.ID == "" {
			t.Error("Selected question should have ID")
		}
		if q.Text == "" {
			t.Error("Selected question should have text")
		}
		if q.Category == "" {
			t.Error("Selected question should have category")
		}
		// Check for duplicates
		if selectedTexts[q.Text] {
			t.Errorf("Duplicate question found: %s", q.Text)
		}
		selectedTexts[q.Text] = true
	}
	
	// Verify all required categories have exactly 2 questions
	for category, count := range requiredCategories {
		if count != 2 {
			t.Errorf("Hard level should have exactly 2 questions from category %s, got %d", category, count)
		}
	}
}