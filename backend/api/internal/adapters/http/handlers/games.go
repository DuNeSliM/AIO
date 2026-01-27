package handlers

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"

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

// StartEpicGame starts a synced Epic Games game by its app name
// POST /v1/games/epic/:appname/start
// appname should be the app name as it appears in Epic Games Launcher (e.g., "Fortnite", "Bloons-TD-6")
func (h *GameHandler) StartEpicGame(w http.ResponseWriter, r *http.Request) {
	appName := chi.URLParam(r, "appname")
	log.Printf("[Epic Games] Received request to start game: %s", appName)

	if appName == "" {
		log.Printf("[Epic Games] ERROR: Missing appname parameter")
		http.Error(w, "missing appname", http.StatusBadRequest)
		return
	}

	// Start the Epic game
	if err := startEpicApp(appName); err != nil {
		log.Printf("[Epic Games] ERROR starting game %s: %v", appName, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]any{
			"success": false,
			"message": err.Error(),
			"app_name": appName,
		})
		return
	}

	log.Printf("[Epic Games] Successfully started game: %s", appName)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": "Game started successfully",
		"app_name": appName,
	})
}

// startEpicApp launches an Epic Games game
// Reads the Epic Games manifest files to find the correct app ID and launches the game
func startEpicApp(appName string) error {
	log.Printf("[Epic Games] Starting app: %s", appName)

	// Try to find the app in Epic Games manifests
	appID, err := findEpicGameAppID(appName)
	if err != nil {
		log.Printf("[Epic Games] ERROR finding app ID: %v", err)
		return err
	}

	if appID == "" {
		log.Printf("[Epic Games] App not found in manifests: %s", appName)
		return NewStartGameError("Epic Games app not found: " + appName)
	}

	log.Printf("[Epic Games] Found app ID for %s: %s", appName, appID)

	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		// Use the found app ID to launch the game
		// Try different URI formats for Epic Games
		launchURI := "com.epicgames.launcher://apps/" + appID + "?action=launch"
		log.Printf("[Epic Games] Using launch URI: %s", launchURI)
		cmd = exec.Command("cmd", "/c", "start", launchURI)

	case "darwin":
		// On macOS
		log.Printf("[Epic Games] Launching on macOS")
		cmd = exec.Command("open", "-a", "Epic Games Launcher")

	case "linux":
		// On Linux
		log.Printf("[Epic Games] Launching on Linux")
		cmd = exec.Command("bash", "-c", "epic-games-launcher")

	default:
		log.Printf("[Epic Games] Unsupported OS: %s", runtime.GOOS)
		return ErrUnsupportedOS
	}

	log.Printf("[Epic Games] Executing command: %v", cmd)
	err = cmd.Start()
	if err != nil {
		log.Printf("[Epic Games] ERROR executing command: %v", err)
	}
	return err
}

// EpicManifest represents the structure of Epic Games manifest JSON files
type EpicManifest struct {
	AppName     string `json:"AppName"`
	DisplayName string `json:"DisplayName"`
	InstallPath string `json:"InstallLocation"`
}

// findEpicGameAppID searches Epic Games manifest files to find the app ID for a given app name
func findEpicGameAppID(appName string) (string, error) {
	// Epic Games manifest directory
	manifestDir := filepath.Join(os.Getenv("PROGRAMDATA"), "Epic", "EpicGamesLauncher", "Data", "Manifests")
	log.Printf("[Epic Games] Searching manifests in: %s", manifestDir)

	entries, err := ioutil.ReadDir(manifestDir)
	if err != nil {
		log.Printf("[Epic Games] ERROR reading manifest directory: %v", err)
		// Manifest directory not found, return empty
		return "", nil
	}

	log.Printf("[Epic Games] Found %d manifest files", len(entries))

	appNameLower := strings.ToLower(appName)
	log.Printf("[Epic Games] Looking for app: %s (lowercase: %s)", appName, appNameLower)

	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".item") {
			filePath := filepath.Join(manifestDir, entry.Name())
			log.Printf("[Epic Games] Checking manifest: %s", entry.Name())

			data, err := ioutil.ReadFile(filePath)
			if err != nil {
				log.Printf("[Epic Games] ERROR reading file %s: %v", entry.Name(), err)
				continue
			}

			var manifest EpicManifest
			if err := json.Unmarshal(data, &manifest); err != nil {
				log.Printf("[Epic Games] ERROR parsing JSON in %s: %v", entry.Name(), err)
				continue
			}

			log.Printf("[Epic Games] Manifest - AppName: %s, DisplayName: %s", manifest.AppName, manifest.DisplayName)

			// Match by AppName or DisplayName (case-insensitive)
			if strings.ToLower(manifest.AppName) == appNameLower ||
				strings.ToLower(manifest.DisplayName) == appNameLower ||
				strings.Contains(strings.ToLower(manifest.DisplayName), appNameLower) {
				log.Printf("[Epic Games] MATCH FOUND! AppName: %s, DisplayName: %s", manifest.AppName, manifest.DisplayName)
				// Return the AppName which is the app ID
				return manifest.AppName, nil
			}
		}
	}

	log.Printf("[Epic Games] No match found for app: %s", appName)
	return "", nil
}

