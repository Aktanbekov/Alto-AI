package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"os"
	"sync"

	"altoai_mvp/pkg/response"

	"github.com/gin-gonic/gin"
)

// CachedJSONHandler serves one of the corpus data files straight from disk.
//
// The files are read from disk rather than proxied from the visa-llm sidecar so
// the site still renders when that service is down. They are tens of kilobytes
// and change only when the corpus is rebuilt, so each is read once, held in
// memory and served with an ETag.
type CachedJSONHandler struct {
	path string
	what string

	once sync.Once
	body []byte
	etag string
	err  error
}

func NewCachedJSONHandler(envVar, defaultPath, what string) *CachedJSONHandler {
	path := os.Getenv(envVar)
	if path == "" {
		path = defaultPath
	}
	return &CachedJSONHandler{path: path, what: what}
}

// NewStatsHandler serves the statistics behind the public dashboard.
func NewStatsHandler() *CachedJSONHandler {
	return NewCachedJSONHandler(
		"STATS_PATH", "./visa-llm/web/data/stats.json", "corpus statistics")
}

// NewQuestionsHandler serves the question bank the test draws its rounds from:
// every question type with its real phrasings, ordered by how often it is asked.
func NewQuestionsHandler() *CachedJSONHandler {
	return NewCachedJSONHandler(
		"QUESTIONS_PATH", "./visa-llm/web/data/questions.json", "question bank")
}

func (h *CachedJSONHandler) load() {
	h.body, h.err = os.ReadFile(h.path)
	if h.err == nil {
		sum := sha256.Sum256(h.body)
		h.etag = `"` + hex.EncodeToString(sum[:16]) + `"`
	}
}

// Get returns the raw document. Public: the dashboard is on the landing page and
// the test loads its questions before anyone signs in.
func (h *CachedJSONHandler) Get(c *gin.Context) {
	h.once.Do(h.load)

	if h.err != nil {
		// A missing file is a deployment gap, not a crash — say so plainly so
		// the frontend can fall back instead of rendering something broken.
		response.Error(c, http.StatusServiceUnavailable,
			h.what+" unavailable: "+h.err.Error())
		return
	}

	if match := c.GetHeader("If-None-Match"); match != "" && match == h.etag {
		c.Status(http.StatusNotModified)
		return
	}
	c.Header("ETag", h.etag)
	c.Header("Cache-Control", "public, max-age=300")
	c.Data(http.StatusOK, "application/json; charset=utf-8", h.body)
}
