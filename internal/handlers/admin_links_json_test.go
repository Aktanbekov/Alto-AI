package handlers

import (
	"encoding/json"
	"testing"
	"time"

	"altoai_mvp/internal/repository"
)

// linkRow embeds two structs side by side. encoding/json silently drops a field
// that is ambiguous between embedded types at the same depth, so a future field
// named on both ReferralLink and SourceStat would vanish from the response with
// no error anywhere. This pins the keys the Links screen actually reads.
func TestLinkRowJSONContract(t *testing.T) {
	row := linkRow{
		ReferralLink: repository.ReferralLink{
			Code:        "reddit",
			Label:       "Reddit",
			Destination: "/check",
			Notes:       "aug post",
			Archived:    true,
			CreatedAt:   time.Now().UTC(),
		},
		URL:     "https://altovisas.com/check?src=reddit",
		Tracked: true,
		SourceStat: repository.SourceStat{
			Src: "reddit", Visitors: 2, Sessions: 2, PageViews: 3,
			FormStarts: 1, FormCompletes: 1, Reports: 1, Signups: 1,
			FirstSeen: time.Now().UTC(), LastSeen: time.Now().UTC(),
		},
	}

	blob, err := json.Marshal(row)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var got map[string]any
	if err := json.Unmarshal(blob, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	for _, key := range []string{
		"code", "label", "destination", "notes", "archived", "created_at",
		"url", "tracked",
		"src", "visitors", "sessions", "page_views",
		"form_starts", "form_completes", "reports", "signups",
		"first_seen", "last_seen",
	} {
		if _, ok := got[key]; !ok {
			t.Errorf("response is missing %q - the Links screen reads it", key)
		}
	}

	if got["code"] != "reddit" || got["url"] == "" {
		t.Errorf("unexpected values: %v", got)
	}
	if got["visitors"].(float64) != 2 {
		t.Errorf("visitors = %v, want 2", got["visitors"])
	}
}

// The tagged link is built by string concatenation, so the pieces have to fit
// together for both a root and a sub-path destination.
func TestBuildURL(t *testing.T) {
	t.Setenv("FRONTEND_URL", "https://altovisas.com/")

	cases := map[[2]string]string{
		{"reddit", "/"}:      "https://altovisas.com/?src=reddit",
		{"reddit", "/check"}: "https://altovisas.com/check?src=reddit",
		{"yt_oct-26", ""}:    "https://altovisas.com/?src=yt_oct-26",
	}
	for in, want := range cases {
		if got := buildURL(in[0], in[1]); got != want {
			t.Errorf("buildURL(%q, %q) = %q, want %q", in[0], in[1], got, want)
		}
	}
}

// A staging deploy must hand out staging links, not print the production domain.
func TestSiteBaseFollowsFrontendURL(t *testing.T) {
	t.Setenv("FRONTEND_URL", "https://staging.altovisas.com/")
	if got := siteBase(); got != "https://staging.altovisas.com" {
		t.Errorf("siteBase() = %q", got)
	}
	t.Setenv("FRONTEND_URL", "")
	if got := siteBase(); got != "https://altovisas.com" {
		t.Errorf("siteBase() fallback = %q", got)
	}
}
