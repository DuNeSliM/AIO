// internal/http/game_actions_handlers.go
package http

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"runtime"

	"github.com/gorilla/mux"
)

type GameActionsHandlers struct {
	// TODO: Add gameRepo and userLibraryRepo
}

func NewGameActionsHandlers() *GameActionsHandlers {
	return &GameActionsHandlers{}
}

// LaunchGame starts a game from the library
// POST /api/library/games/{gameId}/launch
func (h *GameActionsHandlers) LaunchGame(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	_ = vars["gameId"] // TODO: Use gameID to query database

	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// TODO: Get game details from database
	// gameID := vars["gameId"]
	// game, err := h.userLibraryRepo.GetGameByID(userID, gameID)

	// For now, parse request body
	var req LaunchGameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Check if game is installed
	if !req.IsInstalled {
		// Game not installed - return download info
		downloadInfo := h.getDownloadInfo(req.Store, req.StoreGameID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(GameActionResponse{
			Success: false,
			Action:  "download_required",
			Message: "Game is not installed. Please download it first.",
			Data:    downloadInfo,
		})
		return
	}

	// Launch the game
	launchMethod := h.determineLaunchMethod(req.Store, req.InstallPath)

	err := h.executeGameLaunch(launchMethod, req)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to launch game: %v", err), http.StatusInternalServerError)
		return
	}

	// TODO: Update last_played timestamp in database
	// h.userLibraryRepo.UpdateLastPlayed(userID, gameID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(GameActionResponse{
		Success: true,
		Action:  "launched",
		Message: fmt.Sprintf("Game launched via %s", launchMethod),
	})
}

// StartDownload initiates game download through the store client
// POST /api/library/games/{gameId}/download
func (h *GameActionsHandlers) StartDownload(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	_ = vars["gameId"] // TODO: Use gameID to query database

	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req DownloadGameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Get download method for the store
	downloadInfo := h.getDownloadInfo(req.Store, req.StoreGameID)

	// Open store client or store page
	err := h.initiateDownload(downloadInfo)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to initiate download: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(GameActionResponse{
		Success: true,
		Action:  "download_initiated",
		Message: fmt.Sprintf("Opening %s to download game", req.Store),
		Data:    downloadInfo,
	})
}

// CheckInstallStatus checks if a game is installed
// GET /api/library/games/{gameId}/install-status
func (h *GameActionsHandlers) CheckInstallStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID := vars["gameId"]

	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// TODO: Query database for install status
	// status, err := h.userLibraryRepo.GetInstallStatus(userID, gameID)

	// Placeholder response
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(InstallStatusResponse{
		GameID:      gameID,
		IsInstalled: false,
		InstallPath: "",
		CanLaunch:   false,
		Store:       "steam",
	})
}

// Helper functions

func (h *GameActionsHandlers) determineLaunchMethod(store, installPath string) string {
	// Priority: Direct executable > Store URL > Store client

	if installPath != "" {
		return "executable"
	}

	switch store {
	case "steam":
		return "steam_url"
	case "epic":
		return "epic_url"
	case "gog":
		return "gog_galaxy"
	case "xbox":
		return "xbox_app"
	case "uplay":
		return "ubisoft_connect"
	case "ea":
		return "ea_app"
	default:
		return "store_page"
	}
}

func (h *GameActionsHandlers) executeGameLaunch(method string, req LaunchGameRequest) error {
	switch method {
	case "executable":
		return h.launchExecutable(req.InstallPath)

	case "steam_url":
		return h.openURL(fmt.Sprintf("steam://rungameid/%s", req.StoreGameID))

	case "epic_url":
		return h.openURL(fmt.Sprintf("com.epicgames.launcher://apps/%s?action=launch", req.StoreGameID))

	case "gog_galaxy":
		return h.openURL(fmt.Sprintf("goggalaxy://openGameView/%s", req.StoreGameID))

	case "xbox_app":
		return h.openURL(fmt.Sprintf("xbox://game/%s", req.StoreGameID))

	case "ubisoft_connect":
		return h.openURL(fmt.Sprintf("uplay://launch/%s", req.StoreGameID))

	case "ea_app":
		return h.openURL(fmt.Sprintf("origin://game/launch?offerIds=%s", req.StoreGameID))

	default:
		return h.openURL(req.StoreURL)
	}
}

func (h *GameActionsHandlers) launchExecutable(path string) error {
	cmd := exec.Command(path)
	return cmd.Start()
}

func (h *GameActionsHandlers) openURL(url string) error {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", url)
	case "darwin":
		cmd = exec.Command("open", url)
	case "linux":
		cmd = exec.Command("xdg-open", url)
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}

	return cmd.Start()
}

