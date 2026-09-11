package tests

import (
	"encoding/binary"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"altoai_mvp/internal/router"
)

// The SPA fallback used to answer every non-API path with index.html, which
// meant /robots.txt returned HTML and every mistyped asset URL returned 200.
// These tests pin both halves of the fix.
//
// router.New() resolves ./frontend/dist relative to the working directory, so
// the suite has to run from the repo root for the file routes to exist.
func newRouterAtRepoRoot(t *testing.T) http.Handler {
	t.Helper()

	// openTestDB skips when there is no database; router.New needs one too, so
	// reuse it to get the same skip behaviour rather than failing here.
	db := openTestDB(t)
	_ = db.Close()

	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	if err := os.Chdir(".."); err != nil {
		t.Fatalf("chdir: %v", err)
	}
	t.Cleanup(func() { _ = os.Chdir(wd) })

	if _, err := os.Stat("./frontend/dist/index.html"); err != nil {
		t.Skipf("frontend not built: %v", err)
	}

	r, err := router.New()
	if err != nil {
		t.Skipf("router unavailable: %v", err)
	}
	return r
}

func get(t *testing.T, h http.Handler, path string) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
	return w
}

// A robots.txt served as text/html is not a robots file. It also leaves nowhere
// to declare the sitemap or to state a policy for the answer engines.
func TestRobotsTxtIsServedAsText(t *testing.T) {
	h := newRouterAtRepoRoot(t)

	w := get(t, h, "/robots.txt")
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); !strings.Contains(ct, "text/plain") {
		t.Errorf("Content-Type = %q, want text/plain", ct)
	}
	body := w.Body.String()
	if strings.Contains(body, "<!doctype html") || strings.Contains(body, "<div id=\"root\"") {
		t.Fatal("robots.txt is returning the SPA shell")
	}
	for _, want := range []string{"Sitemap:", "ClaudeBot", "GPTBot", "PerplexityBot", "User-agent: *"} {
		if !strings.Contains(body, want) {
			t.Errorf("robots.txt is missing %q", want)
		}
	}
	// A public file must not advertise the admin path.
	if strings.Contains(body, "/lev") {
		t.Error("robots.txt names the admin path, which tells crawlers where it is")
	}
}

func TestSitemapIsServedAsXML(t *testing.T) {
	h := newRouterAtRepoRoot(t)

	w := get(t, h, "/sitemap.xml")
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); !strings.Contains(ct, "xml") {
		t.Errorf("Content-Type = %q, want xml", ct)
	}
	body := w.Body.String()
	if !strings.Contains(body, "<urlset") {
		t.Fatalf("not a sitemap: %.80s", body)
	}
	// Signed-in screens in a sitemap are dead ends for anyone who follows them.
	for _, private := range []string{"/login", "/signup", "/chat", "/lev"} {
		if strings.Contains(body, private) {
			t.Errorf("sitemap lists the private path %q", private)
		}
	}
}

// The SPA owns its routing, so an unknown *page* must still reach the browser.
func TestUnknownPageStillServesTheApp(t *testing.T) {
	h := newRouterAtRepoRoot(t)

	for _, path := range []string{"/", "/check-profile", "/terms", "/lev", "/some/deep/page"} {
		w := get(t, h, path)
		if w.Code != http.StatusOK {
			t.Errorf("GET %s = %d, want 200", path, w.Code)
		}
		if !strings.Contains(w.Body.String(), `<div id="root">`) {
			t.Errorf("GET %s did not return the app shell", path)
		}
	}
}

// A path that looks like a file is a genuine miss. Answering it with 200 + HTML
// makes every stale asset hash and every scanner probe look like a real page.
func TestMissingAssetsReturn404(t *testing.T) {
	h := newRouterAtRepoRoot(t)

	for _, path := range []string{
		"/assets/index-deadbeef.js", "/missing.css", "/nope.png",
		"/old.json", "/whatever.map", "/UPPER.PNG",
	} {
		w := get(t, h, path)
		if w.Code != http.StatusNotFound {
			t.Errorf("GET %s = %d, want 404", path, w.Code)
		}
	}
}

// The old guard sliced "/.well-known" to 11 bytes and compared it against the
// full 12-byte literal, so it could never match.
func TestApiAndWellKnownReturn404(t *testing.T) {
	h := newRouterAtRepoRoot(t)

	for _, path := range []string{"/api/v1/nope", "/.well-known/anything"} {
		w := get(t, h, path)
		if w.Code != http.StatusNotFound {
			t.Errorf("GET %s = %d, want 404", path, w.Code)
		}
		if strings.Contains(w.Body.String(), `<div id="root">`) {
			t.Errorf("GET %s returned the app shell instead of a 404", path)
		}
	}
}

