package handlers

import (
	"altoai_mvp/interview"
	"altoai_mvp/internal/services"
	"altoai_mvp/pkg/response"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type ChatHandler struct {
	userSvc services.UserService
}

func NewChatHandler(userSvc services.UserService) *ChatHandler {
	return &ChatHandler{userSvc: userSvc}
}

type ChatRequest struct {
	Messages []struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	} `json:"messages"`
	SessionID string `json:"session_id,omitempty"` // Optional: for continuing existing interview
	Level     string `json:"level,omitempty"`      // Optional: difficulty level (easy, medium, hard)
}

type ChatResponse struct {
	Content         string                      `json:"content"`                    // The question text or completion message
	SessionID       string                      `json:"session_id,omitempty"`       // Session ID for client to track
	QuestionID      string                      `json:"question_id,omitempty"`      // Current question ID
	Finished        bool                        `json:"finished"`                   // Whether interview is complete
	Scores          *interview.Scores           `json:"scores,omitempty"`           // Current risk scores
	IsNewSession    bool                        `json:"is_new_session,omitempty"`   // Whether this is a new session
	Analysis        *interview.AnalysisResponse `json:"analysis,omitempty"`         // Detailed analysis of the answer
	Grade           string                      `json:"grade,omitempty"`            // Letter grade (A-F) for the answer
	Suggestions     []string                    `json:"suggestions,omitempty"`      // Improvement suggestions
	ImprovedVersion string                      `json:"improved_version,omitempty"` // Suggested improved answer
	AllAnalyses     []AnswerAnalysis            `json:"all_analyses,omitempty"`     // All answers with analyses (when finished)
}

type AnswerAnalysis struct {
	QuestionID   string                      `json:"question_id"`
	QuestionText string                      `json:"question_text"`
	AnswerText   string                      `json:"answer_text"`
	Analysis     *interview.AnalysisResponse `json:"analysis,omitempty"`
}

