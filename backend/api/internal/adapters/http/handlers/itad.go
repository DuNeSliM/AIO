package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"gamedivers.de/api/internal/adapters/stores/itad"
)

// ITADHandler handles IsThereAnyDeal API requests
type ITADHandler struct {
	Client *itad.Client
}

// Search handles game search requests
// GET /v1/itad/search?q=<query>&limit=<limit>
func (h *ITADHandler) Search(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "missing query parameter 'q'", http.StatusBadRequest)
		return
	}

	limit := 5 // default limit
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 20 {
			limit = l
		}
	}

	data, err := h.Client.Search(r.Context(), query, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

// GetGameInfo handles game info requests
// GET /v1/itad/games/{gameId}/info
func (h *ITADHandler) GetGameInfo(w http.ResponseWriter, r *http.Request) {
	gameID := chi.URLParam(r, "gameId")
	if gameID == "" {
		http.Error(w, "missing gameId", http.StatusBadRequest)
		return
	}

	data, err := h.Client.GetGameInfo(r.Context(), gameID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

// GetGamePrices handles game prices requests
// GET /v1/itad/games/{gameId}/prices?country=<cc>
func (h *ITADHandler) GetGamePrices(w http.ResponseWriter, r *http.Request) {
	gameID := chi.URLParam(r, "gameId")
	if gameID == "" {
		http.Error(w, "missing gameId", http.StatusBadRequest)
		return
	}

	country := r.URL.Query().Get("country")
	if country == "" {
		country = "DE" // default to Germany
	}

	data, err := h.Client.GetGamePrices(r.Context(), gameID, country)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

// GetOverview handles price overview requests for multiple games
// GET /v1/itad/overview?id=<id1>&id=<id2>&country=<cc>
func (h *ITADHandler) GetOverview(w http.ResponseWriter, r *http.Request) {
	ids := r.URL.Query()["id"]
	if len(ids) == 0 {
		http.Error(w, "missing id parameter(s)", http.StatusBadRequest)
		return
	}

	country := r.URL.Query().Get("country")
	if country == "" {
		country = "DE"
	}

	data, err := h.Client.GetOverview(r.Context(), ids, country)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

// GetHistoricalLow handles historical low price requests
// GET /v1/itad/games/{gameId}/historylow?country=<cc>
func (h *ITADHandler) GetHistoricalLow(w http.ResponseWriter, r *http.Request) {
	gameID := chi.URLParam(r, "gameId")
	if gameID == "" {
		http.Error(w, "missing gameId", http.StatusBadRequest)
		return
	}

	country := r.URL.Query().Get("country")
	if country == "" {
		country = "DE"
	}

	data, err := h.Client.GetHistoricalLow(r.Context(), gameID, country)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

// GetStores handles available stores request
// GET /v1/itad/stores?country=<cc>
func (h *ITADHandler) GetStores(w http.ResponseWriter, r *http.Request) {
	country := r.URL.Query().Get("country")
	if country == "" {
		country = "DE"
	}

	data, err := h.Client.GetStores(r.Context(), country)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

// GetGameDetails is a convenience endpoint that returns both game info and prices
// GET /v1/itad/games/{gameId}?country=<cc>
func (h *ITADHandler) GetGameDetails(w http.ResponseWriter, r *http.Request) {
	gameID := chi.URLParam(r, "gameId")
	if gameID == "" {
		http.Error(w, "missing gameId", http.StatusBadRequest)
		return
	}

	country := r.URL.Query().Get("country")
	if country == "" {
		country = "DE"
	}

	// Fetch both info and prices
	infoData, err := h.Client.GetGameInfo(r.Context(), gameID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	pricesData, err := h.Client.GetGamePrices(r.Context(), gameID, country)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	historyData, err := h.Client.GetHistoricalLow(r.Context(), gameID, country)
	if err != nil {
		// Don't fail if history is not available
		historyData = json.RawMessage(`{}`)
	}

	// Combine into a single response
	response := map[string]json.RawMessage{
		"info":       infoData,
		"prices":     pricesData,
		"historyLow": historyData,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
