package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"altoai_mvp/internal/repository"
	"altoai_mvp/pkg/response"

	"github.com/gin-gonic/gin"
)

// AdminAnalyticsHandler backs the five analytics screens. Admin-only; mounted
// under the same authenticated group as the rest of the panel.
type AdminAnalyticsHandler struct {
	events    repository.AnalyticsRepo
	evals     repository.EvaluationRepo
	statsPath string
}

func NewAdminAnalyticsHandler(events repository.AnalyticsRepo, evals repository.EvaluationRepo) *AdminAnalyticsHandler {
	path := os.Getenv("STATS_PATH")
	if path == "" {
		path = "./visa-llm/web/data/stats.json"
	}
	return &AdminAnalyticsHandler{events: events, evals: evals, statsPath: path}
}

// filtersFrom reads the shared filter set off the query string. Every screen
// accepts the same ones, so "friends vs strangers" works everywhere.
func filtersFrom(c *gin.Context) repository.EventQuery {
	q := repository.EventQuery{
		Src:         c.Query("src"),
		Consulate:   c.Query("consulate"),
		DegreeLevel: c.Query("degree_level"),
		Device:      c.Query("device"),
	}
	if v := c.Query("from"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			q.From = t
		}
	}
	if v := c.Query("to"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			q.To = t.Add(24 * time.Hour)
		}
	}
	// Default to the last 30 days rather than the whole table.
	if q.From.IsZero() && q.To.IsZero() {
		q.From = time.Now().AddDate(0, 0, -30)
	}
	return q
}

// The funnel, in the order a student actually moves through it.
var funnelSteps = []string{
	"page_view", "cta_click", "form_start", "form_complete",
	"report_generated", "report_view", "email_submit", "outcome_submitted",
}

// Events the spec defines but that have no place in the product to fire from
// yet. The panel labels these rather than showing a bare zero, so an
// un-built feature is never mistaken for a dead metric.
var notYetInstrumented = map[string]string{
	"flag_expand":               "report flags are not expandable yet",
	"locked_flag_click":         "no paywall or locked flags exist yet",
	"paywall_cta_click":         "no pricing tiers exist yet",
	"share_click":               "no share button yet",
	"feedback_answer":           "no feedback widget yet",
	"outcome_submitted":         "no outcome follow-up yet",
	"outcome_email_opened":      "no outcome follow-up yet",
	"fabrication_refusal_shown": "evaluator refuses, but nothing surfaces it yet",
	"report_revisit":            "not wired yet",
	"test_abandon":              "not wired yet",
	"form_abandon":              "not wired yet",
	"form_step_complete":        "the profile form is a single step",
	"plan_text_filled":          "no dedicated plan field yet",
}

// Funnel serves screen 1.
func (h *AdminAnalyticsHandler) Funnel(c *gin.Context) {
	q := filtersFrom(c)

	steps, err := h.events.FunnelCounts(q, funnelSteps)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "funnel query failed: "+err.Error())
		return
	}

	bySrc, _ := h.events.CountBy(q, "src")
	byDevice, _ := h.events.CountBy(q, "device")
	byDay, _ := h.events.CountBy(q, "day")

	// Mobile vs desktop completion, computed as its own pair of funnels: a
	// single ratio over mixed traffic hides the gap the spec asks about.
	mobile := q
	mobile.Device = "mobile"
	desktop := q
	desktop.Device = "desktop"
	mobileSteps, _ := h.events.FunnelCounts(mobile, []string{"page_view", "form_complete"})
	desktopSteps, _ := h.events.FunnelCounts(desktop, []string{"page_view", "form_complete"})

	response.OK(c, gin.H{
		"steps":                steps,
		"by_src":               bySrc,
		"by_device":            byDevice,
		"by_day":               byDay,
		"mobile_completion":    completion(mobileSteps),
		"desktop_completion":   completion(desktopSteps),
		"return_rate":          h.returnRates(q),
		"not_yet_instrumented": notYetInstrumented,
	})
}

func completion(steps []repository.FunnelStep) gin.H {
	if len(steps) < 2 {
		return gin.H{"visitors": 0, "completed": 0, "rate": 0}
	}
	rate := 0.0
	if steps[0].Visitors > 0 {
		rate = float64(steps[1].Visitors) / float64(steps[0].Visitors)
	}
	return gin.H{"visitors": steps[0].Visitors, "completed": steps[1].Visitors, "rate": rate}
}

