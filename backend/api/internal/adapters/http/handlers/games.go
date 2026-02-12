package handlers

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"gamedivers.de/api/internal/ports/repo"
)

type GameHandler struct {
	Repo repo.Repo
}

var safeName = regexp.MustCompile("^[\\w .-]{1,120}$")

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
// Example: curl -X POST http://localhost:8080/v1/games/steam/1145350/start (Hades 2)
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
	json.NewEncoder(w).Encode([]any{})
}

// StartEpicGame starts a synced Epic Games game by its app name
// POST /v1/games/epic/:appname/start
// Example: curl -X POST http://localhost:8080/v1/games/epic/Bloons%20TD%206/start
func (h *GameHandler) StartEpicGame(w http.ResponseWriter, r *http.Request) {
	appName := chi.URLParam(r, "appname")

	if appName == "" {
		http.Error(w, "missing appname", http.StatusBadRequest)
		return
	}

	if !safeName.MatchString(appName) {
		http.Error(w, "invalid app name", http.StatusBadRequest)
		return
	}

	// Start the Epic game
	if err := startEpicApp(appName); err != nil {
		log.Printf("[Epic Games] launch failed")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]any{
			"success":  false,
			"message":  err.Error(),
			"app_name": appName,
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{
		"success":  true,
		"message":  "Game started successfully",
		"app_name": appName,
	})
}

// startEpicApp launches an Epic Games game
// Reads the Epic Games manifest files to find the correct app ID and launches the game
func startEpicApp(appName string) error {
	// Try to find the app in Epic Games manifests
	appID, err := findEpicGameAppID(appName)
	if err != nil {
		log.Printf("[Epic Games] app id lookup failed")
		return err
	}

	if appID == "" {
		return NewStartGameError("Epic Games app not found")
	}

	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		// Use the found app ID to launch the game
		// Try different URI formats for Epic Games
		launchURI := "com.epicgames.launcher://apps/" + appID + "?action=launch"
		cmd = exec.Command("cmd", "/c", "start", launchURI)

	case "darwin":
		// On macOS
		cmd = exec.Command("open", "-a", "Epic Games Launcher")

	case "linux":
		// On Linux
		cmd = exec.Command("bash", "-c", "epic-games-launcher")

	default:
		return ErrUnsupportedOS
	}

	err = cmd.Start()
	if err != nil {
		log.Printf("[Epic Games] launch command failed")
	}
	return err
}

// EpicManifest represents the structure of Epic Games manifest JSON files
type EpicManifest struct {
	AppName     string `json:"AppName"`
	DisplayName string `json:"DisplayName"`
	InstallPath string `json:"InstallLocation"`
}

// EpicLibraryItem represents a game entry derived from local Epic manifest files
type EpicLibraryItem struct {
	ID          string `json:"id"`
	AppName     string `json:"appName"`
	Name        string `json:"name"`
	Platform    string `json:"platform"`
	InstallPath string `json:"installPath,omitempty"`
	Image       string `json:"image,omitempty"`
	LastPlayed  int64  `json:"lastPlayed,omitempty"`
	Playtime    int64  `json:"playtime,omitempty"`
}

// findEpicGameAppID searches Epic Games manifest files to find the app ID for a given app name
func findEpicGameAppID(appName string) (string, error) {
	// Epic Games manifest directory
	manifestDir := filepath.Join(os.Getenv("PROGRAMDATA"), "Epic", "EpicGamesLauncher", "Data", "Manifests")

	entries, err := ioutil.ReadDir(manifestDir)
	if err != nil {
		// Manifest directory not found, return empty
		return "", nil
	}

	appNameLower := strings.ToLower(appName)

	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".item") {
			filePath := filepath.Join(manifestDir, entry.Name())

			data, err := ioutil.ReadFile(filePath)
			if err != nil {
				continue
			}

			var manifest EpicManifest
			if err := json.Unmarshal(data, &manifest); err != nil {
				continue
			}

			// Match by AppName or DisplayName (case-insensitive)
			if strings.ToLower(manifest.AppName) == appNameLower ||
				strings.ToLower(manifest.DisplayName) == appNameLower ||
				strings.Contains(strings.ToLower(manifest.DisplayName), appNameLower) {
				// Return the AppName which is the app ID
				return manifest.AppName, nil
			}
		}
	}

	return "", nil
}

