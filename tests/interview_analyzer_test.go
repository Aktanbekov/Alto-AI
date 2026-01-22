package tests

import (
	"testing"
	"altoai_mvp/interview"
)

// Note: getGradeFromScore is not exported, so we test through ScoreToPercentage
// which uses the grade calculation internally

func TestScoreToPercentage(t *testing.T) {
	tests := []struct {
		name          string
		score         int
		criteriaCount int
		expected      float64
	}{
		{"3 criteria - minimum (3)", 3, 3, 0.0},
		{"3 criteria - maximum (15)", 15, 3, 100.0},
		{"3 criteria - middle (9)", 9, 3, 50.0},
		{"4 criteria - minimum (4)", 4, 4, 0.0},
		{"4 criteria - maximum (20)", 20, 4, 100.0},
		{"4 criteria - middle (12)", 12, 4, 50.0},
		{"7 criteria - minimum (7)", 7, 7, 0.0},
		{"7 criteria - maximum (35)", 35, 7, 100.0},
		{"7 criteria - middle (21)", 21, 7, 50.0},
		{"7 criteria - good (28)", 28, 7, 75.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := interview.ScoreToPercentage(tt.score, tt.criteriaCount)
			// Allow small floating point differences
			if result < tt.expected-0.1 || result > tt.expected+0.1 {
				t.Errorf("ScoreToPercentage(%d, %d) = %.2f, want approximately %.2f", tt.score, tt.criteriaCount, result, tt.expected)
			}
		})
	}
}

func TestNewVisaAnalyzer(t *testing.T) {
	// Test with empty API key (should use environment)
	analyzer := interview.NewVisaAnalyzer("")
	if analyzer == nil {
		t.Error("NewVisaAnalyzer returned nil")
	}

	// Test with provided API key
	analyzer2 := interview.NewVisaAnalyzer("test-key")
	if analyzer2 == nil {
		t.Error("NewVisaAnalyzer returned nil")
	}
}