// The empty shell was the real reason answer engines could not read the site.
func TestShellCarriesContentWithoutJavaScript(t *testing.T) {
	h := newRouterAtRepoRoot(t)

	body := get(t, h, "/").Body.String()

	if !strings.Contains(body, "<noscript>") {
		t.Fatal("no <noscript> block: a fetch-only crawler still sees an empty page")
	}
	if !strings.Contains(body, `name="description"`) {
		t.Error("no meta description")
	}
	for _, want := range []string{
		"F-1", "16,204", "self-selected", "not legal or immigration advice",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("shell does not mention %q", want)
		}
	}
	// The caveats have to travel with the numbers, or an assistant quotes an
	// approval rate as though it were the real one.
	if !strings.Contains(body, "correlational") {
		t.Error("shell states figures without the correlational caveat")
	}
}

// Per-route static HTML. A SPA serves one shell for every URL, so without the
// build step every page carries the homepage's title, description and og:url.
// Link scrapers and answer engines never run the JavaScript that would fix it.
func TestPerRouteMetadataIsInTheHTML(t *testing.T) {
	h := newRouterAtRepoRoot(t)

	cases := []struct{ path, title, canonical string }{
		{"/", "F1 Visa Mock Interview Practice with AI | Altovisas", "https://www.altovisas.com/"},
		{"/faq", "F1 Visa Interview FAQ - Questions Answered | Altovisas", "https://www.altovisas.com/faq"},
		{"/terms", "Terms of Service | Altovisas", "https://www.altovisas.com/terms"},
		{"/privacy", "Privacy Policy | Altovisas", "https://www.altovisas.com/privacy"},
	}
	for _, tc := range cases {
		body := get(t, h, tc.path).Body.String()

		if !strings.Contains(body, "<title>"+tc.title+"</title>") {
			t.Errorf("GET %s has the wrong <title>", tc.path)
		}
		// og:url used to be hardcoded to the homepage on every page.
		for _, want := range []string{
			`<link rel="canonical" href="` + tc.canonical + `" />`,
			`<meta property="og:url" content="` + tc.canonical + `" />`,
		} {
			if !strings.Contains(body, want) {
				t.Errorf("GET %s is missing %s", tc.path, want)
			}
		}
		// SVG does not render in any major link preview.
		if strings.Contains(body, `og:image" content="https://www.altovisas.com/logo.svg`) {
			t.Errorf("GET %s still points og:image at an SVG", tc.path)
		}
		if !strings.Contains(body, `<meta property="og:site_name" content="Altovisas" />`) {
			t.Errorf("GET %s is missing og:site_name", tc.path)
		}
	}
}

// Google requires FAQPage structured data to match the visible content, so both
// come from src/data/faq.js.
func TestFAQStructuredDataMatchesThePage(t *testing.T) {
	h := newRouterAtRepoRoot(t)
	body := get(t, h, "/faq").Body.String()

	if !strings.Contains(body, `"@type": "FAQPage"`) {
		t.Fatal("/faq carries no FAQPage JSON-LD")
	}
	// A question present in the schema but absent from the body is exactly the
	// drift the shared module exists to prevent.
	for _, q := range []string{
		"What is Altovisas?",
		"Can Altovisas predict whether my visa will be approved?",
		"Is this legal or immigration advice?",
	} {
		if !strings.Contains(body, q) {
			t.Errorf("/faq JSON-LD and body disagree: %q missing", q)
		}
	}
	if strings.Contains(body, "AI Interviewer") {
		t.Error("/faq still uses the old product name")
	}
}

func TestHomepageCarriesOrganizationSchema(t *testing.T) {
	h := newRouterAtRepoRoot(t)
	body := get(t, h, "/").Body.String()

	for _, want := range []string{`"@type": "Organization"`, `"name": "Altovisas"`, `logo`} {
		if !strings.Contains(body, want) {
			t.Errorf("homepage Organization schema is missing %q", want)
		}
	}
}

// Link previews are the main distribution channel, and no major platform
// renders SVG in a preview card. The asset has to exist, be a PNG, and be
// served as one rather than being swallowed by the SPA fallback.
func TestOpenGraphImageIsARealPNG(t *testing.T) {
	h := newRouterAtRepoRoot(t)

	w := get(t, h, "/og-image.png")
	if w.Code != http.StatusOK {
		t.Fatalf("GET /og-image.png = %d, want 200", w.Code)
	}
	body := w.Body.Bytes()
	if len(body) < 8 || string(body[:8]) != "\x89PNG\r\n\x1a\n" {
		t.Fatal("/og-image.png is not a PNG (the SPA fallback may be catching it)")
	}
	// Dimensions live in the IHDR chunk, bytes 16..24.
	width := binary.BigEndian.Uint32(body[16:20])
	height := binary.BigEndian.Uint32(body[20:24])
	if width != 1200 || height != 630 {
		t.Errorf("og-image is %dx%d, want 1200x630", width, height)
	}

	// And every page must point at it.
	for _, path := range []string{"/", "/faq", "/terms"} {
		page := get(t, h, path).Body.String()
		if !strings.Contains(page, `content="https://www.altovisas.com/og-image.png"`) {
			t.Errorf("GET %s does not reference the og image", path)
		}
	}
}