// readEpicManifests loads all Epic Games manifests from the local machine
func readEpicManifests() ([]EpicManifest, error) {
	programData := os.Getenv("PROGRAMDATA")
	if programData == "" {
		return []EpicManifest{}, nil
	}

	manifestDir := filepath.Join(programData, "Epic", "EpicGamesLauncher", "Data", "Manifests")
	entries, err := ioutil.ReadDir(manifestDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []EpicManifest{}, nil
		}
		return nil, err
	}

	manifests := make([]EpicManifest, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".item") {
			continue
		}

		filePath := filepath.Join(manifestDir, entry.Name())
		data, err := ioutil.ReadFile(filePath)
		if err != nil {
			continue
		}

		var manifest EpicManifest
		if err := json.Unmarshal(data, &manifest); err != nil {
			continue
		}

		if manifest.AppName == "" && manifest.DisplayName == "" {
			continue
		}

		manifests = append(manifests, manifest)
	}

	return manifests, nil
}

// GetEpicLibrary retrieves the user's Epic Games library
// GET /v1/games/epic/library
func (h *GameHandler) GetEpicLibrary(w http.ResponseWriter, r *http.Request) {
	manifests, err := readEpicManifests()
	if err != nil {
		log.Printf("[Epic Games] library read failed")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]any{
			"error": "Failed to read Epic Games manifests",
		})
		return
	}

	response := make([]EpicLibraryItem, 0, len(manifests))
	for _, manifest := range manifests {
		name := manifest.DisplayName
		if name == "" {
			name = manifest.AppName
		}

		response = append(response, EpicLibraryItem{
			ID:          manifest.AppName,
			AppName:     manifest.AppName,
			Name:        name,
			Platform:    "epic",
			InstallPath: manifest.InstallPath,
			LastPlayed:  0,
			Playtime:    0,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// StartGOGGame starts a synced GOG Galaxy game by its game name
// POST /v1/games/gog/:gamename/start
// Example: curl -X POST http://localhost:8080/v1/games/gog/Captain%20Blood%20Demo/start
func (h *GameHandler) StartGOGGame(w http.ResponseWriter, r *http.Request) {
	gameName := chi.URLParam(r, "gamename")

	if gameName == "" {
		http.Error(w, "missing gamename", http.StatusBadRequest)
		return
	}

	if !safeName.MatchString(gameName) {
		http.Error(w, "invalid game name", http.StatusBadRequest)
		return
	}

	// Start the GOG game
	if err := startGOGApp(gameName); err != nil {
		log.Printf("[GOG Galaxy] launch failed")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]any{
			"success":   false,
			"message":   err.Error(),
			"game_name": gameName,
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{
		"success":   true,
		"message":   "Game started successfully",
		"game_name": gameName,
	})
}

// startGOGApp launches a GOG Galaxy game
// Reads the GOG Galaxy configuration files to find the correct game ID and launches the game
func startGOGApp(gameName string) error {
	// Try to find the game in GOG Galaxy configuration
	gameInstallPath, err := findGOGGamePath(gameName)
	if err != nil {
		log.Printf("[GOG Galaxy] game path lookup failed")
		return err
	}

	if gameInstallPath == "" {
		return NewStartGameError("GOG Galaxy game not found")
	}

	// Find the executable in the game directory
	exePath := findGameExecutable(gameInstallPath)
	if exePath == "" {
		return NewStartGameError("game executable not found")
	}

	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		// Execute the game directly
		cmd = exec.Command(exePath)

	case "darwin":
		// On macOS
		cmd = exec.Command("open", exePath)

	case "linux":
		// On Linux
		cmd = exec.Command(exePath)

	default:
		return ErrUnsupportedOS
	}

	// Set working directory to the game folder for relative path dependencies
	cmd.Dir = gameInstallPath

	err = cmd.Start()
	if err != nil {
		log.Printf("[GOG Galaxy] launch command failed")
	}
	return err
}

// findGameExecutable looks for the main executable in a game directory
func findGameExecutable(gamePath string) string {
	entries, err := ioutil.ReadDir(gamePath)
	if err != nil {
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
				return fullPath
			}
		}
	}

	return ""
}

// GOGGame represents a GOG Galaxy game configuration
type GOGGame struct {
	ProductID      string `json:"productId"`
	GameID         string `json:"gameId"`
	GameTitle      string `json:"gameTitle"`
	LocalTitle     string `json:"localTitle"`
	ExecutablePath string `json:"executablePath"`
}

// findGOGGamePath searches for a GOG Galaxy game installation directory
func findGOGGamePath(gameName string) (string, error) {
	gameNameLower := strings.ToLower(gameName)

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

	for _, basePath := range gogInstallPaths {
		entries, err := ioutil.ReadDir(basePath)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			if entry.IsDir() {
				dirName := entry.Name()
				dirNameLower := strings.ToLower(dirName)

				// Match by directory name (case-insensitive)
				if dirNameLower == gameNameLower ||
					strings.Contains(dirNameLower, gameNameLower) ||
					strings.Contains(gameNameLower, dirNameLower) {
					fullPath := filepath.Join(basePath, dirName)
					return fullPath, nil
				}
			}
		}
	}

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