// returnRates approximates D1/D7 by asking how many visitors seen in the window
// were also seen a day, and a week, later.
func (h *AdminAnalyticsHandler) returnRates(q repository.EventQuery) gin.H {
	rows, err := h.events.Query(repository.EventQuery{
		Names: []string{"page_view"}, Src: q.Src, From: q.From, To: q.To, Limit: 1000,
	})
	if err != nil {
		return gin.H{"d1": 0, "d7": 0}
	}
	first := map[string]time.Time{}
	days := map[string]map[int]bool{}
	for i := len(rows) - 1; i >= 0; i-- { // oldest first
		r := rows[i]
		if _, seen := first[r.VisitorID]; !seen {
			first[r.VisitorID] = r.Timestamp
			days[r.VisitorID] = map[int]bool{}
		}
		day := int(r.Timestamp.Sub(first[r.VisitorID]).Hours() / 24)
		days[r.VisitorID][day] = true
	}
	d1, d7 := 0, 0
	for v := range first {
		if days[v][1] {
			d1++
		}
		for d := 7; d <= 9; d++ {
			if days[v][d] {
				d7++
				break
			}
		}
	}
	total := float64(len(first))
	if total == 0 {
		return gin.H{"d1": 0, "d7": 0, "cohort": 0}
	}
	return gin.H{"d1": float64(d1) / total, "d7": float64(d7) / total, "cohort": len(first)}
}

// ReportQuality serves screen 2.
func (h *AdminAnalyticsHandler) ReportQuality(c *gin.Context) {
	q := filtersFrom(c)

	flags, _ := h.events.CountBy(withName(q, "report_generated"), "flag_ids")
	readiness, _ := h.events.CountBy(withName(q, "report_generated"), "readiness_band")
	latency, _ := h.events.NumericStat(q, "report_generated", "latency_ms")
	inTok, _ := h.events.NumericStat(q, "report_generated", "input_tokens")
	outTok, _ := h.events.NumericStat(q, "report_generated", "output_tokens")
	cost, _ := h.events.NumericStat(q, "report_generated", "cost_usd")
	dwell, _ := h.events.NumericStat(q, "report_dwell", "seconds")
	scroll, _ := h.events.CountBy(withName(q, "scroll_depth"), "pct")

	generated, _ := h.events.FunnelCounts(q, []string{"report_generated"})
	viewed, _ := h.events.FunnelCounts(q, []string{"report_view"})
	locked, _ := h.events.FunnelCounts(q, []string{"locked_flag_click"})
	shared, _ := h.events.FunnelCounts(q, []string{"share_click"})

	views := visitorsOf(viewed)
	response.OK(c, gin.H{
		"flag_frequency": flags,
		"readiness":      readiness,
		"latency_ms":     latency,
		"input_tokens":   inTok,
		"output_tokens":  outTok,
		"cost_usd":       cost,
		"dwell_seconds":  dwell,
		"scroll_depth":   scroll,
		"reports":        visitorsOf(generated),
		"report_views":   views,
		// The demand signal the spec calls the most important number: someone
		// asking "how do I fix this" without being prompted.
		"locked_flag_clicks":    visitorsOf(locked),
		"locked_click_per_view": ratio(visitorsOf(locked), views),
		"share_clicks":          visitorsOf(shared),
		"share_per_view":        ratio(visitorsOf(shared), views),
		"not_yet_instrumented":  notYetInstrumented,
	})
}

func withName(q repository.EventQuery, name string) repository.EventQuery {
	q.Names = []string{name}
	return q
}

func visitorsOf(steps []repository.FunnelStep) int {
	if len(steps) == 0 {
		return 0
	}
	return steps[0].Visitors
}

func ratio(a, b int) float64 {
	if b == 0 {
		return 0
	}
	return float64(a) / float64(b)
}

