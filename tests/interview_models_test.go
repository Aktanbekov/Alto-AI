package tests

import (
	"encoding/json"
	"testing"
	"altoai_mvp/interview"
)

func TestAnalysisScoresJSON(t *testing.T) {
	mi := 5
	fu := 4
	ac := 4
	sr := 4
	co := 5
	cq := 5
	rf := 5
	scores := interview.AnalysisScores{
		MigrationIntent:        &mi,
		FinancialUnderstanding: &fu,
		AcademicCredibility:    &ac,
		SpecificityResearch:    &sr,
		Consistency:            &co,
		CommunicationQuality:   &cq,
		RedFlags:              &rf,
		TotalScore:            32,
	}

	jsonData, err := json.Marshal(scores)
	if err != nil {
		t.Fatalf("Failed to marshal AnalysisScores: %v", err)
	}

	var unmarshaled interview.AnalysisScores
	if err := json.Unmarshal(jsonData, &unmarshaled); err != nil {
		t.Fatalf("Failed to unmarshal AnalysisScores: %v", err)
	}

	if unmarshaled.MigrationIntent == nil || *unmarshaled.MigrationIntent != *scores.MigrationIntent {
		t.Errorf("MigrationIntent mismatch: got %v, want %d", unmarshaled.MigrationIntent, *scores.MigrationIntent)
	}
	if unmarshaled.FinancialUnderstanding == nil || *unmarshaled.FinancialUnderstanding != *scores.FinancialUnderstanding {
		t.Errorf("FinancialUnderstanding mismatch: got %v, want %d", unmarshaled.FinancialUnderstanding, *scores.FinancialUnderstanding)
	}
	if unmarshaled.SpecificityResearch == nil || *unmarshaled.SpecificityResearch != *scores.SpecificityResearch {
		t.Errorf("SpecificityResearch mismatch: got %v, want %d", unmarshaled.SpecificityResearch, *scores.SpecificityResearch)
	}
	if unmarshaled.TotalScore != scores.TotalScore {
		t.Errorf("TotalScore mismatch: got %d, want %d", unmarshaled.TotalScore, scores.TotalScore)
	}
}

func TestStructuredFeedbackJSON(t *testing.T) {
	feedback := interview.StructuredFeedback{
		Overall: "Good answer overall",
		ByCriterion: interview.FeedbackByCriterion{
			MigrationIntent:       "Strong return intent",
			FinancialUnderstanding: "Good financial understanding",
			AcademicCredibility:   "Strong academic fit",
			SpecificityResearch:   "Good research",
			Consistency:           "Consistent",
			CommunicationQuality:  "Clear communication",
			RedFlags:              "No red flags",
		},
		Improvements: []string{"Be more specific", "Add examples"},
	}

	jsonData, err := json.Marshal(feedback)
	if err != nil {
		t.Fatalf("Failed to marshal StructuredFeedback: %v", err)
	}

	var unmarshaled interview.StructuredFeedback
	if err := json.Unmarshal(jsonData, &unmarshaled); err != nil {
		t.Fatalf("Failed to unmarshal StructuredFeedback: %v", err)
	}

	if unmarshaled.Overall != feedback.Overall {
		t.Errorf("Overall mismatch: got %s, want %s", unmarshaled.Overall, feedback.Overall)
	}
	if len(unmarshaled.Improvements) != len(feedback.Improvements) {
		t.Errorf("Improvements length mismatch: got %d, want %d", len(unmarshaled.Improvements), len(feedback.Improvements))
	}
}

func TestAnalysisResponseJSON(t *testing.T) {
	mi := 5
	fu := 4
	ac := 4
	sr := 4
	co := 5
	cq := 5
	rf := 5
	response := interview.AnalysisResponse{
		Scores: interview.AnalysisScores{
			MigrationIntent:        &mi,
			FinancialUnderstanding: &fu,
			AcademicCredibility:    &ac,
			SpecificityResearch:    &sr,
			Consistency:            &co,
			CommunicationQuality:   &cq,
			RedFlags:              &rf,
			TotalScore:            32,
		},
		Classification: "Excellent",
		Feedback: interview.StructuredFeedback{
			Overall: "Good answer",
			ByCriterion: interview.FeedbackByCriterion{
				MigrationIntent:       "Good",
				FinancialUnderstanding: "Good",
				AcademicCredibility:   "Good",
				SpecificityResearch:   "Good",
				Consistency:           "Good",
				CommunicationQuality:  "Good",
				RedFlags:              "Good",
			},
			Improvements: []string{"Improve clarity"},
		},
	}

	jsonData, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("Failed to marshal AnalysisResponse: %v", err)
	}

	var unmarshaled interview.AnalysisResponse
	if err := json.Unmarshal(jsonData, &unmarshaled); err != nil {
		t.Fatalf("Failed to unmarshal AnalysisResponse: %v", err)
	}

	if unmarshaled.Classification != response.Classification {
		t.Errorf("Classification mismatch: got %s, want %s", unmarshaled.Classification, response.Classification)
	}
	if unmarshaled.Scores.TotalScore != response.Scores.TotalScore {
		t.Errorf("TotalScore mismatch: got %d, want %d", unmarshaled.Scores.TotalScore, response.Scores.TotalScore)
	}
}


