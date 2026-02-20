package handlers

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	authmw "gamedivers.de/api/internal/adapters/http/middleware"
	"gamedivers.de/api/internal/adapters/stores/steam"
	"gamedivers.de/api/internal/ports/repo"
)

type SteamHandler struct {
	steamClient *steam.Client
	repo        repo.Repo
	frontendURL string
}

func NewSteamHandler(steamAPIKey, callbackURL, frontendOrigin string, repo repo.Repo) *SteamHandler {
	return &SteamHandler{
		steamClient: steam.NewClient(steamAPIKey, callbackURL),
		repo:        repo,
		frontendURL: sanitizeFrontendOrigin(frontendOrigin),
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

	state, err := newStateToken()
	if err != nil {
		http.Error(w, "state generation failed", http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "steam_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   r.TLS != nil,
	})

	loginURL := h.steamClient.GetLoginURL(withState(returnURL, state))
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

	if err := h.verifyState(r.Form.Get("state"), r); err != nil {
		http.Error(w, "invalid state", http.StatusBadRequest)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "steam_state",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   r.TLS != nil,
		MaxAge:   -1,
	})

	// Verify the callback
	steamID, err := h.steamClient.VerifyCallback(r.Form)
	if err != nil {
		logSafeError("steam auth verification failed", err)
		http.Error(w, "authentication failed", http.StatusUnauthorized)
		return
	}

	log.Printf("Steam authentication successful for SteamID: %s", steamID)

	// Get player profile
	players, err := h.steamClient.GetPlayerSummaries([]string{steamID})
	if err != nil || len(players) == 0 {
		logSafeError("steam player summary failed", err)
	}

	// Store session (simplified - in production use proper session management)
	// For now, redirect to frontend with steamID as query param
	frontendURL := h.safeSteamRedirect(steamID)
	if len(players) > 0 {
		frontendURL += fmt.Sprintf("&username=%s", url.QueryEscape(players[0].PersonaName))
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
		logSafeError("steam library fetch failed", err)
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
		ID            string `json:"id"`
		AppID         int    `json:"appId"`
		Name          string `json:"name"`
		Platform      string `json:"platform"`
		Image         string `json:"image"`
		ImageFallback string `json:"imageFallback,omitempty"`
		Playtime      int    `json:"playtime"`
		LastPlayed    int64  `json:"lastPlayed"`
	}

	var response []GameResponse
	for _, game := range games {
		imageURL := fmt.Sprintf("https://cdn.akamai.steamstatic.com/steam/apps/%d/header.jpg", game.AppID)
		imageFallbackURL := ""
		if game.ImgIconURL != "" {
			imageFallbackURL = fmt.Sprintf("https://media.steampowered.com/steamcommunity/public/images/apps/%d/%s.jpg", game.AppID, game.ImgIconURL)
		}

		response = append(response, GameResponse{
			ID:            fmt.Sprintf("%d", game.AppID),
			AppID:         game.AppID,
			Name:          game.Name,
			Platform:      "steam",
			Image:         imageURL,
			ImageFallback: imageFallbackURL,
			Playtime:      game.PlaytimeForever,
			LastPlayed:    game.RtimeLastPlayed,
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
		logSafeError("steam wishlist fetch failed", err)
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

type syncSteamWishlistRequest struct {
	AppIDs []int `json:"appIds"`
}

// SyncWishlistToWatchlist stores steam wishlist app IDs in the backend user watchlist.
// POST /v1/steam/wishlist/sync
func (h *SteamHandler) SyncWishlistToWatchlist(w http.ResponseWriter, r *http.Request) {
	user, ok := authmw.GetUserFromContext(r.Context())
	if !ok || strings.TrimSpace(user.ID) == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	if h.repo == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	var payload syncSteamWishlistRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	now := time.Now().Unix()
	if err := h.repo.UpsertUser(r.Context(), user.ID, now); err != nil {
		logSafeError("upsert user failed during wishlist sync", err)
		writeInternalError(w)
		return
	}

	unique := make(map[int]struct{}, len(payload.AppIDs))
	for _, appID := range payload.AppIDs {
		if appID <= 0 {
			continue
		}
		unique[appID] = struct{}{}
	}

	added := 0
	for appID := range unique {
		appIDStr := strconv.Itoa(appID)
		if err := h.repo.AddWatch(r.Context(), user.ID, "steam", appIDStr, "de", now); err != nil {
			logSafeError("add watch failed during wishlist sync", err)
			writeInternalError(w)
			return
		}
		if err := h.repo.TrackGame(r.Context(), "steam", appIDStr, "de", now); err != nil {
			logSafeError("track game failed during wishlist sync", err)
			writeInternalError(w)
			return
		}
		added++
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"synced": added,
	})
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
		logSafeError("steam sync fetch failed", err)
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

// --- helpers ---

func newStateToken() (string, error) {
	var buf [32]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf[:]), nil
}

func withState(returnURL, state string) string {
	u, err := url.Parse(returnURL)
	if err != nil {
		return returnURL
	}
	q := u.Query()
	q.Set("state", state)
	u.RawQuery = q.Encode()
	return u.String()
}

func (h *SteamHandler) verifyState(state string, r *http.Request) error {
	if state == "" {
		return errors.New("empty state")
	}
	cookie, err := r.Cookie("steam_state")
	if err != nil {
		return err
	}
	if subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(state)) != 1 {
		return errors.New("state mismatch")
	}
	return nil
}

func sanitizeFrontendOrigin(origin string) string {
	if origin == "" {
		return "http://localhost:3000"
	}
	u, err := url.Parse(origin)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return "http://localhost:3000"
	}
	return strings.TrimRight(origin, "/")
}

func (h *SteamHandler) safeSteamRedirect(steamID string) string {
	base := h.frontendURL
	u, err := url.Parse(base)
	if err != nil {
		return base
	}
	q := u.Query()
	q.Set("steamid", steamID)
	u.RawQuery = q.Encode()
	return u.String()
}
