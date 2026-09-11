package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"
)

// Query-side of AnalyticsRepo: the reads the admin panel is built from.

// where builds the shared filter clause. Everything is a bound parameter —
// none of these values is interpolated into SQL.
func (q EventQuery) where(startAt int) (string, []any) {
	var clauses []string
	var args []any
	n := startAt

	add := func(clause string, val any) {
		clauses = append(clauses, fmt.Sprintf(clause, n))
		args = append(args, val)
		n++
	}

	if len(q.Names) > 0 {
		clauses = append(clauses, fmt.Sprintf("name = ANY($%d)", n))
		args = append(args, pqStrings(q.Names))
		n++
	}
	if q.Src != "" {
		add("src = $%d", q.Src)
	}
	if !q.From.IsZero() {
		add("ts >= $%d", q.From)
	}
	if !q.To.IsZero() {
		add("ts <= $%d", q.To)
	}
	if q.Consulate != "" {
		add("consulate = $%d", q.Consulate)
	}
	if q.DegreeLevel != "" {
		add("degree_level = $%d", q.DegreeLevel)
	}
	switch q.Device {
	case "mobile":
		clauses = append(clauses, "is_mobile = TRUE")
	case "desktop":
		clauses = append(clauses, "is_mobile = FALSE")
	}

	if len(clauses) == 0 {
		return "", args
	}
	return " WHERE " + strings.Join(clauses, " AND "), args
}

