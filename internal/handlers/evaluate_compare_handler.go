package handlers

import (
	"context"
	"net/http"
	"sort"
	"sync"
	"time"

	"altoai_mvp/internal/visallm"
	"altoai_mvp/pkg/response"

	"github.com/gin-gonic/gin"
)

/*
 * Scoring one set of answers with several models at once, for admins.
 *
 * This exists to answer "is the model we pay for actually better than the
 * cheaper ones" with the product's own prompt and the product's own corpus,
 * rather than with a benchmark that resembles neither. The sidecar keeps the
 * retrieval and the instruction identical across the three runs, so what comes
 * back differs only by model.
 *
 * The same three-provider runner now powers the student path. This admin route
 * remains separate because:
 *   - it does not consume or check the free-set allowance, because an
 *     evaluation nobody reads as advice should not cost a student anything;
 *   - it stores nothing. A comparison is a measurement of ours, not a report
 *     belonging to a person, and writing it to the evaluations table would
 *     corrupt both the admin's own set counts and the report-quality analytics.
 */

// compareModels are the providers a comparison runs, in the order the screen
// shows them. The keys are the sidecar's, not the vendors' model ids.
var compareModels = []string{"opus", "terra", "deepseek"}

// ModelResult is one model's attempt at the same profile. Exactly one of
// Evaluation or Error is meaningful: a provider that failed still occupies its
// row, because "DeepSeek could not answer" is itself a comparison result and
// hiding it would silently turn a three-way test into a two-way one.
type ModelResult struct {
	Model      string              `json:"model"`
	Evaluation *visallm.Evaluation `json:"evaluation,omitempty"`
	Usage      *visallm.Usage      `json:"usage,omitempty"`
	LatencyMS  int64               `json:"latency_ms"`
	Error      string              `json:"error,omitempty"`
}

// Compare runs one profile through every model in compareModels and returns all
// of their answers.
//
// The runs are concurrent because they are independent and slow: three
// sequential evaluations would take the sum of three model calls and would
// certainly outlive the server's write deadline. Run together, the request
// takes as long as the slowest one.
func (h *EvaluateHandler) Compare(c *gin.Context) {
	var body struct {
		visallm.ProfileRequest
		SetIndex int `json:"set_index"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request body")
		return
	}
	req := body.ProfileRequest
	if len(req.PlannedAnswers) == 0 {
		response.Error(c, http.StatusBadRequest, "add at least one question and answer")
		return
	}

	// Fill in the admin's own college and major the same way the student path
	// does, so a comparison run is shaped like the request it is standing in for.
	if claims, ok := currentClaims(c); ok && claims != nil && h.userSvc != nil {
		if user, err := h.userSvc.GetByEmail(c.Request.Context(), claims.Email); err == nil {
			if req.University == "" {
				req.University = user.College
			}
			if req.Major == "" {
				req.Major = user.Major
			}
		}
	}

	results, _ := h.runAll(c.Request.Context(), req)

	// Stable order regardless of which finished first: the screen compares
	// columns, and columns that move between runs are unreadable.
	sort.SliceStable(results, func(a, b int) bool {
		return indexOfModel(results[a].Model) < indexOfModel(results[b].Model)
	})

	response.OK(c, gin.H{"results": results})
}

// runOne scores the profile with a single model, converting a failure into a
// filled-in row as well as returning the typed error to the caller.
func (h *EvaluateHandler) runOne(ctx context.Context, req visallm.ProfileRequest, model string) (ModelResult, error) {
	req.Model = model
	started := time.Now()
	evaluation, usage, err := h.client.EvaluateWithUsage(ctx, req)
	out := ModelResult{Model: model, LatencyMS: time.Since(started).Milliseconds()}
	if err != nil {
		// Admins see the real text. The neutral student-facing message exists to
		// keep billing and key problems away from people who cannot act on them;
		// the whole point of this screen is to be able to act on them.
		out.Error = err.Error()
		return out, err
	}
	out.Evaluation, out.Usage = &evaluation, &usage
	return out, nil
}

// runAll fans one immutable profile out to all three providers. Results and
// errors retain model order, so a partial outage cannot relabel a neighbour's
// report and the caller can choose its own error policy (detailed for admins,
// neutral for students).
func (h *EvaluateHandler) runAll(ctx context.Context, req visallm.ProfileRequest) ([]ModelResult, []error) {
	results := make([]ModelResult, len(compareModels))
	errs := make([]error, len(compareModels))
	var wg sync.WaitGroup
	for i, model := range compareModels {
		wg.Add(1)
		go func(i int, model string) {
			defer wg.Done()
			results[i], errs[i] = h.runOne(ctx, req, model)
		}(i, model)
	}
	wg.Wait()
	return results, errs
}

func indexOfModel(model string) int {
	for i, m := range compareModels {
		if m == model {
			return i
		}
	}
	return len(compareModels)
}
