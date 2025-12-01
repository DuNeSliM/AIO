// internal/http/library_handlers.go
package http

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"aoi/api/internal/library"
	"aoi/api/internal/models"
	"aoi/api/internal/stores"
)

type LibraryHandlers struct {
	Service library.Service
}

func NewLibraryHandlers(service library.Service) *LibraryHandlers {
	return &LibraryHandlers{Service: service}
}

func (h *LibraryHandlers) RegisterRoutes(r *gin.RouterGroup) {
	// Library routes
	r.GET("/library", h.GetLibrary)
	r.PUT("/library/:id", h.UpdateLibraryEntry)
	r.DELETE("/library/:id", h.RemoveFromLibrary)

	// Wishlist routes
	r.GET("/wishlist", h.GetWishlist)
	r.POST("/wishlist", h.AddToWishlist)
	r.PUT("/wishlist/:id", h.UpdateWishlistItem)
	r.DELETE("/wishlist/:id", h.RemoveFromWishlist)

	// Store account routes
	r.GET("/stores/accounts", h.GetStoreAccounts)
	r.POST("/stores/:store/connect", h.ConnectStore)
	r.POST("/stores/:store/callback", h.StoreCallback)
	r.DELETE("/stores/:store/disconnect", h.DisconnectStore)
	r.POST("/stores/:store/sync", h.SyncStore)
	r.POST("/stores/sync-all", h.SyncAllStores)

	// Shop/Search routes
	r.GET("/shop/search", h.SearchGames)
	r.GET("/shop/search-all", h.SearchAllStores)
	r.GET("/shop/games/:id", h.GetGameDetails)
}

// GET /api/library
func (h *LibraryHandlers) GetLibrary(c *gin.Context) {
	userID := getUserID(c)

	filter := &models.LibraryFilter{
		Query:     c.Query("query"),
		Limit:     getIntQuery(c, "limit", 1000),
		Offset:    getIntQuery(c, "offset", 0),
		SortBy:    c.Query("sort_by"),
		SortOrder: c.Query("sort_order"),
	}

	if stores := c.QueryArray("stores"); len(stores) > 0 {
		filter.Stores = stores
	}

	if statuses := c.QueryArray("completion_status"); len(statuses) > 0 {
		filter.CompletionStatus = statuses
	}

	if isFav := c.Query("is_favorite"); isFav != "" {
		val := isFav == "true"
		filter.IsFavorite = &val
	}

	if isInstalled := c.Query("is_installed"); isInstalled != "" {
		val := isInstalled == "true"
		filter.IsInstalled = &val
	}

	library, err := h.Service.GetUserLibrary(c.Request.Context(), userID, filter)
	if err != nil {
		log.Printf("GetLibrary error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch library"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"games": library})
}

// PUT /api/library/:id
func (h *LibraryHandlers) UpdateLibraryEntry(c *gin.Context) {
	userID := getUserID(c)

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid library ID"})
		return
	}

	var req models.UserLibrary
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.ID = id
	req.UserID = userID

	if err := h.Service.UpdateLibraryEntry(c.Request.Context(), userID, &req); err != nil {
		log.Printf("UpdateLibraryEntry error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update library entry"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "library entry updated"})
}

// DELETE /api/library/:id
func (h *LibraryHandlers) RemoveFromLibrary(c *gin.Context) {
	userID := getUserID(c)

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid library ID"})
		return
	}

	if err := h.Service.RemoveFromLibrary(c.Request.Context(), userID, id); err != nil {
		log.Printf("RemoveFromLibrary error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove from library"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "removed from library"})
}

// GET /api/wishlist
func (h *LibraryHandlers) GetWishlist(c *gin.Context) {
	userID := getUserID(c)

	wishlist, err := h.Service.GetUserWishlist(c.Request.Context(), userID)
	if err != nil {
		log.Printf("GetWishlist error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch wishlist"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"items": wishlist})
}

// POST /api/wishlist
func (h *LibraryHandlers) AddToWishlist(c *gin.Context) {
	userID := getUserID(c)

	var req models.Wishlist
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := h.Service.AddToWishlist(c.Request.Context(), userID, &req)
	if err != nil {
		log.Printf("AddToWishlist error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add to wishlist"})
		return
	}

	c.JSON(http.StatusCreated, item)
}

// PUT /api/wishlist/:id
func (h *LibraryHandlers) UpdateWishlistItem(c *gin.Context) {
	userID := getUserID(c)

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid wishlist ID"})
		return
	}

	var req models.Wishlist
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.ID = id

	if err := h.Service.UpdateWishlistItem(c.Request.Context(), userID, &req); err != nil {
		log.Printf("UpdateWishlistItem error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update wishlist item"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "wishlist item updated"})
}

