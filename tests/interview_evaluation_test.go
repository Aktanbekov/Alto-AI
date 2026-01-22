package tests

import (
	"testing"
	"time"
	"altoai_mvp/interview"
)

func TestGenerateSessionSummary(t *testing.T) {
	session := interview.NewSession("test-user")
	
	// Add some answers with analyses (7-criteria, 7-35 total score)
	mi1, fu1, ac1, sr1, co1, cq1, rf1 := 5, 4, 4, 4, 5, 5, 5
	mi2, fu2, ac2, sr2, co2, cq2, rf2 := 4, 4, 4, 4, 4, 4, 5
	session.Answers = []interview.Answer{
		{
			QuestionID:   "q1",
			QuestionText: "Question 1",
			Text:         "Answer 1",
			CreatedAt:    time.Now(),
			Analysis: &interview.AnalysisResponse{
				Scores: interview.AnalysisScores{
					MigrationIntent:        &mi1,
					FinancialUnderstanding: &fu1,
					AcademicCredibility:    &ac1,
					SpecificityResearch:    &sr1,
					Consistency:            &co1,
					CommunicationQuality:   &cq1,
					RedFlags:              &rf1,
					TotalScore:             32,
				},
				Classification: "Excellent",
			},
		},
		{
			QuestionID:   "q2",
			QuestionText: "Question 2",
			Text:         "Answer 2",
			CreatedAt:    time.Now(),
			Analysis: &interview.AnalysisResponse{
				Scores: interview.AnalysisScores{
					MigrationIntent:        &mi2,
					FinancialUnderstanding: &fu2,
					AcademicCredibility:    &ac2,
					SpecificityResearch:    &sr2,
					Consistency:            &co2,
					CommunicationQuality:   &cq2,
					RedFlags:              &rf2,
					TotalScore:             29,
				},
				Classification: "Good",
			},
		},
	}

	summary, err := interview.GenerateSessionSummary(session)
	if err != nil {
		t.Fatalf("GenerateSessionSummary failed: %v", err)
	}

	if summary.TotalQuestions != 2 {
		t.Errorf("Expected 2 questions, got %d", summary.TotalQuestions)
	}
	// Average of 32 and 29 is 30.5
	if summary.AverageScore != 30.5 {
		t.Errorf("Expected average score 30.5, got %.2f", summary.AverageScore)
	}
	// With 7 criteria, 30.5 out of 35 max = ~87% => A (Excellent) using dynamic thresholds
	// Actually, let's check: 30.5 with 7 criteria (max 35) = 87% which is >= 85% => A
	if summary.OverallGrade != "A" {
		t.Errorf("Expected grade A (30.5/35 = 87%%), got %s", summary.OverallGrade)
	}
}

func TestGenerateSessionSummaryEmptySession(t *testing.T) {
	session := interview.NewSession("test-user")
	
	_, err := interview.GenerateSessionSummary(session)
	if err == nil {
		t.Error("Should return error for empty session")
	}
}


