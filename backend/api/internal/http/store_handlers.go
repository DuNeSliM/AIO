// internal/http/store_handlers.go
package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"aoi/api/internal/models"
	"aoi/api/internal/stores"

	"github.com/gorilla/mux"
)

type StoreHandlers struct {
	storeManager *stores.StoreManager
	// TODO: Add gameRepo and userLibraryRepo when database layer is ready
}

func NewStoreHandlers(storeManager *stores.StoreManager) *StoreHandlers {
	return &StoreHandlers{
		storeManager: storeManager,
	}
}

// SearchGames searches for games across all stores
// GET /api/stores/search?q=cyberpunk&user_id=123
func (h *StoreHandlers) SearchGames(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "query parameter 'q' is required", http.StatusBadRequest)
		return
	}

	limitStr := r.URL.Query().Get("limit")
	limit := 20
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	// Get user ID from context (set by auth middleware)
	userID := getUserIDFromContext(r.Context())

	// Search all stores
	results, err := h.storeManager.SearchAllStores(r.Context(), query, limit)
	if err != nil {
		http.Error(w, "failed to search stores", http.StatusInternalServerError)
		return
	}

	// TODO: Check which games the user already owns
	// For now, return empty ownership info
	ownedGames := make(map[string]bool) // key: store_game_id
	if userID > 0 {
		// TODO: Query database for user's library
		// ownedGames = h.userLibraryRepo.GetOwnedGameIDs(userID)
	}

	// Build response with ownership info
	response := SearchResultsWithOwnership{
		Query:      query,
		Results:    make(map[string][]GameSearchResult),
		TotalFound: 0,
	}

	for storeName, games := range results {
		storeResults := make([]GameSearchResult, 0, len(games))
		for _, game := range games {
			owned := ownedGames[game.StoreGameID]

			storeResults = append(storeResults, GameSearchResult{
				StoreGameInfo: game,
				Owned:         owned,
				OwnedOn:       getOwnershipStores(game.StoreGameID, ownedGames),
			})
			response.TotalFound++
		}
		response.Results[storeName] = storeResults
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetGameDetails fetches game details from a specific store with multi-store availability
// GET /api/stores/{store}/games/{gameId}?user_id=123
func (h *StoreHandlers) GetGameDetails(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	storeName := vars["store"]
	gameID := vars["gameId"]

	if !models.IsValidStore(storeName) {
		http.Error(w, "invalid store", http.StatusBadRequest)
		return
	}

	client, ok := h.storeManager.GetClient(storeName)
	if !ok {
		http.Error(w, "store client not found", http.StatusNotFound)
		return
	}

	// Get game details from the requested store
	gameInfo, err := client.GetGameDetails(r.Context(), gameID)
	if err != nil {
		http.Error(w, "failed to fetch game details: "+err.Error(), http.StatusInternalServerError)
		return
	}

	userID := getUserIDFromContext(r.Context())

	// TODO: Search for the same game on other stores
	// This would require game name matching or a unified game database
	availableStores := h.findGameOnOtherStores(r.Context(), gameInfo.Name)

	// TODO: Check if user owns this game
	owned := false
	ownedOnStores := []string{}
	if userID > 0 {
		// TODO: Query database
		// owned, ownedOnStores = h.userLibraryRepo.CheckOwnership(userID, gameInfo.Name)
	}

	response := GameDetailsWithAvailability{
		Game:            *gameInfo,
		RequestedStore:  storeName,
		Owned:           owned,
		OwnedOn:         ownedOnStores,
		AvailableStores: availableStores,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetGamePricing fetches pricing across all stores for a game
// GET /api/stores/pricing?name=Cyberpunk+2077
func (h *StoreHandlers) GetGamePricing(w http.ResponseWriter, r *http.Request) {
	gameName := r.URL.Query().Get("name")
	if gameName == "" {
		http.Error(w, "query parameter 'name' is required", http.StatusBadRequest)
		return
	}

	// Search for game on all stores
	results, err := h.storeManager.SearchAllStores(r.Context(), gameName, 5)
	if err != nil {
		http.Error(w, "failed to search stores", http.StatusInternalServerError)
		return
	}

	// Collect pricing info
	pricing := make(map[string]StorePricing)
	for storeName, games := range results {
		if len(games) == 0 {
			continue
		}

		// Use first result (best match)
		game := games[0]

		storePricing := StorePricing{
			Store:         storeName,
			StoreGameID:   game.StoreGameID,
			StoreURL:      game.StoreURL,
			Available:     true,
			Price:         game.Price,
			DiscountPrice: game.DiscountPrice,
			Currency:      game.Currency,
		}

		if game.Price != nil && game.DiscountPrice != nil {
			discount := ((*game.Price - *game.DiscountPrice) / *game.Price) * 100
			storePricing.DiscountPercent = &discount
		}

		pricing[storeName] = storePricing
	}

	// Find best price
	var bestPrice *StorePricing
	var lowestPrice float64 = -1
	for _, p := range pricing {
		price := p.Price
		if p.DiscountPrice != nil {
			price = p.DiscountPrice
		}
		if price != nil && (lowestPrice < 0 || *price < lowestPrice) {
			lowestPrice = *price
			pCopy := p
			bestPrice = &pCopy
		}
	}

	response := MultiStorePricing{
		GameName:  gameName,
		Stores:    pricing,
		BestPrice: bestPrice,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Helper functions

func (h *StoreHandlers) findGameOnOtherStores(ctx context.Context, gameName string) []StoreAvailability {
	results, err := h.storeManager.SearchAllStores(ctx, gameName, 3)
	if err != nil {
		return []StoreAvailability{}
	}

	availability := make([]StoreAvailability, 0)
	for storeName, games := range results {
		if len(games) == 0 {
			continue
		}

		// Use best match (first result)
		game := games[0]

		storeAvail := StoreAvailability{
			Store:       storeName,
			StoreGameID: game.StoreGameID,
			StoreURL:    game.StoreURL,
			Available:   true,
		}

		if game.Price != nil {
			storeAvail.Price = game.Price
			storeAvail.Currency = game.Currency
		}
		if game.DiscountPrice != nil {
			storeAvail.DiscountPrice = game.DiscountPrice
		}

		availability = append(availability, storeAvail)
	}

	return availability
}

func getOwnershipStores(gameID string, ownedGames map[string]bool) []string {
	// TODO: Implement actual ownership lookup across stores
	// For now, return empty if not owned
	if ownedGames[gameID] {
		return []string{"steam"} // placeholder
	}
	return []string{}
}

func getUserIDFromContext(ctx context.Context) int64 {
	// TODO: Get from JWT claims in auth middleware
	userID, ok := ctx.Value("user_id").(int64)
	if !ok {
		return 0
	}
	return userID
}

// Response structures

type SearchResultsWithOwnership struct {
	Query      string                        `json:"query"`
	Results    map[string][]GameSearchResult `json:"results"`
	TotalFound int                           `json:"total_found"`
}

type GameSearchResult struct {
	stores.StoreGameInfo
	Owned   bool     `json:"owned"`
	OwnedOn []string `json:"owned_on,omitempty"` // list of stores where user owns this game
}

type GameDetailsWithAvailability struct {
	Game            stores.StoreGameInfo `json:"game"`
	RequestedStore  string               `json:"requested_store"`
	Owned           bool                 `json:"owned"`
	OwnedOn         []string             `json:"owned_on,omitempty"`
	AvailableStores []StoreAvailability  `json:"available_stores"`
}

type StoreAvailability struct {
	Store         string   `json:"store"`
	StoreGameID   string   `json:"store_game_id"`
	StoreURL      string   `json:"store_url"`
	Available     bool     `json:"available"`
	Price         *float64 `json:"price,omitempty"`
	DiscountPrice *float64 `json:"discount_price,omitempty"`
	Currency      string   `json:"currency,omitempty"`
}

type MultiStorePricing struct {
	GameName  string                  `json:"game_name"`
	Stores    map[string]StorePricing `json:"stores"`
	BestPrice *StorePricing           `json:"best_price,omitempty"`
}

type StorePricing struct {
	Store           string   `json:"store"`
	StoreGameID     string   `json:"store_game_id"`
	StoreURL        string   `json:"store_url"`
	Available       bool     `json:"available"`
	Price           *float64 `json:"price,omitempty"`
	DiscountPrice   *float64 `json:"discount_price,omitempty"`
	Currency        string   `json:"currency,omitempty"`
	DiscountPercent *float64 `json:"discount_percent,omitempty"`
}
