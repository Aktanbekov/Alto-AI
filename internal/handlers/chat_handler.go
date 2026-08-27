package handlers

import (
	"altoai_mvp/interview"
	"altoai_mvp/internal/repository"
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
	userSvc    services.UserService
	interviews repository.InterviewRepo
}

func NewChatHandler(userSvc services.UserService, interviews repository.InterviewRepo) *ChatHandler {
	return &ChatHandler{userSvc: userSvc, interviews: interviews}
}

// persistSession writes a durable record of a finished interview so the admin
// panel can report on it. The live session still lives in memory; this is a
// best-effort snapshot, and a failure here must never break the interview, so
// errors are logged rather than returned.
func (h *ChatHandler) persistSession(session *interview.Session, userEmail, level string) {
	if h.interviews == nil || session == nil {
		return
	}

	finishedAt := session.UpdatedAt
	rec := repository.InterviewSession{
		ID:            session.ID,
		UserEmail:     userEmail,
		Level:         level,
		Status:        string(session.Status),
		QuestionCount: len(session.SelectedQuestions),
		AnswerCount:   len(session.Answers),
		StartedAt:     session.CreatedAt,
		FinishedAt:    &finishedAt,
	}
	if session.SessionEval != nil {
		score := session.SessionEval.OverallScore
		rec.OverallScore = &score
		rec.OverallGrade = session.SessionEval.OverallGrade
		rec.Verdict = session.SessionEval.Verdict
	}

	// Prefer the deep per-answer evaluation when V2 produced one, since it
	// carries the classification the admin UI displays.
	deepByID := map[string]interview.DeepAnswerAnalysis{}
	if session.SessionEval != nil {
		for _, a := range session.SessionEval.Answers {
			deepByID[a.QuestionID] = a
		}
	}

	answers := make([]repository.InterviewAnswer, 0, len(session.Answers))
	for _, a := range session.Answers {
		row := repository.InterviewAnswer{
			QuestionID:   a.QuestionID,
			QuestionText: a.QuestionText,
			AnswerText:   a.Text,
		}
		if deep, ok := deepByID[a.QuestionID]; ok {
			score := deep.Scores.TotalScore
			row.TotalScore = &score
			row.Classification = deep.Classification
		} else if a.Analysis != nil {
			score := a.Analysis.Scores.TotalScore
			row.TotalScore = &score
			row.Classification = a.Analysis.Classification
		}
		answers = append(answers, row)
	}

	if err := h.interviews.SaveSession(rec, answers); err != nil {
		log.Printf("failed to persist interview session %s: %v", session.ID, err)
	}
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
	Analysis        *interview.AnalysisResponse `json:"analysis,omitempty"`         // V1: Detailed analysis of the answer
	Grade           string                      `json:"grade,omitempty"`            // Letter grade (A-F) for the answer
	Suggestions     []string                    `json:"suggestions,omitempty"`      // Improvement suggestions
	ImprovedVersion string                      `json:"improved_version,omitempty"` // Suggested improved answer
	AllAnalyses     []AnswerAnalysis            `json:"all_analyses,omitempty"`     // V1: All answers with analyses (when finished)
	// V2 fields
	LightweightAnalysis *interview.LightweightAnalysis `json:"lightweight_analysis,omitempty"` // V2: per-answer lightweight feedback
	SessionEvaluation   *interview.SessionEvaluation   `json:"session_evaluation,omitempty"`   // V2: full post-session evaluation
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

	// The interview finishes on several different code paths, each returning
	// early. Persisting from a defer catches all of them in one place.
	var userEmail string
	if claims, ok := currentClaims(c); ok && claims != nil {
		userEmail = claims.Email
	}
	defer func() {
		if session != nil && session.Status == interview.SessionStatusFinished {
			h.persistSession(session, userEmail, req.Level)
		}
	}()

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
		Category:     currentQ.Category,
		Text:         lastUserMessage,
		CreatedAt:    time.Now(),
	}

	useV2 := interview.IsAnalysisV2Enabled()

	var analysis *interview.AnalysisResponse
	var lightweight *interview.LightweightAnalysis

	if useV2 {
		// V2: Lightweight per-answer analysis (prefilter + 2 criteria only)
		lw, err := interview.AnalyzeAnswerLightweight(session, *currentQ, lastUserMessage)
		if err != nil {
			log.Printf("V2 lightweight analysis error: %v", err)
		} else {
			lightweight = lw
			answer.Lightweight = lw
			log.Printf("V2 lightweight: comm=%d, red_flags=%d, feedback=%s",
				lw.CommunicationQuality, lw.RedFlags, lw.QuickFeedback)
		}
	} else {
		// V1: Full per-answer analysis (all 7 criteria per call)
		var err error
		analysis, err = interview.AnalyzeAnswer(session, *currentQ, lastUserMessage)
		if err != nil {
			log.Printf("Error analyzing answer: %v", err)
			analysis = nil
		} else if analysis != nil {
			log.Printf("Analysis successful: Classification=%s, TotalScore=%d",
				analysis.Classification, analysis.Scores.TotalScore)
		}

		if analysis != nil {
			answer.Analysis = analysis
			eval := interview.ConvertAnalysisToEval(analysis, *currentQ)
			answer.Eval = eval
			interview.ApplyEval(session, eval)
		}
	}

	session.Answers = append(session.Answers, answer)

	// Move to next question
	session.QuestionIndex++
	if session.QuestionIndex >= len(session.SelectedQuestions) {
		// All questions answered
		session.Status = interview.SessionStatusFinished

		if useV2 {
			// V2: Run deep batch evaluation + consistency check
			log.Printf("V2: Starting deep batch evaluation for session %s (%d answers)", session.ID, len(session.Answers))
			sessionEval, err := interview.EvaluateSessionDeep(session)
			if err != nil {
				log.Printf("V2 deep evaluation error: %v", err)
			} else {
				session.SessionEval = sessionEval
				log.Printf("V2 deep eval complete: grade=%s, verdict=%s, score=%d",
					sessionEval.OverallGrade, sessionEval.Verdict, sessionEval.OverallScore)
			}

			interview.SaveSession(session)

			completionMsg := buildCompletionMessageV2(session)
			resp := ChatResponse{
				Content:             completionMsg,
				SessionID:           session.ID,
				QuestionID:          currentQ.ID,
				Finished:            true,
				Scores:              &session.Scores,
				LightweightAnalysis: lightweight,
				SessionEvaluation:   session.SessionEval,
			}
			response.OK(c, resp)
			return
		}

		// V1 path
		time.Sleep(1 * time.Second)
		summary, err := interview.GenerateSessionSummary(session)
		if err == nil && summary != nil {
			session.Summary = summary
		}

		interview.SaveSession(session)

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
			QuestionID:  currentQ.ID,
			Finished:    true,
			Scores:      &session.Scores,
			Analysis:    analysis,
			Grade:       getGradeFromAnalysis(analysis),
			AllAnalyses: allAnalyses,
		})
		return
	}

	// Update session with next question
	nextQ := session.SelectedQuestions[session.QuestionIndex]
	session.CurrentQuestion = nextQ.ID
	interview.SaveSession(session)

	if useV2 {
		response.OK(c, ChatResponse{
			Content:             nextQ.Text,
			SessionID:           session.ID,
			QuestionID:          nextQ.ID,
			Finished:            false,
			Scores:              &session.Scores,
			LightweightAnalysis: lightweight,
		})
	} else {
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

func buildCompletionMessageV2(session *interview.Session) string {
	if session.SessionEval != nil {
		eval := session.SessionEval
		return fmt.Sprintf("Thank you for completing the interview practice session! "+
			"Your overall grade is: %s (%s, Score: %d/100). "+
			"%s Good luck with your visa interview!",
			eval.OverallGrade, eval.Verdict, eval.OverallScore, eval.Recommendation)
	}
	return buildCompletionMessage(session)
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