// GetEpicLibrary retrieves the user's Epic Games library
// GET /v1/games/epic/library
func (h *GameHandler) GetEpicLibrary(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotImplemented)
	json.NewEncoder(w).Encode(map[string]any{
		"error": "Epic Games library endpoint not yet implemented. Requires Epic Games Launcher integration.",
	})
}

// StartGOGGame starts a synced GOG Galaxy game by its game name
// POST /v1/games/gog/:gamename/start
// gamename should be the game name as it appears in GOG Galaxy (e.g., "Captain Blood Demo")
func (h *GameHandler) StartGOGGame(w http.ResponseWriter, r *http.Request) {
	gameName := chi.URLParam(r, "gamename")
	log.Printf("[GOG Galaxy] Received request to start game: %s", gameName)

	if gameName == "" {
		log.Printf("[GOG Galaxy] ERROR: Missing gamename parameter")
		http.Error(w, "missing gamename", http.StatusBadRequest)
		return
	}

	// Start the GOG game
	if err := startGOGApp(gameName); err != nil {
		log.Printf("[GOG Galaxy] ERROR starting game %s: %v", gameName, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]any{
			"success": false,
			"message": err.Error(),
			"game_name": gameName,
		})
		return
	}

	log.Printf("[GOG Galaxy] Successfully started game: %s", gameName)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": "Game started successfully",
		"game_name": gameName,
	})
}

// startGOGApp launches a GOG Galaxy game
// Reads the GOG Galaxy configuration files to find the correct game ID and launches the game
func startGOGApp(gameName string) error {
	log.Printf("[GOG Galaxy] Starting app: %s", gameName)

	// Try to find the game in GOG Galaxy configuration
	gameInstallPath, err := findGOGGamePath(gameName)
	if err != nil {
		log.Printf("[GOG Galaxy] ERROR finding game path: %v", err)
		return err
	}

	if gameInstallPath == "" {
		log.Printf("[GOG Galaxy] Game not found: %s", gameName)
		return NewStartGameError("GOG Galaxy game not found: " + gameName)
	}

	log.Printf("[GOG Galaxy] Found game at: %s", gameInstallPath)

	// Find the executable in the game directory
	exePath := findGameExecutable(gameInstallPath)
	if exePath == "" {
		log.Printf("[GOG Galaxy] No executable found in: %s", gameInstallPath)
		return NewStartGameError("Game executable not found in: " + gameInstallPath)
	}

	log.Printf("[GOG Galaxy] Found executable: %s", exePath)

	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		// Execute the game directly
		log.Printf("[GOG Galaxy] Executing: %s", exePath)
		cmd = exec.Command(exePath)

	case "darwin":
		// On macOS
		log.Printf("[GOG Galaxy] Launching on macOS")
		cmd = exec.Command("open", exePath)

	case "linux":
		// On Linux
		log.Printf("[GOG Galaxy] Launching on Linux")
		cmd = exec.Command(exePath)

	default:
		log.Printf("[GOG Galaxy] Unsupported OS: %s", runtime.GOOS)
		return ErrUnsupportedOS
	}

	// Set working directory to the game folder for relative path dependencies
	cmd.Dir = gameInstallPath

	log.Printf("[GOG Galaxy] Executing command: %v with WorkDir: %s", cmd, gameInstallPath)
	err = cmd.Start()
	if err != nil {
		log.Printf("[GOG Galaxy] ERROR executing command: %v", err)
	}
	return err
}

