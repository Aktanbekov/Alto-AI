package tests

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

// What happens to a student's work when scoring is down.
//
// The failure message promises "your answers are saved". For a long time that
// was not true: the handler stored the submission only after a successful
// report, so an outage lost the answers along with the score. Worse, the
// outage the students actually hit never reached this code at all — the HTTP
// server's write deadline expired mid-run and closed the connection, so Caddy
// returned a bare 502 and nothing was recorded on either side.
//
// These tests pin down the half that is this package's to keep: when scoring
// fails, the answers are on the server and the set is not spent.

// scoreVerbose submits one set and returns the status and the decoded body.
func (f *flow) scoreVerbose(setIndex int, answer string) (int, map[string]any) {
	f.t.Helper()
	body, _ := json.Marshal(map[string]any{
		"set_index": setIndex,
		"planned_answers": []map[string]string{
			{"question": "Who is sponsoring you?", "answer": answer},
		},
	})
	w := f.do(http.MethodPost, "/api/v1/evaluate", string(body))
	var decoded map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &decoded)
	return w.Code, decoded
}

// storedAnswers returns the answer text of every row this flow has written,
// alongside whether each was flagged as unscored.
func (f *flow) storedAnswers() (texts []string, failed []bool) {
	f.t.Helper()
	rows, err := f.db.Query(
		`SELECT answers::text, failed FROM evaluations WHERE visitor_id = $1 ORDER BY created_at`,
		f.guestID)
	if err != nil {
		f.t.Fatalf("reading stored evaluations: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var blob string
		var didFail bool
		if err := rows.Scan(&blob, &didFail); err != nil {
			f.t.Fatalf("scanning stored evaluation: %v", err)
		}
		texts = append(texts, blob)
		failed = append(failed, didFail)
	}
	return texts, failed
}

// downSidecar is a sidecar that faults the way a real one does when the model
// call fails: a 500 with a detail string.
func downSidecar(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusInternalServerError)
	_ = json.NewEncoder(w).Encode(map[string]string{"detail": "upstream exploded"})
}

func TestAnswersSurviveAScoringOutage(t *testing.T) {
	f := newFlowWith(t, downSidecar)

	const answer = "My father, who runs a textile business in Surat."
	code, body := f.scoreVerbose(0, answer)

	if code != http.StatusBadGateway {
		t.Fatalf("expected 502 from the handler, got %d (%v)", code, body)
	}
	// The handler's own error, not an empty proxy body. This is the difference
	// between the page showing "Scoring is temporarily unavailable" and the
	// bare "Evaluation failed (502)" the frontend falls back to when the
	// response carries nothing.
	if msg, _ := body["error"].(string); !strings.Contains(msg, "temporarily unavailable") {
		t.Errorf("expected the neutral message in the body, got %v", body)
	}

	texts, failed := f.storedAnswers()
	if len(texts) != 1 {
		t.Fatalf("expected the submission to be stored, found %d rows", len(texts))
	}
	if !strings.Contains(texts[0], "textile business in Surat") {
		t.Errorf("the student's answer is not in the stored row: %s", texts[0])
	}
	if !failed[0] {
		t.Error("an unscored submission should be flagged failed")
	}
}

func TestAFailedScoreDoesNotSpendASet(t *testing.T) {
	f := newFlowWith(t, downSidecar)

	if code, body := f.scoreVerbose(0, "My father."); code != http.StatusBadGateway {
		t.Fatalf("expected 502, got %d (%v)", code, body)
	}

	// The row exists, but it bought nothing: the allowance is untouched.
	state := f.access()
	if state.SetsUsed != 0 {
		t.Errorf("a failed run spent a set: sets_used = %d", state.SetsUsed)
	}
	if state.SetsRemaining != state.SetsAllowed {
		t.Errorf("expected the full allowance intact, got %d of %d",
			state.SetsRemaining, state.SetsAllowed)
	}
}
