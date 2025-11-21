// internal/stores/amazon.go
package stores

import (
	"context"
	"fmt"
	"os"
)

type AmazonClient struct {
	clientID     string
	clientSecret string
	redirectURI  string
}

func NewAmazonClient() StoreClient {
	return &AmazonClient{
		clientID:     os.Getenv("AMAZON_CLIENT_ID"),
		clientSecret: os.Getenv("AMAZON_CLIENT_SECRET"),
		redirectURI:  os.Getenv("AMAZON_REDIRECT_URI"),
	}
}

func (c *AmazonClient) GetName() string {
	return "amazon"
}

func (c *AmazonClient) GetAuthURL(state string) string {
	return fmt.Sprintf("https://www.amazon.com/ap/oa?client_id=%s&response_type=code&redirect_uri=%s&state=%s",
		c.clientID, c.redirectURI, state)
}

func (c *AmazonClient) ExchangeCode(ctx context.Context, code string) (*StoreTokens, error) {
	return nil, fmt.Errorf("amazon games integration not fully implemented")
}

func (c *AmazonClient) RefreshToken(ctx context.Context, refreshToken string) (*StoreTokens, error) {
	return nil, fmt.Errorf("amazon games integration not fully implemented")
}

func (c *AmazonClient) GetUserInfo(ctx context.Context, accessToken string) (*StoreUserInfo, error) {
	return nil, fmt.Errorf("use OAuth callback for user info")
}

func (c *AmazonClient) GetUserGames(ctx context.Context, accessToken string) ([]StoreGameInfo, error) {
	// Amazon Games doesn't expose a public API for game library
	// Library is managed by Amazon Games desktop client
	return []StoreGameInfo{}, nil
}

func (c *AmazonClient) SearchGames(ctx context.Context, query string, limit int) ([]StoreGameInfo, error) {
	return nil, fmt.Errorf("amazon games search not available via public API")
}

func (c *AmazonClient) GetGameDetails(ctx context.Context, storeGameID string) (*StoreGameInfo, error) {
	return nil, fmt.Errorf("amazon games details not available via public API")
}

func (c *AmazonClient) GetGamePrice(ctx context.Context, storeGameID string) (*StorePriceInfo, error) {
	return nil, fmt.Errorf("amazon games pricing not available via public API")
}
