// internal/stores/ea.go
package stores

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type EAClient struct {
	clientID     string
	clientSecret string
	redirectURI  string
}

func NewEAClient() StoreClient {
	return &EAClient{
		clientID:     os.Getenv("EA_CLIENT_ID"),
		clientSecret: os.Getenv("EA_CLIENT_SECRET"),
		redirectURI:  os.Getenv("EA_REDIRECT_URI"),
	}
}

func (c *EAClient) GetName() string {
	return "ea"
}

func (c *EAClient) GetAuthURL(state string) string {
	return fmt.Sprintf("https://accounts.ea.com/connect/auth?client_id=%s&response_type=code&redirect_uri=%s&state=%s",
		c.clientID, c.redirectURI, state)
}

func (c *EAClient) ExchangeCode(ctx context.Context, code string) (*StoreTokens, error) {
	return nil, fmt.Errorf("ea app integration not fully implemented")
}

func (c *EAClient) RefreshToken(ctx context.Context, refreshToken string) (*StoreTokens, error) {
	return nil, fmt.Errorf("ea app integration not fully implemented")
}

func (c *EAClient) GetUserInfo(ctx context.Context, accessToken string) (*StoreUserInfo, error) {
	return nil, fmt.Errorf("use OAuth callback for user info")
}

func (c *EAClient) GetUserGames(ctx context.Context, accessToken string) ([]StoreGameInfo, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	// Get user's EA Play library
	req, err := http.NewRequestWithContext(ctx, "GET", "https://gateway.ea.com/proxy/subscription/entitlements", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Entitlements []struct {
			ProductID string `json:"productId"`
			GameTitle string `json:"gameTitle"`
		} `json:"entitlements"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	games := make([]StoreGameInfo, 0, len(result.Entitlements))
	for _, entitlement := range result.Entitlements {
		games = append(games, StoreGameInfo{
			StoreGameID: entitlement.ProductID,
			Name:        entitlement.GameTitle,
		})
	}

	return games, nil
}

func (c *EAClient) SearchGames(ctx context.Context, query string, limit int) ([]StoreGameInfo, error) {
	return nil, fmt.Errorf("ea app search not available via public API")
}

func (c *EAClient) GetGameDetails(ctx context.Context, storeGameID string) (*StoreGameInfo, error) {
	return nil, fmt.Errorf("ea app game details require desktop client")
}

func (c *EAClient) GetGamePrice(ctx context.Context, storeGameID string) (*StorePriceInfo, error) {
	return nil, fmt.Errorf("ea app pricing not available via public API")
}