// Query returns matching events newest-first, for the feedback inbox and for
// spot-checking the stream.
func (r *analyticsRepo) Query(q EventQuery) ([]EventRow, error) {
	where, args := q.where(1)
	limit := q.Limit
	if limit <= 0 || limit > 1000 {
		limit = 200
	}
	rows, err := r.db.Query(`
		SELECT id, name, visitor_id, session_id, COALESCE(user_id,''), ts,
		       COALESCE(src,''), COALESCE(path,''), COALESCE(lang,''), is_mobile, props
		FROM analytics_events`+where+
		fmt.Sprintf(" ORDER BY ts DESC LIMIT %d", limit), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []EventRow
	for rows.Next() {
		var e EventRow
		var props []byte
		if err := rows.Scan(&e.ID, &e.Name, &e.VisitorID, &e.SessionID, &e.UserID,
			&e.Timestamp, &e.Src, &e.Path, &e.Lang, &e.IsMobile, &props); err != nil {
			return nil, err
		}
		if len(props) > 0 {
			_ = json.Unmarshal(props, &e.Props)
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// CountBy groups matching events by one dimension. A dimension naming a column
// groups on the column; anything else is read out of props.
func (r *analyticsRepo) CountBy(q EventQuery, dimension string) (map[string]int, error) {
	// Whitelisted rather than interpolated: dimension reaches SQL as an
	// identifier, so it can never come straight from a request.
	columns := map[string]string{
		"name": "name", "src": "src", "path": "path", "lang": "lang",
		"consulate": "consulate", "degree_level": "degree_level",
		"device": "CASE WHEN is_mobile THEN 'mobile' ELSE 'desktop' END",
		"day":    "to_char(ts, 'YYYY-MM-DD')",
		"month":  "to_char(ts, 'YYYY-MM')",
	}

	where, args := q.where(1)
	var expr string
	if col, ok := columns[dimension]; ok {
		expr = col
	} else {
		// A props key. Passed as a bound parameter, not concatenated.
		expr = fmt.Sprintf("props->>$%d", len(args)+1)
		args = append(args, dimension)
	}

	rows, err := r.db.Query(
		`SELECT COALESCE(`+expr+`, '(none)') AS k, COUNT(*) FROM analytics_events`+
			where+` GROUP BY 1 ORDER BY 2 DESC`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[string]int{}
	for rows.Next() {
		var k string
		var n int
		if err := rows.Scan(&k, &n); err != nil {
			return nil, err
		}
		out[k] = n
	}
	return out, rows.Err()
}

// FunnelCounts counts distinct visitors reaching each named step, in order.
//
// Counted per visitor rather than per event: a funnel answers "how many people
// got this far", so five page_views from one person is one visitor. A visitor
// is credited with a step if they ever fired it inside the filter window, which
// tolerates the out-of-order arrival that client-side batching produces.
func (r *analyticsRepo) FunnelCounts(q EventQuery, steps []string) ([]FunnelStep, error) {
	out := make([]FunnelStep, 0, len(steps))
	var top, prev int
	var prevName string

	for i, step := range steps {
		sq := q
		sq.Names = []string{step}
		where, args := sq.where(1)

		var n int
		if err := r.db.QueryRow(
			`SELECT COUNT(DISTINCT visitor_id) FROM analytics_events`+where, args...,
		).Scan(&n); err != nil {
			return nil, err
		}

		s := FunnelStep{Name: step, Visitors: n}
		if i == 0 {
			top = n
			if n > 0 {
				s.FromPrev, s.FromTop = 1, 1
			}
		} else {
			// Measure against the last step that anyone actually reached. A
			// step with no visitors is a denominator of zero, and carrying it
			// forward would report every later step as 0% for no real reason.
			if prev > 0 {
				s.FromPrev = float64(n) / float64(prev)
				s.PrevName = prevName
			}
			if top > 0 {
				s.FromTop = float64(n) / float64(top)
			}
		}
		if n > 0 || i == 0 {
			prev, prevName = n, step
		}
		out = append(out, s)
	}
	return out, nil
}

// NumericStat summarises one numeric prop — seconds on a step, report latency,
// answer length. Median and p90 matter more than the mean here: a single
// abandoned tab with a 40-minute dwell would swamp an average.
func (r *analyticsRepo) NumericStat(q EventQuery, name, prop string) (NumericSummary, error) {
	var s NumericSummary
	sq := q
	sq.Names = []string{name}
	where, args := sq.where(1)

	// The prop key is bound, and the cast is guarded so a non-numeric value
	// does not error the whole query.
	valueExpr := fmt.Sprintf(
		`CASE WHEN props->>$%d ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (props->>$%d)::numeric END`,
		len(args)+1, len(args)+1)
	args = append(args, prop)

	row := r.db.QueryRow(`
		SELECT COUNT(v), COALESCE(AVG(v),0), COALESCE(SUM(v),0),
		       COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY v),0),
		       COALESCE(percentile_cont(0.9) WITHIN GROUP (ORDER BY v),0)
		FROM (SELECT `+valueExpr+` AS v FROM analytics_events`+where+`) t
		WHERE v IS NOT NULL`, args...)

	if err := row.Scan(&s.N, &s.Mean, &s.Sum, &s.Median, &s.P90); err != nil {
		if err == sql.ErrNoRows {
			return s, nil
		}
		return s, err
	}
	return s, nil
}

// pqStrings renders a Go slice as a Postgres text array literal, so name
// filters travel as a single bound parameter instead of generated placeholders.
func pqStrings(in []string) string {
	quoted := make([]string, 0, len(in))
	for _, s := range in {
		quoted = append(quoted, `"`+strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(s)+`"`)
	}
	sort.Strings(quoted)
	return "{" + strings.Join(quoted, ",") + "}"
}

// SourceStats counts, for every `src` value in the window, how far the people
// who arrived under it actually got.
//
// One grouped pass rather than a query per link: the panel lists every source
// side by side, and N+1 queries over a growing event table is the shape that
// stops working first. FILTER is used instead of a join per step for the same
// reason.
//
// Everything except page views is counted per visitor, not per event. "How many
// people this source sent" is the question being asked, and someone who
// reloaded the report four times is one person.
func (r *analyticsRepo) SourceStats(from, to time.Time) ([]SourceStat, error) {
	q := EventQuery{From: from, To: to}
	where, args := q.where(1)

	rows, err := r.db.Query(`
		SELECT COALESCE(src, '') AS s,
		       COUNT(DISTINCT visitor_id)                                            AS visitors,
		       COUNT(DISTINCT session_id)                                            AS sessions,
		       COUNT(*) FILTER (WHERE name = 'page_view')                            AS page_views,
		       COUNT(DISTINCT visitor_id) FILTER (WHERE name = 'form_start')         AS started,
		       COUNT(DISTINCT visitor_id) FILTER (WHERE name = 'form_complete')      AS completed,
		       COUNT(DISTINCT visitor_id) FILTER (WHERE name = 'report_generated')   AS reports,
		       COUNT(DISTINCT user_id)                                               AS signups,
		       MIN(ts) AS first_seen,
		       MAX(ts) AS last_seen
		FROM analytics_events`+where+`
		GROUP BY 1
		ORDER BY visitors DESC`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []SourceStat{}
	for rows.Next() {
		var s SourceStat
		var first, last sql.NullTime
		if err := rows.Scan(
			&s.Src, &s.Visitors, &s.Sessions, &s.PageViews,
			&s.FormStarts, &s.FormCompletes, &s.Reports, &s.Signups,
			&first, &last,
		); err != nil {
			return nil, err
		}
		if first.Valid {
			s.FirstSeen = first.Time
		}
		if last.Valid {
			s.LastSeen = last.Time
		}
		out = append(out, s)
	}
	return out, rows.Err()
}
