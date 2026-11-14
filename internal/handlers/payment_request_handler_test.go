package handlers

import "testing"

func TestNormalizeTelegram(t *testing.T) {
	cases := map[string]string{
		"@alto_user":              "alto_user",
		"alto_user":               "alto_user",
		" https://t.me/AltoUser/": "AltoUser",
		"t.me/alto_user":          "alto_user",
		"abc":                     "", // too short
		"1startsdigit":            "",
		"has space":               "",
		"":                        "",
	}
	for in, want := range cases {
		if got := normalizeTelegram(in); got != want {
			t.Errorf("normalizeTelegram(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestNormalizePhone(t *testing.T) {
	ok := []string{"+996 555 123 456", "+1 (415) 555-0100", "0555123456"}
	for _, p := range ok {
		if _, valid := normalizePhone(p); !valid {
			t.Errorf("normalizePhone(%q) rejected a valid number", p)
		}
	}
	bad := []string{"", "12345", "+996abc123456", "1234567890123456"}
	for _, p := range bad {
		if _, valid := normalizePhone(p); valid {
			t.Errorf("normalizePhone(%q) accepted an invalid number", p)
		}
	}
}
