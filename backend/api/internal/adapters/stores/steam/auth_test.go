package steam

import "testing"

func TestOpenIDRealmFromReturnURL(t *testing.T) {
	got := openIDRealmFromReturnURL("https://gamedivers.de/api/v1/steam/callback?state=abc")
	want := "https://gamedivers.de"
	if got != want {
		t.Fatalf("expected realm %q, got %q", want, got)
	}
}

