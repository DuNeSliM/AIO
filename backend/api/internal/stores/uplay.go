// internal/stores/uplay.go
package stores

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type UplayClient struct {
	clientID     string
	clientSecret string
	redirectURI  string
}

func NewUplayClient() StoreClient {
	return &UplayClient{
		clientID:     os.Getenv("UPLAY_CLIENT_ID"),
		clientSecret: os.Getenv("UPLAY_CLIENT_SECRET"),
		redirectURI:  os.Getenv("UPLAY_REDIRECT_URI"),
	}
}

func (c *UplayClient) GetName() string {
	return "uplay"
}

func (c *UplayClient) GetAuthURL(state string) string {
	return fmt.Sprintf("https://connect.ubisoft.com/oauth/authorize?client_id=%s&response_type=code&redirect_uri=%s&state=%s",
		c.clientID, c.redirectURI, state)
}

func (c *UplayClient) ExchangeCode(ctx context.Context, code string) (*StoreTokens, error) {
	return nil, fmt.Errorf("uplay integration not fully implemented")
}

func (c *UplayClient) RefreshToken(ctx context.Context, refreshToken string) (*StoreTokens, error) {
	return nil, fmt.Errorf("uplay integration not fully implemented")
}

func (c *UplayClient) GetUserInfo(ctx context.Context, accessToken string) (*StoreUserInfo, error) {
	return nil, fmt.Errorf("use OAuth callback for user info")
}

func (c *UplayClient) GetUserGames(ctx context.Context, accessToken string) ([]StoreGameInfo, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	// Get user's owned games from Ubisoft Connect
	req, err := http.NewRequestWithContext(ctx, "GET", "https://public-ubiservices.ubi.com/v1/profiles/me/games", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Ubi-AppId", c.clientID)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		OwnedGames []struct {
			GameID   string `json:"spaceId"`
			Name     string `json:"name"`
			ImageURL string `json:"imageUrl"`
		} `json:"ownedGames"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	games := make([]StoreGameInfo, 0, len(result.OwnedGames))
	for _, game := range result.OwnedGames {
		games = append(games, StoreGameInfo{
			StoreGameID: game.GameID,
			Name:        game.Name,
			CoverImage:  game.ImageURL,
		})
	}

	return games, nil
}

func (c *UplayClient) SearchGames(ctx context.Context, query string, limit int) ([]StoreGameInfo, error) {
	return nil, fmt.Errorf("ubisoft connect search requires user authentication")
}

func (c *UplayClient) GetGameDetails(ctx context.Context, storeGameID string) (*StoreGameInfo, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequestWithContext(ctx, "GET", "https://public-ubiservices.ubi.com/v1/games/"+storeGameID, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Ubi-AppId", c.clientID)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		GameID   string `json:"spaceId"`
		Name     string `json:"name"`
		ImageURL string `json:"imageUrl"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &StoreGameInfo{
		StoreGameID: result.GameID,
		Name:        result.Name,
		CoverImage:  result.ImageURL,
	}, nil
}

func (c *UplayClient) GetGamePrice(ctx context.Context, storeGameID string) (*StorePriceInfo, error) {
	return nil, fmt.Errorf("ubisoft connect pricing requires web scraping")
}
