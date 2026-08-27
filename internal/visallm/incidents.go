package visallm

import (
	"errors"
	"sync"
	"time"
)

// maxIncidents bounds the log. These are an operational signal — "is scoring
// broken right now, and since when" — not an audit trail, so a short window of
// the most recent failures is what matters.
const maxIncidents = 50

// Incident is one evaluation that failed for a reason the student was not shown.
type Incident struct {
	At         time.Time `json:"at"`
	Kind       string    `json:"kind"`   // billing | credentials | upstream
	Detail     string    `json:"detail"` // the sidecar's real message
	StatusCode int       `json:"status_code"`
	UserEmail  string    `json:"user_email,omitempty"`
}

// IncidentLog holds the recent failures behind the neutral message students see.
//
// Kept in memory rather than in Postgres on purpose: the question an admin asks
// is "are we out of credit right now", which the running process can answer. It
// resets on restart, and the counts below are since that restart.
type IncidentLog struct {
	mu    sync.RWMutex
	items []Incident // newest last
	count map[string]int
	since time.Time

	runs      []Run // successful evaluations, newest last
	totalRuns int
	totalCost float64
}

func NewIncidentLog() *IncidentLog {
	return &IncidentLog{count: map[string]int{}, since: time.Now().UTC()}
}

// Record files one failure, dropping the oldest once the window is full.
func (l *IncidentLog) Record(in Incident) {
	if in.At.IsZero() {
		in.At = time.Now().UTC()
	}
	l.mu.Lock()
	defer l.mu.Unlock()

	l.items = append(l.items, in)
	if len(l.items) > maxIncidents {
		l.items = l.items[len(l.items)-maxIncidents:]
	}
	l.count[in.Kind]++
}

// Snapshot returns the log newest-first, with the totals since process start.
func (l *IncidentLog) Snapshot() ([]Incident, map[string]int, time.Time) {
	l.mu.RLock()
	defer l.mu.RUnlock()

	out := make([]Incident, 0, len(l.items))
	for i := len(l.items) - 1; i >= 0; i-- {
		out = append(out, l.items[i])
	}
	totals := make(map[string]int, len(l.count))
	for k, v := range l.count {
		totals[k] = v
	}
	return out, totals, l.since
}

// Run is one successful evaluation and what it cost.
type Run struct {
	At        time.Time `json:"at"`
	Usage     Usage     `json:"usage"`
	UserEmail string    `json:"user_email,omitempty"`
}

// RecordRun files a successful evaluation alongside the failures. Spend and
// breakage are the same question for whoever runs this — "is the evaluator
// healthy and what is it costing" — so they share one log and one admin tab.
func (l *IncidentLog) RecordRun(r Run) {
	if r.At.IsZero() {
		r.At = time.Now().UTC()
	}
	l.mu.Lock()
	defer l.mu.Unlock()

	l.runs = append(l.runs, r)
	if len(l.runs) > maxIncidents {
		l.runs = l.runs[len(l.runs)-maxIncidents:]
	}
	l.totalCost += r.Usage.CostUSD
	l.totalRuns++
}

// Spend summarises cost since process start: recent runs newest-first, the
// number of evaluations, the total dollars, and the mean per evaluation.
func (l *IncidentLog) Spend() ([]Run, int, float64, float64) {
	l.mu.RLock()
	defer l.mu.RUnlock()

	out := make([]Run, 0, len(l.runs))
	for i := len(l.runs) - 1; i >= 0; i-- {
		out = append(out, l.runs[i])
	}
	avg := 0.0
	if l.totalRuns > 0 {
		avg = l.totalCost / float64(l.totalRuns)
	}
	return out, l.totalRuns, l.totalCost, avg
}

// KindOf classifies an evaluation failure for the log.
func KindOf(err error) string {
	var up *UpstreamError
	if errors.As(err, &up) {
		switch {
		case up.Billing():
			return "billing"
		case up.Credentials():
			return "credentials"
		}
	}
	return "upstream"
}
