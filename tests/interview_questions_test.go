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
	
	// Test default/medium level selection
	selected := interview.SelectQuestionsForSession("")
	if len(selected) == 0 {
		t.Error("Should select questions for session")
	}
	
	// Check that we have the right number of questions for default level
	// 6 questions (1 from each of 6 categories) + 2 mandatory (college and major) = 8 total
	expectedTotal := 8 // 6 category questions + 2 mandatory
	if len(selected) != expectedTotal {
		t.Errorf("Expected %d questions (6 + 2 mandatory), got %d", expectedTotal, len(selected))
	}
	
	// Verify first two questions are college and major
	if len(selected) >= 2 {
		if selected[0].ID != "q0_college" {
			t.Error("First question should be college question")
		}
		if selected[1].ID != "q0_major" {
			t.Error("Second question should be major question")
		}
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
	
	// Easy level should have exactly 4 questions + 2 mandatory (college and major) = 6 total
	expectedTotal := 6
	if len(selected) != expectedTotal {
		t.Errorf("Expected %d questions for easy level (4 + 2 mandatory), got %d", expectedTotal, len(selected))
	}
	
	// Verify first two questions are college and major
	if len(selected) >= 2 {
		if selected[0].ID != "q0_college" {
			t.Error("First question should be college question")
		}
		if selected[1].ID != "q0_major" {
			t.Error("Second question should be major question")
		}
	}
	
	// Check that we have exactly one question from each required category
	requiredCategories := map[string]bool{
		"Purpose of Study":      false,
		"University Choice":     false,
		"Financial Capability":  false,
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
	
	// Medium level should have exactly 6 questions + 2 mandatory (college and major) = 8 total
	expectedTotal := 8
	if len(selected) != expectedTotal {
		t.Errorf("Expected %d questions for medium level (6 + 2 mandatory), got %d", expectedTotal, len(selected))
	}
	
	// Verify first two questions are college and major
	if len(selected) >= 2 {
		if selected[0].ID != "q0_college" {
			t.Error("First question should be college question")
		}
		if selected[1].ID != "q0_major" {
			t.Error("Second question should be major question")
		}
	}
	
	// Check that we have exactly one question from each of all 6 categories
	requiredCategories := map[string]bool{
		"Purpose of Study":      false,
		"Academic Background":   false,
		"University Choice":     false,
		"Financial Capability":  false,
		"Post-Graduation Plans": false,
		"Immigration Intent":    false,
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
			t.Errorf("Medium level should include a question from category: %s", category)
		}
	}
}

func TestHardLevelSelection(t *testing.T) {
	err := interview.LoadQuestions("../interview/questions.json")
	if err != nil {
		t.Fatalf("LoadQuestions failed: %v", err)
	}
	
	// Test hard level selection (should use 6 questions, 1 from each category)
	selected := interview.SelectQuestionsForSession("hard")
	if len(selected) == 0 {
		t.Error("Should select questions for hard level session")
	}
	
	// Hard level should have exactly 6 questions + 2 mandatory (college and major) = 8 total
	expectedTotal := 8
	if len(selected) != expectedTotal {
		t.Errorf("Expected %d questions for hard level (6 + 2 mandatory), got %d", expectedTotal, len(selected))
	}
	
	// Verify first two questions are college and major
	if len(selected) >= 2 {
		if selected[0].ID != "q0_college" {
			t.Error("First question should be college question")
		}
		if selected[1].ID != "q0_major" {
			t.Error("Second question should be major question")
		}
	}
	
	// Check that we have exactly one question from each of all 6 categories
	requiredCategories := map[string]bool{
		"Purpose of Study":      false,
		"Academic Background":   false,
		"University Choice":     false,
		"Financial Capability":  false,
		"Post-Graduation Plans": false,
		"Immigration Intent":    false,
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
			t.Errorf("Hard level should include a question from category: %s", category)
		}
	}
}

