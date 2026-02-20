package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

// TestStartSteamGame tests the StartSteamGame handler with a valid app ID
func TestStartSteamGame(t *testing.T) {
	handler := &GameHandler{Repo: nil}

	// Test with Hades 2 app ID (1145350)
	req := httptest.NewRequest("POST", "/games/steam/1145350/start", nil)
	w := httptest.NewRecorder()

	// Create a chi router to properly handle URL parameters
	router := chi.NewRouter()
	router.Post("/games/steam/{appid}/start", handler.StartSteamGame)
	router.ServeHTTP(w, req)

	// Check response status
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	// Parse response JSON
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Errorf("Failed to parse response: %v", err)
	}

	// Check response fields
	if success, ok := response["success"].(bool); !ok || !success {
		t.Errorf("Expected success to be true")
	}

	if appID, ok := response["app_id"].(string); !ok || appID != "1145350" {
		t.Errorf("Expected app_id to be '1145350', got '%v'", response["app_id"])
	}
}

// TestStartSteamGameMissingAppID tests the StartSteamGame handler with missing app ID
func TestStartSteamGameMissingAppID(t *testing.T) {
	handler := &GameHandler{Repo: nil}

	req := httptest.NewRequest("POST", "/games/steam//start", nil)
	w := httptest.NewRecorder()

	router := chi.NewRouter()
	router.Post("/games/steam/{appid}/start", handler.StartSteamGame)
	router.ServeHTTP(w, req)

	// Should return 400 Bad Request
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

// TestStartEpicGame tests the StartEpicGame handler with a valid game name
func TestStartEpicGame(t *testing.T) {
	handler := &GameHandler{Repo: nil}

	// Test with Bloons TD 6
	req := httptest.NewRequest("POST", "/games/epic/Bloons%20TD%206/start", nil)
	w := httptest.NewRecorder()

	router := chi.NewRouter()
	router.Post("/games/epic/{appname}/start", handler.StartEpicGame)
	router.ServeHTTP(w, req)

	// Epic Games may fail if manifest not found, but request should be processed
	// Just check that we get a response
	if w.Code == 0 {
		t.Errorf("No response received from handler")
	}

	// Parse response JSON
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Errorf("Failed to parse response: %v", err)
	}

	// Check that response has expected fields
	if _, ok := response["success"]; !ok {
		t.Errorf("Expected 'success' field in response")
	}

	if _, ok := response["app_name"]; !ok {
		t.Errorf("Expected 'app_name' field in response")
	}
}

// TestStartGOGGame tests the StartGOGGame handler with a valid game name
func TestStartGOGGame(t *testing.T) {
	handler := &GameHandler{Repo: nil}

	// Test with Captain Blood Demo
	req := httptest.NewRequest("POST", "/games/gog/Captain%20Blood%20Demo/start", nil)
	w := httptest.NewRecorder()

	router := chi.NewRouter()
	router.Post("/games/gog/{gamename}/start", handler.StartGOGGame)
	router.ServeHTTP(w, req)

	// GOG Galaxy may fail if game not installed, but request should be processed
	// Just check that we get a response
	if w.Code == 0 {
		t.Errorf("No response received from handler")
	}

	// Parse response JSON
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Errorf("Failed to parse response: %v", err)
	}

	// Check that response has expected fields
	if _, ok := response["success"]; !ok {
		t.Errorf("Expected 'success' field in response")
	}

	if _, ok := response["game_name"]; !ok {
		t.Errorf("Expected 'game_name' field in response")
	}
}

// TestStartGOGGameMissingGameName tests the StartGOGGame handler with missing game name
func TestStartGOGGameMissingGameName(t *testing.T) {
	handler := &GameHandler{Repo: nil}

	req := httptest.NewRequest("POST", "/games/gog//start", nil)
	w := httptest.NewRecorder()

	router := chi.NewRouter()
	router.Post("/games/gog/{gamename}/start", handler.StartGOGGame)
	router.ServeHTTP(w, req)

	// Should return 400 Bad Request
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

// TestStartSteamGameInvalidAppID tests the StartSteamGame handler with invalid (non-numeric) app ID
func TestStartSteamGameInvalidAppID(t *testing.T) {
	handler := &GameHandler{Repo: nil}

	req := httptest.NewRequest("POST", "/games/steam/not-a-number/start", nil)
	w := httptest.NewRecorder()

	router := chi.NewRouter()
	router.Post("/games/steam/{appid}/start", handler.StartSteamGame)
	router.ServeHTTP(w, req)

	// Should return 400 Bad Request
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}
