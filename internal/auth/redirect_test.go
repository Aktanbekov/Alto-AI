package auth

import "testing"

func TestSafeRedirectPathKeepsOnlySameSitePaths(t *testing.T) {
	cases := map[string]string{
		"/checkout?plan=full":  "/checkout?plan=full",
		"/check-profile":       "/check-profile",
		"/":                    "/",
		"":                     "/",
		"//evil.example":       "/",
		"/\\evil.example":      "/",
		"/ok\\path":            "/",
		"https://evil.example": "/",
		"javascript:alert(1)":  "/",
		"evil.example":         "/",
		"/a\tb":                "/",
		"/a\x00b":              "/",
	}
	for in, want := range cases {
		if got := SafeRedirectPath(in); got != want {
			t.Errorf("SafeRedirectPath(%q) = %q, want %q", in, got, want)
		}
	}
}
