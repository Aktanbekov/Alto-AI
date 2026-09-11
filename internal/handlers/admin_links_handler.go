package handlers

import (
	"errors"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"altoai_mvp/internal/repository"
	"altoai_mvp/pkg/response"

	"github.com/gin-gonic/gin"
)

// AdminLinksHandler backs the "Links" screen: build a tagged link for a
// channel, hand it out, and read back what that channel actually sent.
//
// There is no redirect service behind this and deliberately so. A tagged link
// points straight at the site with a `?src=` on it, which the analytics client
// already captures on arrival and stamps onto every later event from that
// visitor. That means a link works the moment it is created - before this table
// has a row for it, and still after the row is deleted - and one fewer hop can
// fail between a post on Reddit and the landing page.
type AdminLinksHandler struct {
	links  repository.ReferralRepo
	events repository.AnalyticsRepo
}

func NewAdminLinksHandler(links repository.ReferralRepo, events repository.AnalyticsRepo) *AdminLinksHandler {
	return &AdminLinksHandler{links: links, events: events}
}

// siteBase is the origin tagged links are built against.
//
// Read from the same FRONTEND_URL the OAuth callback uses, so a staging deploy
// hands out staging links instead of silently printing the production domain.
func siteBase() string {
	base := strings.TrimSpace(os.Getenv("FRONTEND_URL"))
	if base == "" {
		base = "https://altovisas.com"
	}
	return strings.TrimRight(base, "/")
}

// linkRow is one link plus the traffic it brought in over the selected window.
type linkRow struct {
	repository.ReferralLink
	URL string `json:"url"`
	// Tracked is false for a src seen in the event stream that has no row in
	// referral_links: a link made before this screen existed, a code someone
	// typed by hand, or a row that was deleted. Shown rather than hidden - a
	// source sending real traffic is worth knowing about even unnamed.
	Tracked bool `json:"tracked"`
	repository.SourceStat
}

// dateRange reads ?from= and ?to=, defaulting to all time.
//
// Deliberately different from the analytics screens' 30-day default: a link
// handed out three months ago should show its lifetime numbers when you open
// the screen, not an empty row that reads as "this never worked".
func dateRange(c *gin.Context) (time.Time, time.Time) {
	var from, to time.Time
	if v := c.Query("from"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			from = t
		}
	}
	if v := c.Query("to"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			to = t.Add(24 * time.Hour)
		}
	}
	return from, to
}

func buildURL(code, destination string) string {
	if destination == "" {
		destination = "/"
	}
	return siteBase() + destination + "?src=" + code
}

// List returns every link with its numbers, plus any untracked source the event
// stream has seen, plus the untagged baseline.
func (h *AdminLinksHandler) List(c *gin.Context) {
	from, to := dateRange(c)

	links, err := h.links.List(c.Query("archived") == "1")
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "could not load links: "+err.Error())
		return
	}

	// A stats failure must not blank the screen: the links themselves are the
	// part you cannot reconstruct, and zeroed counts are obviously zeroed.
	stats, statsErr := h.events.SourceStats(from, to)
	bySrc := make(map[string]repository.SourceStat, len(stats))
	var untagged repository.SourceStat
	for _, s := range stats {
		if s.Src == "" {
			untagged = s
			continue
		}
		bySrc[s.Src] = s
	}

	rows := make([]linkRow, 0, len(links)+len(bySrc))
	seen := make(map[string]bool, len(links))
	for _, l := range links {
		seen[l.Code] = true
		stat := bySrc[l.Code]
		stat.Src = l.Code
		rows = append(rows, linkRow{
			ReferralLink: l,
			URL:          buildURL(l.Code, l.Destination),
			Tracked:      true,
			SourceStat:   stat,
		})
	}
	for code, stat := range bySrc {
		if seen[code] {
			continue
		}
		rows = append(rows, linkRow{
			ReferralLink: repository.ReferralLink{Code: code, Destination: "/"},
			URL:          buildURL(code, "/"),
			Tracked:      false,
			SourceStat:   stat,
		})
	}

	// Busiest first, then alphabetically so an all-zero list has a stable order
	// instead of reshuffling on every load.
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Visitors != rows[j].Visitors {
			return rows[i].Visitors > rows[j].Visitors
		}
		return rows[i].Code < rows[j].Code
	})

	out := gin.H{
		"links":     rows,
		"untagged":  untagged,
		"base_url":  siteBase(),
		"param":     "src",
		"generated": time.Now().UTC(),
	}
	if statsErr != nil {
		out["stats_error"] = statsErr.Error()
	}
	response.OK(c, out)
}

