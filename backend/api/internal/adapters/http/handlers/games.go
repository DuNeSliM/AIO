package handlers

import (
	"encoding/json"
	"net/http"
	"os/exec"
	"runtime"
	"strconv"

	"github.com/go-chi/chi/v5"

	"gamedivers.de/api/internal/ports/repo"
)

type GameHandler struct {
	Repo repo.Repo
}

// StartGameRequest represents a request to start a game
type StartGameRequest struct {
	AppID string `json:"app_id"`
}

// StartGameResponse represents the response after starting a game
type StartGameResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	AppID   string `json:"app_id"`
}

// StartSteamGame starts a synced Steam game by its app ID
// POST /v1/games/steam/:appid/start
func (h *GameHandler) StartSteamGame(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "appid")
	if appID == "" {
		http.Error(w, "missing appid", http.StatusBadRequest)
		return
	}

	// Validate that appID is numeric
	if _, err := strconv.ParseInt(appID, 10, 64); err != nil {
		http.Error(w, "invalid appid: must be numeric", http.StatusBadRequest)
		return
	}

	// Start the Steam game
	if err := startSteamApp(appID); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]any{
			"success": false,
			"message": err.Error(),
			"app_id":  appID,
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(StartGameResponse{
		Success: true,
		Message: "Game started successfully",
		AppID:   appID,
	})
}

// startSteamApp launches a Steam game using the steam:// protocol
func startSteamApp(appID string) error {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		// On Windows, use steam:// URI scheme
		cmd = exec.Command("cmd", "/c", "start", "steam://rungameid/"+appID)

	case "darwin":
		// On macOS, use open command with steam:// URI
		cmd = exec.Command("open", "steam://rungameid/"+appID)

	case "linux":
		// On Linux, try xdg-open first, then steam
		cmd = exec.Command("bash", "-c", "xdg-open steam://rungameid/"+appID+" || steam steam://rungameid/"+appID)

	default:
		return ErrUnsupportedOS
	}

	return cmd.Start()
}

// GetSteamLibrary retrieves the user's Steam game library
// GET /v1/games/steam/library
func (h *GameHandler) GetSteamLibrary(w http.ResponseWriter, r *http.Request) {
	// This would need to be implemented with proper Steam API authentication
	// For now, return a placeholder response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotImplemented)
	json.NewEncoder(w).Encode(map[string]any{
		"error": "Steam library endpoint not yet implemented. Requires Steam API authentication.",
	})
}

// GetInstalledGames retrieves games that are synced and installed
// GET /v1/games/installed
func (h *GameHandler) GetInstalledGames(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotImplemented)
	json.NewEncoder(w).Encode(map[string]any{
		"error": "Game library endpoint not yet implemented. Requires database query.",
	})
}

var ErrUnsupportedOS = NewStartGameError("unsupported operating system")

type StartGameError struct {
	message string
}

func NewStartGameError(msg string) StartGameError {
	return StartGameError{message: msg}
}

func (e StartGameError) Error() string {
	return e.message
}
