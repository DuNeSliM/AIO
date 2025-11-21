// internal/stores/psn.go
package stores

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type PSNClient struct {
	clientID     string
	clientSecret string
	redirectURI  string
}

func NewPSNClient() StoreClient {
	return &PSNClient{
		clientID:     os.Getenv("PSN_CLIENT_ID"),
		clientSecret: os.Getenv("PSN_CLIENT_SECRET"),
		redirectURI:  os.Getenv("PSN_REDIRECT_URI"),
	}
}

func (c *PSNClient) GetName() string {
	return "psn"
}

func (c *PSNClient) GetAuthURL(state string) string {
	return fmt.Sprintf("https://id.sonyentertainmentnetwork.com/signin/?client_id=%s&response_type=code&redirect_uri=%s&state=%s",
		c.clientID, c.redirectURI, state)
}

func (c *PSNClient) ExchangeCode(ctx context.Context, code string) (*StoreTokens, error) {
	return nil, fmt.Errorf("psn integration not fully implemented")
}

func (c *PSNClient) RefreshToken(ctx context.Context, refreshToken string) (*StoreTokens, error) {
	return nil, fmt.Errorf("psn integration not fully implemented")
}

func (c *PSNClient) GetUserInfo(ctx context.Context, accessToken string) (*StoreUserInfo, error) {
	return nil, fmt.Errorf("use OAuth callback for user info")
}

func (c *PSNClient) GetUserGames(ctx context.Context, accessToken string) ([]StoreGameInfo, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	// Get user's PSN library - requires accountId which should be stored during OAuth
	req, err := http.NewRequestWithContext(ctx, "GET", "https://m.np.playstation.com/api/gamelist/v2/users/me/titles", nil)
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
		Titles []struct {
			TitleID  string `json:"titleId"`
			Name     string `json:"name"`
			ImageURL string `json:"imageUrl"`
			Format   string `json:"format"`
		} `json:"titles"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	games := make([]StoreGameInfo, 0, len(result.Titles))
	for _, title := range result.Titles {
		// Filter to only PS4/PS5 games
		if title.Format == "PS4" || title.Format == "PS5" {
			games = append(games, StoreGameInfo{
				StoreGameID: title.TitleID,
				Name:        title.Name,
				CoverImage:  title.ImageURL,
			})
		}
	}

	return games, nil
}

func (c *PSNClient) SearchGames(ctx context.Context, query string, limit int) ([]StoreGameInfo, error) {
	return nil, fmt.Errorf("psn search requires user authentication")
}

func (c *PSNClient) GetGameDetails(ctx context.Context, storeGameID string) (*StoreGameInfo, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequestWithContext(ctx, "GET", "https://store.playstation.com/store/api/chihiro/00_09_000/titlecontainer/"+storeGameID, nil)
	if err != nil {
		return nil, err
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		ID     string `json:"id"`
		Name   string `json:"name"`
		Images []struct {
			Type string `json:"type"`
			URL  string `json:"url"`
		} `json:"images"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	game := &StoreGameInfo{
		StoreGameID: result.ID,
		Name:        result.Name,
	}

	for _, img := range result.Images {
		if img.Type == "MASTER" {
			game.CoverImage = img.URL
			break
		}
	}

	return game, nil
}

func (c *PSNClient) GetGamePrice(ctx context.Context, storeGameID string) (*StorePriceInfo, error) {
	return nil, fmt.Errorf("psn pricing requires regional store context")
}