type linkBody struct {
	Code        string `json:"code"`
	Label       string `json:"label"`
	Destination string `json:"destination"`
	Notes       string `json:"notes"`
}

// Create adds a link. The code is normalized here rather than in the browser,
// so a link created through curl gets the same rules as one made in the panel.
func (h *AdminLinksHandler) Create(c *gin.Context) {
	var body linkBody
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request body")
		return
	}

	code, err := repository.NormalizeLinkCode(body.Code)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	dest, err := repository.NormalizeDestination(body.Destination)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	created, err := h.links.Create(repository.ReferralLink{
		Code:        code,
		Label:       trunc(body.Label, 120),
		Destination: dest,
		Notes:       trunc(body.Notes, 2000),
	})
	if errors.Is(err, repository.ErrLinkExists) {
		response.Error(c, http.StatusConflict, "that code is already in use")
		return
	}
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "could not create link: "+err.Error())
		return
	}

	response.Created(c, linkRow{
		ReferralLink: created,
		URL:          buildURL(created.Code, created.Destination),
		Tracked:      true,
		SourceStat:   repository.SourceStat{Src: created.Code},
	})
}

// Update edits the label, destination and notes. The code is fixed once
// created; see ReferralRepo.Update for why.
func (h *AdminLinksHandler) Update(c *gin.Context) {
	code, err := repository.NormalizeLinkCode(c.Param("code"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	var body linkBody
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request body")
		return
	}
	dest, err := repository.NormalizeDestination(body.Destination)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	updated, err := h.links.Update(code, repository.ReferralLink{
		Label:       trunc(body.Label, 120),
		Destination: dest,
		Notes:       trunc(body.Notes, 2000),
	})
	if errors.Is(err, repository.ErrLinkNotFound) {
		response.Error(c, http.StatusNotFound, "link not found")
		return
	}
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "could not update link: "+err.Error())
		return
	}

	response.OK(c, linkRow{
		ReferralLink: updated,
		URL:          buildURL(updated.Code, updated.Destination),
		Tracked:      true,
	})
}

// Archive hides a retired link from the default list. Its traffic is untouched.
func (h *AdminLinksHandler) Archive(c *gin.Context) {
	code, err := repository.NormalizeLinkCode(c.Param("code"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	var body struct {
		Archived bool `json:"archived"`
	}
	_ = c.ShouldBindJSON(&body)

	if err := h.links.Archive(code, body.Archived); err != nil {
		if errors.Is(err, repository.ErrLinkNotFound) {
			response.Error(c, http.StatusNotFound, "link not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, "could not update link: "+err.Error())
		return
	}
	response.OK(c, gin.H{"code": code, "archived": body.Archived})
}

// Delete removes the name. The events keep their src, so the source reappears
// in the list as untracked rather than vanishing.
func (h *AdminLinksHandler) Delete(c *gin.Context) {
	code, err := repository.NormalizeLinkCode(c.Param("code"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.links.Delete(code); err != nil {
		if errors.Is(err, repository.ErrLinkNotFound) {
			response.Error(c, http.StatusNotFound, "link not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, "could not delete link: "+err.Error())
		return
	}
	response.OK(c, gin.H{"deleted": code})
}
