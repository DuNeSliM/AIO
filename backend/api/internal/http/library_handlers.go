// internal/http/library_handlers.go
package http

import (
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"aoi/api/internal/library"
	"aoi/api/internal/models"
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
		Limit:     getIntQuery(c, "limit", 50),
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