func (h *ChatHandler) Chat(c *gin.Context) {
	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request body")
		return
	}

	// Get or create session
	var session *interview.Session
	var isNewSession bool

	if req.SessionID != "" {
		// Try to retrieve existing session
		if s, ok := interview.GetSession(req.SessionID); ok {
			session = s
			isNewSession = false
		} else {
			// Session not found, create new one with level
			session = interview.NewSessionWithLevel("", req.Level)
			interview.SaveSession(session)
			isNewSession = true
		}
	} else {
		// No session ID provided, create new session with level
		session = interview.NewSessionWithLevel("", req.Level)
		interview.SaveSession(session)
		isNewSession = true
	}

	// Log for debugging
	if req.Level != "" {
		log.Printf("Creating session with level: %s, selected questions: %d", req.Level, len(session.SelectedQuestions))
	}

	// If session is finished, return completion message
	if session.Status == interview.SessionStatusFinished {
		completionMsg := buildCompletionMessage(session)
		response.OK(c, ChatResponse{
			Content:      completionMsg,
			SessionID:    session.ID,
			Finished:     true,
			Scores:       &session.Scores,
			IsNewSession: false,
		})
		return
	}

	// If this is a new session, return the first question
	if isNewSession {
		if len(session.SelectedQuestions) == 0 {
			response.Error(c, http.StatusInternalServerError, "no questions selected for session")
			return
		}
		currentQ := session.SelectedQuestions[0]

		response.OK(c, ChatResponse{
			Content:      currentQ.Text,
			SessionID:    session.ID,
			QuestionID:   currentQ.ID,
			Finished:     false,
			IsNewSession: isNewSession,
		})
		return
	}

	// If no messages provided, return current question
	if len(req.Messages) == 0 {
		var currentQ *interview.Question
		for i, q := range session.SelectedQuestions {
			if q.ID == session.CurrentQuestion {
				currentQ = &session.SelectedQuestions[i]
				break
			}
		}
		if currentQ == nil {
			response.Error(c, http.StatusInternalServerError, "current question not found")
			return
		}

		response.OK(c, ChatResponse{
			Content:    currentQ.Text,
			SessionID:  session.ID,
			QuestionID: currentQ.ID,
			Finished:   false,
			Scores:     &session.Scores,
		})
		return
	}

	// Find the last user message
	var lastUserMessage string
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role == "user" {
			lastUserMessage = req.Messages[i].Content
			break
		}
	}

	if lastUserMessage == "" {
		response.Error(c, http.StatusBadRequest, "no user message found")
		return
	}

	// Get current question
	var currentQ *interview.Question
	for i, q := range session.SelectedQuestions {
		if q.ID == session.CurrentQuestion {
			currentQ = &session.SelectedQuestions[i]
			break
		}
	}
	if currentQ == nil {
		session.Status = interview.SessionStatusFinished
		interview.SaveSession(session)
		response.Error(c, http.StatusInternalServerError, "current question not found")
		return
	}

	// Check if we've already answered this question (prevent duplicate processing)
	alreadyAnswered := false
	for _, ans := range session.Answers {
		if ans.QuestionID == currentQ.ID {
			alreadyAnswered = true
			break
		}
	}

	// If we've already answered this question, just return the next question
	if alreadyAnswered {
		// Move to next question
		session.QuestionIndex++
		if session.QuestionIndex >= len(session.SelectedQuestions) {
			session.Status = interview.SessionStatusFinished

			// Generate session summary before completing
			summary, err := interview.GenerateSessionSummary(session)
			if err == nil && summary != nil {
				session.Summary = summary
			}

			interview.SaveSession(session)

			completionMsg := buildCompletionMessage(session)
			response.OK(c, ChatResponse{
				Content:   completionMsg,
				SessionID: session.ID,
				Finished:  true,
				Scores:    &session.Scores,
			})
			return
		}

		// Update session with next question
		nextQ := session.SelectedQuestions[session.QuestionIndex]
		session.CurrentQuestion = nextQ.ID
		interview.SaveSession(session)

		response.OK(c, ChatResponse{
			Content:    nextQ.Text,
			SessionID:  session.ID,
			QuestionID: nextQ.ID,
			Finished:   false,
			Scores:     &session.Scores,
		})
		return
	}

	// Record the answer
	answer := interview.Answer{
		QuestionID:   currentQ.ID,
		QuestionText: currentQ.Text,
		Text:         lastUserMessage,
		CreatedAt:    time.Now(),
	}

	// Call new analyzer for detailed feedback with session context
	analysis, err := interview.AnalyzeAnswer(session, *currentQ, lastUserMessage)
	if err != nil {
		// Log error for debugging
		log.Printf("Error analyzing answer: %v", err)
		// Continue without analysis (graceful degradation)
		analysis = nil
	} else if analysis != nil {
		log.Printf("Analysis successful: Classification=%s, TotalScore=%d",
			analysis.Classification, analysis.Scores.TotalScore)
	}

	// Attach analysis to answer
	if analysis != nil {
		answer.Analysis = analysis
		// Also create EvalResult for backward compatibility with scoring system
		eval := interview.ConvertAnalysisToEval(analysis, *currentQ)
		answer.Eval = eval
		// Update scores using the converted eval
		interview.ApplyEval(session, eval)
	}

	session.Answers = append(session.Answers, answer)

	// Move to next question
	session.QuestionIndex++
	if session.QuestionIndex >= len(session.SelectedQuestions) {
		// All questions answered
		session.Status = interview.SessionStatusFinished

		// Add delay to ensure analysis is fully processed before returning results
		time.Sleep(1 * time.Second)

		// Generate session summary before completing
		summary, err := interview.GenerateSessionSummary(session)
		if err == nil && summary != nil {
			session.Summary = summary
		}

		interview.SaveSession(session)

		// Build all analyses array from session answers
		allAnalyses := make([]AnswerAnalysis, 0, len(session.Answers))
		for _, ans := range session.Answers {
			if ans.Analysis != nil {
				allAnalyses = append(allAnalyses, AnswerAnalysis{
					QuestionID:   ans.QuestionID,
					QuestionText: ans.QuestionText,
					AnswerText:   ans.Text,
					Analysis:     ans.Analysis,
				})
			}
		}

		completionMsg := buildCompletionMessage(session)
		response.OK(c, ChatResponse{
			Content:     completionMsg,
			SessionID:   session.ID,
			QuestionID:  currentQ.ID, // Include question ID for the last answered question
			Finished:    true,
			Scores:      &session.Scores,
			Analysis:    analysis,
			Grade:       getGradeFromAnalysis(analysis),
			AllAnalyses: allAnalyses, // Include all analyses when finished
		})
		return
	}

	// Update session with next question
	nextQ := session.SelectedQuestions[session.QuestionIndex]
	session.CurrentQuestion = nextQ.ID
	interview.SaveSession(session)

	response.OK(c, ChatResponse{
		Content:         nextQ.Text,
		SessionID:       session.ID,
		QuestionID:      nextQ.ID,
		Finished:        false,
		Scores:          &session.Scores,
		Analysis:        analysis,
		Grade:           getGradeFromAnalysis(analysis),
		Suggestions:     getSuggestionsFromAnalysis(analysis),
		ImprovedVersion: getImprovedVersionFromAnalysis(analysis),
	})
}

