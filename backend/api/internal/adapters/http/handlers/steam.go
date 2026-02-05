package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"

	"gamedivers.de/api/internal/adapters/stores/steam"
	"gamedivers.de/api/internal/ports/repo"
)

type SteamHandler struct {
	steamClient *steam.Client
	repo        repo.Repo
}

func NewSteamHandler(steamAPIKey, callbackURL string, repo repo.Repo) *SteamHandler {
	return &SteamHandler{
		steamClient: steam.NewClient(steamAPIKey, callbackURL),
		repo:        repo,
	}
}

// LoginRedirect redirects to Steam OpenID login
// GET /v1/steam/login
func (h *SteamHandler) LoginRedirect(w http.ResponseWriter, r *http.Request) {
	// Build callback URL
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	returnURL := fmt.Sprintf("%s://%s/v1/steam/callback", scheme, r.Host)

	loginURL := h.steamClient.GetLoginURL(returnURL)
	http.Redirect(w, r, loginURL, http.StatusTemporaryRedirect)
}

// Callback handles Steam OpenID callback
// GET /v1/steam/callback
func (h *SteamHandler) Callback(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters
	if err := r.ParseForm(); err != nil {
		http.Error(w, "failed to parse form", http.StatusBadRequest)
		return
	}

	// Verify the callback
	steamID, err := h.steamClient.VerifyCallback(r.Form)
	if err != nil {
		log.Printf("Steam auth verification failed: %v", err)
		http.Error(w, "authentication failed", http.StatusUnauthorized)
		return
	}

	log.Printf("Steam authentication successful for SteamID: %s", steamID)

	// Get player profile
	players, err := h.steamClient.GetPlayerSummaries([]string{steamID})
	if err != nil || len(players) == 0 {
		log.Printf("Failed to get player summary: %v", err)
	}

	// Store session (simplified - in production use proper session management)
	// For now, redirect to frontend with steamID as query param
	frontendURL := fmt.Sprintf("http://localhost:3000?steamid=%s", steamID)
	if len(players) > 0 {
		frontendURL += fmt.Sprintf("&username=%s", players[0].PersonaName)
	}

	http.Redirect(w, r, frontendURL, http.StatusTemporaryRedirect)
}

// GetLibrary retrieves the authenticated user's Steam library
// GET /v1/steam/library?steamid={steamid}
func (h *SteamHandler) GetLibrary(w http.ResponseWriter, r *http.Request) {
	steamID := r.URL.Query().Get("steamid")
	if steamID == "" {
		http.Error(w, "missing steamid parameter", http.StatusBadRequest)
		return
	}

	games, err := h.steamClient.GetOwnedGames(steamID)
	if err != nil {
		log.Printf("Failed to fetch Steam library: %v", err)
		msg := err.Error()
		if strings.Contains(msg, "steam api error: 401") || strings.Contains(msg, "steam api error: 403") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			json.NewEncoder(w).Encode(map[string]any{
				"error": "steam_profile_private",
			})
			return
		}
		http.Error(w, "failed to fetch library", http.StatusBadGateway)
		return
	}

	// Convert to common format
	type GameResponse struct {
		ID         string `json:"id"`
		AppID      int    `json:"appId"`
		Name       string `json:"name"`
		Platform   string `json:"platform"`
		Image      string `json:"image"`
		Playtime   int    `json:"playtime"`
		LastPlayed int64  `json:"lastPlayed"`
	}

	var response []GameResponse
	for _, game := range games {
		imageURL := ""
		if game.ImgIconURL != "" {
			imageURL = fmt.Sprintf("https://media.steampowered.com/steamcommunity/public/images/apps/%d/%s.jpg", game.AppID, game.ImgIconURL)
		}

		response = append(response, GameResponse{
			ID:         fmt.Sprintf("%d", game.AppID),
			AppID:      game.AppID,
			Name:       game.Name,
			Platform:   "steam",
			Image:      imageURL,
			Playtime:   game.PlaytimeForever,
			LastPlayed: game.RtimeLastPlayed,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetWishlist retrieves the authenticated user's Steam wishlist.
// GET /v1/steam/wishlist?steamid={steamid}
func (h *SteamHandler) GetWishlist(w http.ResponseWriter, r *http.Request) {
	steamID := r.URL.Query().Get("steamid")
	if steamID == "" {
		http.Error(w, "missing steamid parameter", http.StatusBadRequest)
		return
	}

	items, err := h.steamClient.GetWishlist(steamID)
	if err != nil {
		log.Printf("Failed to fetch Steam wishlist: %v", err)
		msg := err.Error()
		if errors.Is(err, steam.ErrSteamWishlistPrivate) ||
			strings.Contains(msg, "wishlist api error: 401") ||
			strings.Contains(msg, "wishlist api error: 403") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			json.NewEncoder(w).Encode(map[string]any{
				"error": "steam_wishlist_blocked",
			})
			return
		}
		http.Error(w, "failed to fetch wishlist", http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// SyncLibrary fetches and stores the user's Steam library in the database
// POST /v1/steam/sync?steamid={steamid}
func (h *SteamHandler) SyncLibrary(w http.ResponseWriter, r *http.Request) {
	steamID := r.URL.Query().Get("steamid")
	if steamID == "" {
		http.Error(w, "missing steamid parameter", http.StatusBadRequest)
		return
	}

	games, err := h.steamClient.GetOwnedGames(steamID)
	if err != nil {
		log.Printf("Failed to fetch Steam library: %v", err)
		http.Error(w, "failed to fetch library", http.StatusInternalServerError)
		return
	}

	// TODO: Store in database
	// For now, just return success with count
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"count":   len(games),
		"message": fmt.Sprintf("Synced %d games from Steam", len(games)),
	})
}
