package main

import "testing"

func TestListenAddressUsesPlatformPort(t *testing.T) {
	t.Setenv("PORT", "42659")
	if got := listenAddress(); got != ":42659" {
		t.Fatalf("listenAddress() = %q, want %q", got, ":42659")
	}
}

func TestListenAddressDefaultsToDockerPort(t *testing.T) {
	t.Setenv("PORT", "")
	if got := listenAddress(); got != ":8080" {
		t.Fatalf("listenAddress() = %q, want %q", got, ":8080")
	}
}
