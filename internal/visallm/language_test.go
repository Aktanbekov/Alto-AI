package visallm

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestNormalizeLanguage(t *testing.T) {
	cases := map[string]string{
		"ru":      "ru",
		"RU":      "ru",
		" ru-RU":  "ru",
		"en":      "en",
		"en_US":   "en",
		"":        "",
		"de":      "",
		"russian": "",
	}
	for in, want := range cases {
		if got := NormalizeLanguage(in); got != want {
			t.Errorf("NormalizeLanguage(%q) = %q, want %q", in, got, want)
		}
	}
}

// An English request must reach the sidecar byte-for-byte as before the field
// existed, so older sidecars and the cache key are unaffected.
func TestLanguageOmittedWhenEmpty(t *testing.T) {
	body, err := json.Marshal(ProfileRequest{PlannedAnswers: []PlannedAnswer{{Question: "q", Answer: "a"}}})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(body), "language") {
		t.Fatalf("empty language was serialised: %s", body)
	}
	body, _ = json.Marshal(ProfileRequest{Language: "ru"})
	if !strings.Contains(string(body), `"language":"ru"`) {
		t.Fatalf("language missing from request: %s", body)
	}
}