// buildCompletionMessage creates a completion message based on session summary or scores
func buildCompletionMessage(session *interview.Session) string {
	// Use session summary if available (new grading system)
	if session.Summary != nil {
		return "Thank you for completing the interview practice session! " +
			"Your overall grade is: " + session.Summary.OverallGrade + " (Average Score: " +
			fmt.Sprintf("%.1f", session.Summary.AverageScore) + "). " +
			session.Summary.Recommendation + " " +
			"Good luck with your visa interview!"
	}

	// Fallback to old scoring system
	scores := session.Scores
	totalRisk := scores.Academic + scores.Financial + scores.IntentToReturn + scores.OverallRisk
	avgRisk := float64(totalRisk) / 4.0

	var assessment string
	if avgRisk < 25 {
		assessment = "excellent"
	} else if avgRisk < 50 {
		assessment = "good"
	} else if avgRisk < 75 {
		assessment = "moderate"
	} else {
		assessment = "needs improvement"
	}

	return "Thank you for completing the interview practice session! " +
		"Your overall assessment is: " + assessment + ". " +
		"Keep practicing to improve your answers and confidence. " +
		"Good luck with your visa interview!"
}

// Helper functions to extract data from analysis
func getGradeFromAnalysis(analysis *interview.AnalysisResponse) string {
	if analysis == nil {
		return ""
	}
	// Map classification to a rough letter grade for backward compatibility
	switch strings.ToLower(analysis.Classification) {
	case "excellent":
		return "A"
	case "good":
		return "B"
	case "average":
		return "C"
	case "weak":
		return "D"
	case "poor":
		return "F"
	default:
		return ""
	}
}

func getSuggestionsFromAnalysis(analysis *interview.AnalysisResponse) []string {
	if analysis == nil {
		return nil
	}
	// Use improvements array from structured feedback
	if len(analysis.Feedback.Improvements) > 0 {
		return analysis.Feedback.Improvements
	}
	// Fallback to overall feedback if no improvements
	if strings.TrimSpace(analysis.Feedback.Overall) != "" {
		return []string{analysis.Feedback.Overall}
	}
	return nil
}

func getImprovedVersionFromAnalysis(analysis *interview.AnalysisResponse) string {
	if analysis == nil {
		return ""
	}
	// Improved version no longer provided in new analysis format
	return ""
}
