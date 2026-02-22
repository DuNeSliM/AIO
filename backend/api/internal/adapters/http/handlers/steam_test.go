package handlers

import (
	"net/http/httptest"
	"testing"
)

func TestResolveSteamCallbackURLUsesConfiguredValue(t *testing.T) {
	h := NewSteamHandler("", "https://gamedivers.de/api/v1/steam/callback", "https://gamedivers.de", nil)
	req := httptest.NewRequest("GET", "https://gamedivers.de/api/v1/steam/login", nil)

	got := h.resolveSteamCallbackURL(req)
	want := "https://gamedivers.de/api/v1/steam/callback"
	if got != want {
		t.Fatalf("expected callback %q, got %q", want, got)
	}
}

func TestResolveSteamCallbackURLDerivesFromRequestPath(t *testing.T) {
	h := NewSteamHandler("", "", "https://gamedivers.de", nil)
	req := httptest.NewRequest("GET", "https://gamedivers.de/api/v1/steam/login", nil)

	got := h.resolveSteamCallbackURL(req)
	want := "https://gamedivers.de/api/v1/steam/callback"
	if got != want {
		t.Fatalf("expected callback %q, got %q", want, got)
	}
}