// findGameExecutable looks for the main executable in a game directory
func findGameExecutable(gamePath string) string {
	log.Printf("[GOG Galaxy] Searching for executable in: %s", gamePath)

	entries, err := ioutil.ReadDir(gamePath)
	if err != nil {
		log.Printf("[GOG Galaxy] ERROR reading game directory: %v", err)
		return ""
	}

	// Look for common executable names and extensions
	exePatterns := []string{".exe", ".bat", ".cmd"}
	priorityNames := []string{"start", "launch", "run", "game"}

	// First pass: look for files with priority names
	for _, entry := range entries {
		if !entry.IsDir() {
			nameLower := strings.ToLower(entry.Name())
			for _, priority := range priorityNames {
				for _, ext := range exePatterns {
					if nameLower == priority+ext {
						fullPath := filepath.Join(gamePath, entry.Name())
						log.Printf("[GOG Galaxy] Found priority executable: %s", fullPath)
						return fullPath
					}
				}
			}
		}
	}

	// Second pass: look for any .exe file
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(strings.ToLower(entry.Name()), ".exe") {
			// Skip some common non-game executables
			nameLower := strings.ToLower(entry.Name())
			if !strings.Contains(nameLower, "uninstall") &&
				!strings.Contains(nameLower, "setup") &&
				!strings.Contains(nameLower, "config") {
				fullPath := filepath.Join(gamePath, entry.Name())
				log.Printf("[GOG Galaxy] Found executable: %s", fullPath)
				return fullPath
			}
		}
	}

	log.Printf("[GOG Galaxy] No executable found in game directory")
	return ""
}

// GOGGame represents a GOG Galaxy game configuration
type GOGGame struct {
	ProductID   string `json:"productId"`
	GameID      string `json:"gameId"`
	GameTitle   string `json:"gameTitle"`
	LocalTitle  string `json:"localTitle"`
	ExecutablePath string `json:"executablePath"`
}

// findGOGGamePath searches for a GOG Galaxy game installation directory
func findGOGGamePath(gameName string) (string, error) {
	gameNameLower := strings.ToLower(gameName)
	log.Printf("[GOG Galaxy] Looking for game path: %s (lowercase: %s)", gameName, gameNameLower)

	// GOG Galaxy typically installs games in these locations
	gogInstallPaths := []string{
		filepath.Join("C:\\", "Program Files", "GOG Galaxy", "Games"),
		filepath.Join("C:\\", "Program Files (x86)", "GOG Galaxy", "Games"),
		filepath.Join("C:\\", "Games"),
		filepath.Join("C:\\", "GOG Games"),
	}

	// Also check user's custom installation path from registry or config
	username := os.Getenv("USERNAME")
	userPath := filepath.Join("C:\\Users", username, "Games")
	gogInstallPaths = append(gogInstallPaths, userPath)

	log.Printf("[GOG Galaxy] Searching for installed games in %d locations", len(gogInstallPaths))

	for _, basePath := range gogInstallPaths {
		log.Printf("[GOG Galaxy] Checking path: %s", basePath)
		
		entries, err := ioutil.ReadDir(basePath)
		if err != nil {
			log.Printf("[GOG Galaxy] Path not found or error reading: %s - %v", basePath, err)
			continue
		}

		log.Printf("[GOG Galaxy] Found %d items in %s", len(entries), basePath)

		for _, entry := range entries {
			if entry.IsDir() {
				dirName := entry.Name()
				dirNameLower := strings.ToLower(dirName)
				log.Printf("[GOG Galaxy] Checking installed game directory: %s", dirName)

				// Match by directory name (case-insensitive)
				if dirNameLower == gameNameLower ||
					strings.Contains(dirNameLower, gameNameLower) ||
					strings.Contains(gameNameLower, dirNameLower) {
					fullPath := filepath.Join(basePath, dirName)
					log.Printf("[GOG Galaxy] MATCH FOUND! Path: %s", fullPath)
					return fullPath, nil
				}
			}
		}
	}

	log.Printf("[GOG Galaxy] No match found for game: %s", gameName)
	return "", nil
}

// GetGOGLibrary retrieves the user's GOG Galaxy library
// GET /v1/games/gog/library
func (h *GameHandler) GetGOGLibrary(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotImplemented)
	json.NewEncoder(w).Encode(map[string]any{
		"error": "GOG Galaxy library endpoint not yet implemented. Requires GOG Galaxy integration.",
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
