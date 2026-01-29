package epic

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGetLoginURL(t *testing.T) {
	client := NewClient("test_client_id", "test_secret", "http://localhost/callback")
	
	url := client.GetLoginURL("test_state")
	
	if url == "" {
		t.Error("Expected non-empty URL")
	}
	
	if !contains(url, "client_id=test_client_id") {
		t.Error("URL should contain client_id")
	}
	
	if !contains(url, "state=test_state") {
		t.Error("URL should contain state")
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && findSubstring(s, substr))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func TestExchangeCode(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{
			"access_token": "test_token",
			"expires_in": 3600,
			"token_type": "bearer",
			"account_id": "test_account_123"
		}`)
	}))
	defer server.Close()

	client := NewClient("test_id", "test_secret", "http://localhost/callback")
	
	// Note: This would need the actual Epic API endpoint to be mocked
	// For now, this is a placeholder test
	ctx := context.Background()
	_, err := client.ExchangeCode(ctx, "test_code")
	
	// We expect an error since we're not hitting the real Epic API
	if err == nil {
		t.Log("ExchangeCode test - would need Epic API mock")
	}
}