// CoverageGaps serves screen 3: what students ask for versus what the corpus
// actually holds. This is the data-acquisition roadmap.
func (h *AdminAnalyticsHandler) CoverageGaps(c *gin.Context) {
	q := filtersFrom(c)
	requestedCity, _ := h.events.CountBy(withName(q, "form_complete"), "consulate")
	requestedCountry, _ := h.events.CountBy(withName(q, "form_complete"), "country")

	corpusCity, corpusCountry := h.corpusCounts()
	// Without the stats file every consulate would look uncovered, which would
	// send someone collecting data they already have. Say so instead.
	corpusAvailable := len(corpusCity) > 0 || len(corpusCountry) > 0

	type gap struct {
		Name     string `json:"name"`
		Requests int    `json:"requests"`
		CorpusN  int    `json:"corpus_n"`
		Covered  bool   `json:"covered"`
	}
	build := func(requested, corpus map[string]int) []gap {
		out := make([]gap, 0, len(requested))
		for name, n := range requested {
			if name == "(none)" || strings.TrimSpace(name) == "" {
				continue
			}
			have := corpus[name]
			out = append(out, gap{Name: name, Requests: n, CorpusN: have, Covered: have > 0})
		}
		// Highest demand with the least data first — the acquisition order.
		sort.Slice(out, func(i, j int) bool {
			if out[i].CorpusN == out[j].CorpusN {
				return out[i].Requests > out[j].Requests
			}
			return out[i].CorpusN < out[j].CorpusN
		})
		return out
	}

	out := gin.H{
		"cities":           build(requestedCity, corpusCity),
		"countries":        build(requestedCountry, corpusCountry),
		"corpus_available": corpusAvailable,
	}
	if !corpusAvailable {
		out["warning"] = "Corpus statistics could not be read from " + h.statsPath +
			", so coverage is unknown rather than zero. Check STATS_PATH."
	}
	response.OK(c, out)
}

// corpusCounts reads decided-record counts per city and country from the same
// stats file the public dashboard uses.
func (h *AdminAnalyticsHandler) corpusCounts() (map[string]int, map[string]int) {
	cities, countries := map[string]int{}, map[string]int{}
	raw, err := os.ReadFile(h.statsPath)
	if err != nil {
		return cities, countries
	}
	var stats struct {
		ByCity map[string]struct {
			NDecided int `json:"n_decided"`
		} `json:"by_city"`
		ByCountry map[string]struct {
			NDecided int `json:"n_decided"`
		} `json:"by_country"`
	}
	if err := json.Unmarshal(raw, &stats); err != nil {
		return cities, countries
	}
	for k, v := range stats.ByCity {
		cities[k] = v.NDecided
	}
	for k, v := range stats.ByCountry {
		countries[k] = v.NDecided
	}
	return cities, countries
}

// Feedback serves screen 4. Open text plus the submitter's profile shape.
func (h *AdminAnalyticsHandler) Feedback(c *gin.Context) {
	q := filtersFrom(c)
	q.Names = []string{"feedback_answer"}
	q.Limit = 200
	rows, err := h.events.Query(q)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "feedback query failed: "+err.Error())
		return
	}
	response.OK(c, gin.H{
		"items": rows,
		"note":  notYetInstrumented["feedback_answer"],
	})
}

// CorpusGrowth serves screen 5, within what the stats file supports: per-year
// outcome mix and per-consulate totals. Month-by-consulate is not in the
// current aggregation, and the panel says so rather than inventing it.
func (h *AdminAnalyticsHandler) CorpusGrowth(c *gin.Context) {
	raw, err := os.ReadFile(h.statsPath)
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "corpus statistics unavailable")
		return
	}
	var stats struct {
		Meta    map[string]any `json:"meta"`
		ByYear  map[string]any `json:"by_year"`
		ByCity  map[string]any `json:"by_city"`
		Overall map[string]any `json:"overall"`
	}
	if err := json.Unmarshal(raw, &stats); err != nil {
		response.Error(c, http.StatusInternalServerError, "corpus statistics unreadable")
		return
	}
	response.OK(c, gin.H{
		"by_year": stats.ByYear,
		"by_city": stats.ByCity,
		"overall": stats.Overall,
		"meta":    stats.Meta,
		"limitation": "The corpus aggregation has per-year totals and per-consulate " +
			"totals, but no month-by-consulate cross. Regenerate the stats file with " +
			"a monthly aggregation to get the matrix the spec describes.",
	})
}