func (h *GameActionsHandlers) getDownloadInfo(store, storeGameID string) DownloadInfo {
	downloadInfo := DownloadInfo{
		Store:       store,
		StoreGameID: storeGameID,
	}

	switch store {
	case "steam":
		downloadInfo.Method = "steam_client"
		downloadInfo.URL = fmt.Sprintf("steam://install/%s", storeGameID)
		downloadInfo.Instructions = "Opens Steam client to download the game"
		downloadInfo.FallbackURL = fmt.Sprintf("https://store.steampowered.com/app/%s", storeGameID)

	case "epic":
		downloadInfo.Method = "epic_launcher"
		downloadInfo.URL = fmt.Sprintf("com.epicgames.launcher://apps/%s?action=install", storeGameID)
		downloadInfo.Instructions = "Opens Epic Games Launcher to download the game"
		downloadInfo.FallbackURL = fmt.Sprintf("https://store.epicgames.com/en-US/p/%s", storeGameID)

	case "gog":
		downloadInfo.Method = "gog_galaxy"
		downloadInfo.URL = fmt.Sprintf("goggalaxy://openGameView/%s", storeGameID)
		downloadInfo.Instructions = "Opens GOG Galaxy to download the game"
		downloadInfo.FallbackURL = fmt.Sprintf("https://www.gog.com/game/%s", storeGameID)

	case "xbox":
		downloadInfo.Method = "xbox_app"
		downloadInfo.URL = fmt.Sprintf("ms-windows-store://pdp/?productid=%s", storeGameID)
		downloadInfo.Instructions = "Opens Xbox app to download the game"
		downloadInfo.FallbackURL = fmt.Sprintf("https://www.xbox.com/games/store/%s", storeGameID)

	case "battlenet":
		downloadInfo.Method = "battlenet_client"
		downloadInfo.Instructions = "Open Battle.net client to download the game"
		downloadInfo.FallbackURL = "https://www.blizzard.com/apps/battle.net/desktop"

	case "uplay":
		downloadInfo.Method = "ubisoft_connect"
		downloadInfo.URL = fmt.Sprintf("uplay://launch/%s", storeGameID)
		downloadInfo.Instructions = "Opens Ubisoft Connect to download the game"
		downloadInfo.FallbackURL = "https://ubisoftconnect.com"

	case "ea":
		downloadInfo.Method = "ea_app"
		downloadInfo.URL = fmt.Sprintf("origin://game/download?offerId=%s", storeGameID)
		downloadInfo.Instructions = "Opens EA app to download the game"
		downloadInfo.FallbackURL = "https://www.ea.com/ea-app"

	case "psn":
		downloadInfo.Method = "playstation_console"
		downloadInfo.Instructions = "Download via PlayStation console or PlayStation app"
		downloadInfo.FallbackURL = fmt.Sprintf("https://store.playstation.com/product/%s", storeGameID)

	default:
		downloadInfo.Method = "web_browser"
		downloadInfo.Instructions = "Visit store page to download"
	}

	return downloadInfo
}

func (h *GameActionsHandlers) initiateDownload(info DownloadInfo) error {
	if info.URL != "" {
		return h.openURL(info.URL)
	}
	if info.FallbackURL != "" {
		return h.openURL(info.FallbackURL)
	}
	return fmt.Errorf("no download method available")
}

// Request/Response structures

type LaunchGameRequest struct {
	Store       string `json:"store"`
	StoreGameID string `json:"store_game_id"`
	StoreURL    string `json:"store_url"`
	IsInstalled bool   `json:"is_installed"`
	InstallPath string `json:"install_path"`
}

type DownloadGameRequest struct {
	Store       string `json:"store"`
	StoreGameID string `json:"store_game_id"`
}

type GameActionResponse struct {
	Success bool        `json:"success"`
	Action  string      `json:"action"` // launched, download_required, download_initiated
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type InstallStatusResponse struct {
	GameID      string `json:"game_id"`
	IsInstalled bool   `json:"is_installed"`
	InstallPath string `json:"install_path"`
	CanLaunch   bool   `json:"can_launch"`
	Store       string `json:"store"`
}

type DownloadInfo struct {
	Store        string `json:"store"`
	StoreGameID  string `json:"store_game_id"`
	Method       string `json:"method"`       // steam_client, epic_launcher, web_browser, etc.
	URL          string `json:"url"`          // Deep link URL to open store client
	FallbackURL  string `json:"fallback_url"` // Web URL if deep link fails
	Instructions string `json:"instructions"` // User-friendly message
}
