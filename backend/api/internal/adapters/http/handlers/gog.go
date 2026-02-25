package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	authmw "gamedivers.de/api/internal/adapters/http/middleware"
	"gamedivers.de/api/internal/adapters/stores/gog"
	"gamedivers.de/api/internal/ports/repo"
)

type GOGHandler struct {
	manifestReader *gog.ManifestReader
	repo           repo.Repo
}

type GOGGameResponse struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Platform string `json:"platform"`
	Image    string `json:"image,omitempty"`
}

type GOGWishlistResponse struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Platform string `json:"platform"`
	Image    string `json:"image,omitempty"`
}

type AvailabilityResponse struct {
	Available bool   `json:"available"`
	Message   string `json:"message"`
}

// NewGOGHandler creates a new GOG handler (uses local manifest, no OAuth)
func NewGOGHandler(repo repo.Repo) *GOGHandler {
	return &GOGHandler{
		manifestReader: gog.NewManifestReader(),
		repo:           repo,
	}
}

// IsAvailable checks if GOG Galaxy is installed on this system
// GET /v1/gog/available
func (h *GOGHandler) IsAvailable(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	available := h.manifestReader.IsAvailable()
	if available {
		json.NewEncoder(w).Encode(AvailabilityResponse{
			Available: true,
			Message:   "GOG Galaxy found",
		})
	} else {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(AvailabilityResponse{
			Available: false,
			Message:   "GOG Galaxy not installed or not found",
		})
	}
}

// GetLibrary reads installed games from GOG Galaxy local manifest
// GET /v1/gog/library (protected)
func (h *GOGHandler) GetLibrary(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	games, err := h.manifestReader.GetLibrary()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := make([]GOGGameResponse, len(games))
	for i, game := range games {
		response[i] = GOGGameResponse{
			ID:       game.GameID,
			Title:    game.Title,
			Platform: "gog",
			Image:    game.Image,
		}
	}

	json.NewEncoder(w).Encode(response)
}

// GetWishlist reads wishlist from GOG Galaxy local manifest
// GET /v1/gog/wishlist (protected)
func (h *GOGHandler) GetWishlist(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	wishlistItems, err := h.manifestReader.GetWishlist()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := make([]GOGWishlistResponse, len(wishlistItems))
	for i, item := range wishlistItems {
		response[i] = GOGWishlistResponse{
			ID:       item.GameID,
			Title:    item.Title,
			Platform: "gog",
			Image:    item.Image,
		}
	}

	json.NewEncoder(w).Encode(response)
}

// SyncLibrary syncs GOG library to database
// POST /v1/gog/sync (protected)
func (h *GOGHandler) SyncLibrary(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	games, err := h.manifestReader.GetLibrary()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Get user from JWT
	user, ok := authmw.GetUserFromContext(r.Context())
	if !ok || strings.TrimSpace(user.ID) == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	if h.repo == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	now := time.Now().Unix()
	if err := h.repo.UpsertUser(r.Context(), user.ID, now); err != nil {
		logSafeError("upsert user failed during gog library sync", err)
		writeInternalError(w)
		return
	}

	// Store games in database
	syncedCount := 0
	for _, game := range games {
		if err := h.repo.TrackGame(r.Context(), "gog", game.GameID, "de", now); err != nil {
			logSafeError("track game failed during gog library sync", err)
			continue
		}
		syncedCount++
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"synced":  syncedCount,
		"status":  "success",
		"message": "",
	})
}

// SyncWishlist syncs GOG wishlist to watchlist in database
// POST /v1/gog/wishlist/sync (protected)
func (h *GOGHandler) SyncWishlist(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	type SyncRequest struct {
		GameIds []string `json:"gameIds"`
	}

	var req SyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Get user from JWT
	user, ok := authmw.GetUserFromContext(r.Context())
	if !ok || strings.TrimSpace(user.ID) == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	if h.repo == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	now := time.Now().Unix()
	if err := h.repo.UpsertUser(r.Context(), user.ID, now); err != nil {
		logSafeError("upsert user failed during gog wishlist sync", err)
		writeInternalError(w)
		return
	}

	addedCount := 0
	for _, gameID := range req.GameIds {
		if err := h.repo.AddWatch(r.Context(), user.ID, "gog", gameID, "de", now); err != nil {
			logSafeError("add watch failed during gog wishlist sync", err)
			continue
		}
		if err := h.repo.TrackGame(r.Context(), "gog", gameID, "de", now); err != nil {
			logSafeError("track game failed during gog wishlist sync", err)
			continue
		}
		addedCount++
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"added":  addedCount,
		"status": "success",
	})
}
