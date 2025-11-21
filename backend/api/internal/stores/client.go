// internal/stores/client.go
package stores

import (
	"context"
	"time"

	"aoi/api/internal/models"
)

// StoreClient defines the interface for interacting with game store APIs
type StoreClient interface {
	// GetName returns the store identifier
	GetName() string

	// GetAuthURL generates the OAuth URL for user authentication
	GetAuthURL(state string) string

	// ExchangeCode exchanges an OAuth code for access tokens
	ExchangeCode(ctx context.Context, code string) (*StoreTokens, error)

	// RefreshToken refreshes an expired access token
	RefreshToken(ctx context.Context, refreshToken string) (*StoreTokens, error)

	// GetUserInfo fetches user profile information
	GetUserInfo(ctx context.Context, accessToken string) (*StoreUserInfo, error)

	// GetUserGames fetches all games owned by the user
	GetUserGames(ctx context.Context, accessToken string) ([]StoreGameInfo, error)

	// SearchGames searches for games in the store
	SearchGames(ctx context.Context, query string, limit int) ([]StoreGameInfo, error)

	// GetGameDetails fetches detailed information about a specific game
	GetGameDetails(ctx context.Context, storeGameID string) (*StoreGameInfo, error)

	// GetGamePrice fetches current pricing for a game
	GetGamePrice(ctx context.Context, storeGameID string) (*StorePriceInfo, error)
}

// StoreTokens represents OAuth tokens from a store
type StoreTokens struct {
	AccessToken  string
	RefreshToken string
	ExpiresAt    time.Time
}

// StoreUserInfo represents user information from a store
type StoreUserInfo struct {
	StoreUserID string
	DisplayName string
	AvatarURL   string
	Email       string
}

// StoreGameInfo represents game information from a store
type StoreGameInfo struct {
	StoreGameID     string
	Name            string
	Description     string
	Developer       string
	Publisher       string
	ReleaseDate     *time.Time
	CoverImage      string
	BackgroundImage string
	Icon            string
	Genres          []string
	Tags            []string
	Platforms       []string
	StoreURL        string
	Price           *float64
	DiscountPrice   *float64
	Currency        string
	PlayTime        int // user's playtime in minutes (if available)
	LastPlayed      *time.Time
}

// StorePriceInfo represents pricing information
type StorePriceInfo struct {
	StoreGameID   string
	Price         float64
	DiscountPrice *float64
	Currency      string
	IsAvailable   bool
}

// StoreManager manages all store clients
type StoreManager struct {
	clients map[string]StoreClient
}

// NewStoreManager creates a new store manager
func NewStoreManager() *StoreManager {
	sm := &StoreManager{
		clients: make(map[string]StoreClient),
	}

	// Register all store clients
	sm.RegisterClient(NewSteamClient())
	sm.RegisterClient(NewEpicClient())
	sm.RegisterClient(NewGOGClient())
	sm.RegisterClient(NewXboxClient())
	sm.RegisterClient(NewBattleNetClient())
	sm.RegisterClient(NewUplayClient())
	sm.RegisterClient(NewAmazonClient())
	sm.RegisterClient(NewEAClient())
	sm.RegisterClient(NewPSNClient())

	return sm
}

// RegisterClient registers a store client
func (sm *StoreManager) RegisterClient(client StoreClient) {
	sm.clients[client.GetName()] = client
}

// GetClient returns a store client by name
func (sm *StoreManager) GetClient(storeName string) (StoreClient, bool) {
	if !models.IsValidStore(storeName) {
		return nil, false
	}
	client, ok := sm.clients[storeName]
	return client, ok
}

// GetAllClients returns all registered store clients
func (sm *StoreManager) GetAllClients() map[string]StoreClient {
	return sm.clients
}

// SearchAllStores searches for games across all stores
func (sm *StoreManager) SearchAllStores(ctx context.Context, query string, limit int) (map[string][]StoreGameInfo, error) {
	results := make(map[string][]StoreGameInfo)

	for storeName, client := range sm.clients {
		games, err := client.SearchGames(ctx, query, limit)
		if err != nil {
			// Log error but continue with other stores
			continue
		}
		results[storeName] = games
	}

	return results, nil
}