// DELETE /api/wishlist/:id
func (h *LibraryHandlers) RemoveFromWishlist(c *gin.Context) {
	userID := getUserID(c)

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid wishlist ID"})
		return
	}

	if err := h.Service.RemoveFromWishlist(c.Request.Context(), userID, id); err != nil {
		log.Printf("RemoveFromWishlist error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove from wishlist"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "removed from wishlist"})
}

// GET /api/stores/accounts
func (h *LibraryHandlers) GetStoreAccounts(c *gin.Context) {
	userID := getUserID(c)

	accounts, err := h.Service.GetUserStoreAccounts(c.Request.Context(), userID)
	if err != nil {
		log.Printf("GetStoreAccounts error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch store accounts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"accounts": accounts})
}

// POST /api/stores/:store/connect
func (h *LibraryHandlers) ConnectStore(c *gin.Context) {
	userID := getUserID(c)
	store := c.Param("store")

	if !models.IsValidStore(store) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid store"})
		return
	}

	// Return auth URL for frontend to redirect user
	// In a real implementation, we'd get this from the store manager
	authURL := fmt.Sprintf("/auth/%s/login?user_id=%d", store, userID)

	c.JSON(http.StatusOK, gin.H{"auth_url": authURL})
}

// POST /api/stores/:store/callback
func (h *LibraryHandlers) StoreCallback(c *gin.Context) {
	userID := getUserID(c)
	store := c.Param("store")

	var req struct {
		Code string `json:"code" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.Service.ConnectStoreAccount(c.Request.Context(), userID, store, req.Code); err != nil {
		log.Printf("ConnectStore error for %s: %v", store, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to connect store account"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "store connected successfully"})
}

// DELETE /api/stores/:store/disconnect
func (h *LibraryHandlers) DisconnectStore(c *gin.Context) {
	userID := getUserID(c)
	store := c.Param("store")

	if err := h.Service.DisconnectStoreAccount(c.Request.Context(), userID, store); err != nil {
		log.Printf("DisconnectStore error for %s: %v", store, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to disconnect store"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "store disconnected"})
}

// POST /api/stores/:store/sync
func (h *LibraryHandlers) SyncStore(c *gin.Context) {
	userID := getUserID(c)
	store := c.Param("store")

	if err := h.Service.SyncStoreLibrary(c.Request.Context(), userID, store); err != nil {
		log.Printf("SyncStore error for %s: %v", store, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sync store library"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "library synced"})
}

// POST /api/stores/sync-all
func (h *LibraryHandlers) SyncAllStores(c *gin.Context) {
	userID := getUserID(c)

	if err := h.Service.SyncAllLibraries(c.Request.Context(), userID); err != nil {
		log.Printf("SyncAllStores error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("%v", err)})
		return
	}

	// Get library count after sync
	library, _ := h.Service.GetUserLibrary(c.Request.Context(), userID, &models.LibraryFilter{Limit: 1000})
	totalGames := len(library)

	c.JSON(http.StatusOK, gin.H{"message": "all libraries synced", "total_synced": totalGames})
}

// GET /api/shop/search
func (h *LibraryHandlers) SearchGames(c *gin.Context) {
	filter := &models.SearchFilter{
		Query:     c.Query("query"),
		Limit:     getIntQuery(c, "limit", 20),
		Offset:    getIntQuery(c, "offset", 0),
		SortBy:    c.Query("sort_by"),
		SortOrder: c.Query("sort_order"),
		OnSale:    c.Query("on_sale") == "true",
	}

	if stores := c.QueryArray("stores"); len(stores) > 0 {
		filter.Stores = stores
	}

	if genres := c.QueryArray("genres"); len(genres) > 0 {
		filter.Genres = genres
	}

	games, err := h.Service.SearchGames(c.Request.Context(), filter)
	if err != nil {
		log.Printf("SearchGames error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to search games"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"games": games})
}

// GET /api/shop/search-all
func (h *LibraryHandlers) SearchAllStores(c *gin.Context) {
	query := c.Query("query")
	limit := getIntQuery(c, "limit", 10)

	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter required"})
		return
	}

	results, err := h.Service.SearchAllStores(c.Request.Context(), query, limit)
	if err != nil {
		log.Printf("SearchAllStores error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to search stores"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"results": results})
}

// GET /api/shop/games/:id
func (h *LibraryHandlers) GetGameDetails(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid game ID"})
		return
	}

	game, err := h.Service.GetGameDetails(c.Request.Context(), id)
	if err != nil {
		log.Printf("GetGameDetails error: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "game not found"})
		return
	}

	c.JSON(http.StatusOK, game)
}

// POST /api/stores/epic/browser-sync
func (h *LibraryHandlers) EpicBrowserSync(c *gin.Context) {
	var games []string
	var userID int64

	log.Printf("EpicBrowserSync called with Content-Type: %s, Method: %s", c.ContentType(), c.Request.Method)

	// Check if form data exists (from form submit to bypass CSP)
	dataStr := c.PostForm("data")
	if dataStr != "" {
		log.Printf("Received form data, length: %d", len(dataStr))

		// Parse the JSON from the form data
		var req struct {
			UserID interface{} `json:"userId"` // Can be string or int
			Token  string      `json:"token"`
			Games  []struct {
				Name     string `json:"name"`
				EpicID   string `json:"epicId"`
				Platform string `json:"platform"`
			} `json:"games"`
		}

		if err := json.Unmarshal([]byte(dataStr), &req); err != nil {
			log.Printf("Failed to parse form data JSON: %v", err)
			log.Printf("Data string: %s", dataStr)
			c.Data(http.StatusBadRequest, "text/html; charset=utf-8", []byte("<html><body><h1>❌ Error</h1><p>Invalid data format: "+err.Error()+"</p></body></html>"))
			return
		}

		// Convert userId to int64
		switch v := req.UserID.(type) {
		case string:
			id, err := strconv.ParseInt(v, 10, 64)
			if err != nil {
				c.Data(http.StatusBadRequest, "text/html; charset=utf-8", []byte("<html><body><h1>❌ Error</h1><p>Invalid userId</p></body></html>"))
				return
			}
			userID = id
		case float64:
			userID = int64(v)
		default:
			c.Data(http.StatusBadRequest, "text/html; charset=utf-8", []byte("<html><body><h1>❌ Error</h1><p>Invalid userId type</p></body></html>"))
			return
		}

		log.Printf("Parsed form data: userID=%d, games=%d", userID, len(req.Games))
		userID = userID
		for _, game := range req.Games {
			games = append(games, game.Name)
		}
	} else {
		// JSON request
		var req struct {
			UserID int64    `json:"userId"`
			Token  string   `json:"token"`
			Games  []string `json:"games"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("Failed to parse JSON request: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: " + err.Error()})
			return
		}

		userID = req.UserID
		games = req.Games
	}

	// Simple validation - just check user ID is provided
	if userID == 0 || len(games) == 0 {
		isFormData := c.PostForm("data") != ""
		if isFormData {
			c.Data(http.StatusBadRequest, "text/html; charset=utf-8", []byte("<html><body><h1>❌ Error</h1><p>Missing userId or games</p></body></html>"))
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing userId or games"})
		}
		return
	}

	log.Printf("Received browser sync request for user %d with %d games", userID, len(games))

	log.Printf("Received %d games from Epic browser sync for user %d", len(games), userID)

	// Import games - we'll create a temporary store game list and process it
	// through the same import logic that SyncStoreLibrary uses
	imported := 0
	skipped := 0

	for _, gameName := range games {
		if gameName == "" {
			continue
		}

		// Try to import the game using the service's internal import logic
		// We'll convert to StoreGameInfo format first
		storeGameInfo := stores.StoreGameInfo{
			StoreGameID: gameName,
			Name:        gameName,
		}

		// Call the same import logic used by sync
		if err := h.Service.ImportGameFromStore(c.Request.Context(), userID, "epic", &storeGameInfo); err != nil {
			log.Printf("Failed to import game %s: %v", gameName, err)
			skipped++
			continue
		}

		imported++
	}

	log.Printf("Successfully imported %d/%d games from Epic browser sync (%d skipped)", imported, len(games), skipped)

	// Return HTML for form submissions, JSON for API calls
	isFormData := c.PostForm("data") != ""
	if isFormData {
		c.Header("Content-Type", "text/html; charset=utf-8")
		c.String(http.StatusOK, fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
	<title>Epic Games Sync Complete</title>
	<style>
		body { font-family: sans-serif; background: #1a1a1a; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
		.container { text-align: center; background: #2a2a2a; padding: 40px; border-radius: 8px; max-width: 500px; }
		h1 { color: #4caf50; }
		.stats { font-size: 20px; margin: 20px 0; }
		.stats strong { color: #00a8ff; }
	</style>
</head>
<body>
	<div class="container">
		<h1>✅ Sync Complete!</h1>
		<div class="stats">
			Added <strong>%d new games</strong> from Epic<br>
			<span style="font-size: 16px; color: #aaa;">Found %d total Epic games</span><br>
			<span style="font-size: 14px; color: #888;">(%d already in your library)</span>
		</div>
		<p style="margin-top: 20px;">Check your AIO library - you now have all your Epic games!</p>
		<p style="font-size: 12px; color: #666;">This window will close in 5 seconds...</p>
	</div>
	<script>setTimeout(() => window.close(), 5000);</script>
</body>
</html>
		`, imported, len(games), skipped))
	} else {
		c.JSON(http.StatusOK, gin.H{
			"success":  true,
			"imported": imported,
			"skipped":  skipped,
			"total":    len(games),
		})
	}
}

// Helper functions
func getUserID(c *gin.Context) int64 {
	userIDAny, _ := c.Get("userID")
	userID, _ := userIDAny.(int64)
	return userID
}

func getIntQuery(c *gin.Context, key string, defaultVal int) int {
	if val := c.Query(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultVal
}
