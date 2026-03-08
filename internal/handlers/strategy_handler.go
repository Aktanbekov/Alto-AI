package handlers

import (
	"altoai_mvp/pkg/response"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// StrategyUserProfile matches the frontend UserProfile for strategy generation.
type StrategyUserProfile struct {
	Major          string `json:"major"`
	ProgramLevel   string `json:"programLevel"`
	University     string `json:"university"`
	Funding        string `json:"funding"`
	Budget         string `json:"budget"`
	GPA            string `json:"gpa"`
	StudyGaps      string `json:"studyGaps"`
	MajorSwitch    string `json:"majorSwitch"`
	WorkExperience string `json:"workExperience"`
	RelativesInUS  string `json:"relativesInUS"`
	PriorRefusal   string `json:"priorRefusal"`
	PostGradPlan   string `json:"postGradPlan"`
	TiesToHome     string `json:"tiesToHome"`
}

// StrategyResult is the AI-generated strategy response.
type StrategyResult struct {
	RiskLevel            string   `json:"riskLevel"`
	RiskFactors          []string `json:"riskFactors"`
	Strengths            []string `json:"strengths"`
	PersonalizedStrategy string   `json:"personalizedStrategy"`
	Questions            []struct {
		Question    string `json:"question"`
		Intent      string `json:"intent"`
		SampleAnswer string `json:"sampleAnswer"`
		Tips        string `json:"tips"`
	} `json:"questions"`
	ClosingAdvice string `json:"closingAdvice"`
}

// GenerateStrategy handles POST /api/v1/generate-strategy
func GenerateStrategy(c *gin.Context) {
	var profile StrategyUserProfile
	if err := c.ShouldBindJSON(&profile); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request body")
		return
	}

	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		apiKey = os.Getenv("GPT_API_KEY")
	}
	if apiKey == "" {
		response.Error(c, http.StatusInternalServerError, "OpenAI API key not configured")
		return
	}

	prompt := buildStrategyPrompt(profile)
	systemPrompt := `You are a former US Visa Consular Officer. Analyze the F-1 Visa applicant profile and respond with ONLY valid JSON, no markdown or extra text. Use this exact structure:
{"riskLevel":"Low"|"Medium"|"High","riskFactors":["string"],"strengths":["string"],"personalizedStrategy":"string","questions":[{"question":"string","intent":"string","sampleAnswer":"string","tips":"string"}],"closingAdvice":"string"}
Generate exactly 5 questions: first 2 basic, last 3 challenging. Be strict but helpful. Golden answers must sound natural.`

	reqBody := map[string]any{
		"model": "gpt-3.5-turbo",
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": prompt},
		},
		"max_tokens":  4000,
		"temperature": 0.5,
	}
	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to build request")
		return
	}

	httpReq, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(bodyBytes))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to create request")
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to call OpenAI API")
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to read response")
		return
	}
	if resp.StatusCode != http.StatusOK {
		response.Error(c, resp.StatusCode, fmt.Sprintf("OpenAI API error: %s", string(respBody)))
		return
	}

	var openAIResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &openAIResp); err != nil || len(openAIResp.Choices) == 0 {
		response.Error(c, http.StatusInternalServerError, "invalid OpenAI response")
		return
	}

	content := strings.TrimSpace(openAIResp.Choices[0].Message.Content)
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSpace(content)

	var result StrategyResult
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to parse strategy response")
		return
	}

	// Validate and default
	if result.RiskLevel == "" {
		result.RiskLevel = "Medium"
	}
	if result.Questions == nil {
		result.Questions = []struct {
			Question    string `json:"question"`
			Intent      string `json:"intent"`
			SampleAnswer string `json:"sampleAnswer"`
			Tips        string `json:"tips"`
		}{}
	}

	c.JSON(http.StatusOK, result)
}

func buildStrategyPrompt(p StrategyUserProfile) string {
	return fmt.Sprintf(`Analyze this F-1 Visa applicant profile and return the JSON strategy only.

Profile:
- Major: %s
- Program Level: %s
- University: %s
- Funding: %s
- Budget: %s
- GPA: %s
- Study Gaps: %s
- Major Switch: %s
- Work Experience: %s
- Relatives in US: %s
- Prior Refusal: %s
- Post Grad Plan: %s
- Ties to Home: %s

Identify weak points (e.g. low budget, major switches, weak ties). Provide golden answers that sound natural.`, p.Major, p.ProgramLevel, p.University, p.Funding, p.Budget, p.GPA, p.StudyGaps, p.MajorSwitch, p.WorkExperience, p.RelativesInUS, p.PriorRefusal, p.PostGradPlan, p.TiesToHome)
}
