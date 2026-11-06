package interview

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// The interview chat scores answers with Claude, the same provider as the
// profile check. Thinking is always on for this model and counts against
// max_tokens, so the ceiling sits well above the JSON we expect back.
const (
	claudeModel     = "claude-opus-5-5"
	claudeMaxTokens = 16000
	claudeTimeout   = 3 * time.Minute
)

func newClaudeClient(apiKey string) anthropic.Client {
	return anthropic.NewClient(
		option.WithAPIKey(apiKey),
		option.WithRequestTimeout(claudeTimeout),
	)
}

// callClaude sends a chat-style message list and returns the reply text.
// "system" messages become the system prompt; the rest are the user and
// assistant turns, in order.
func (va *VisaAnalyzer) callClaude(messages []GPTMessage, effort anthropic.BetaOutputConfigEffort) (string, error) {
	var system []anthropic.BetaTextBlockParam
	var turns []anthropic.BetaMessageParam
	for _, m := range messages {
		switch m.Role {
		case "system":
			system = append(system, anthropic.BetaTextBlockParam{Text: m.Content})
		case "assistant":
			turns = append(turns, anthropic.BetaMessageParam{
				Role:    anthropic.BetaMessageParamRoleAssistant,
				Content: []anthropic.BetaContentBlockParamUnion{anthropic.NewBetaTextBlock(m.Content)},
			})
		default:
			turns = append(turns, anthropic.NewBetaUserMessage(anthropic.NewBetaTextBlock(m.Content)))
		}
	}
	if len(turns) == 0 {
		return "", fmt.Errorf("no messages to send")
	}

	resp, err := va.client.Beta.Messages.New(context.Background(), anthropic.BetaMessageNewParams{
		Model:        claudeModel,
		MaxTokens:    claudeMaxTokens,
		System:       system,
		Messages:     turns,
		OutputConfig: anthropic.BetaOutputConfigParam{Effort: effort},
		// A safety decline is re-run on a fallback model inside the same call,
		// so a student's answer is not left unscored by a false positive.
		Fallbacks: anthropic.BetaFallbacksParamOfDefault(),
		Betas:     []anthropic.AnthropicBeta{anthropic.AnthropicBetaServerSideFallback2026_07_01},
	})
	if err != nil {
		return "", fmt.Errorf("claude request failed: %w", err)
	}
	if resp.StopReason == anthropic.BetaStopReasonRefusal {
		return "", fmt.Errorf("claude declined to evaluate this answer")
	}

	var sb strings.Builder
	for _, block := range resp.Content {
		if text, ok := block.AsAny().(anthropic.BetaTextBlock); ok {
			sb.WriteString(text.Text)
		}
	}
	out := strings.TrimSpace(sb.String())
	if out == "" {
		return "", fmt.Errorf("empty response from Claude (stop reason %s)", resp.StopReason)
	}
	return out, nil
}
