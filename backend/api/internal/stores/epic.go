// internal/stores/epic.go
package stores

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type EpicClient struct {
	clientID     string
	clientSecret string
	redirectURI  string
}

func NewEpicClient() StoreClient {
	return &EpicClient{
		clientID:     os.Getenv("EPIC_CLIENT_ID"),
		clientSecret: os.Getenv("EPIC_CLIENT_SECRET"),
		redirectURI:  os.Getenv("EPIC_REDIRECT_URI"),
	}
}

func (c *EpicClient) GetName() string {
	return "epic"
}

func (c *EpicClient) GetAuthURL(state string) string {
	return fmt.Sprintf("https://www.epicgames.com/id/authorize?client_id=%s&response_type=code&scope=basic_profile&redirect_uri=%s&state=%s",
		c.clientID, c.redirectURI, state)
}

func (c *EpicClient) ExchangeCode(ctx context.Context, code string) (*StoreTokens, error) {
	// TODO: Implement Epic Games OAuth token exchange
	// Epic uses standard OAuth2 flow
	return nil, fmt.Errorf("epic games integration not fully implemented")
}

func (c *EpicClient) RefreshToken(ctx context.Context, refreshToken string) (*StoreTokens, error) {
	// TODO: Implement token refresh
	return nil, fmt.Errorf("epic games integration not fully implemented")
}

func (c *EpicClient) GetUserInfo(ctx context.Context, accessToken string) (*StoreUserInfo, error) {
	return nil, fmt.Errorf("use OAuth callback for user info")
}

func (c *EpicClient) GetUserGames(ctx context.Context, accessToken string) ([]StoreGameInfo, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	// Get user's account ID first
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.epicgames.dev/epic/oauth/v1/userInfo", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var userInfo struct {
		AccountID string `json:"account_id"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, err
	}

	// Get user's library
	req, err = http.NewRequestWithContext(ctx, "GET",
		fmt.Sprintf("https://launcher-public-service-prod06.ol.epicgames.com/launcher/api/public/assets/v2/platform/Windows/namespace/epic/catalogItem?accountId=%s", userInfo.AccountID), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err = httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var assets []struct {
		AssetID   string `json:"assetId"`
		AppName   string `json:"appName"`
		LabelName string `json:"labelName"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&assets); err != nil {
		return nil, err
	}

	games := make([]StoreGameInfo, 0, len(assets))
	for _, asset := range assets {
		games = append(games, StoreGameInfo{
			StoreGameID: asset.AssetID,
			Name:        asset.LabelName,
		})
	}

	return games, nil
}

func (c *EpicClient) SearchGames(ctx context.Context, query string, limit int) ([]StoreGameInfo, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequestWithContext(ctx, "GET",
		fmt.Sprintf("https://store-content.ak.epicgames.com/api/en-US/content/search?q=%s&count=%d", query, limit), nil)
	if err != nil {
		return nil, err
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Elements []struct {
			ID        string `json:"id"`
			Title     string `json:"title"`
			KeyImages []struct {
				Type string `json:"type"`
				URL  string `json:"url"`
			} `json:"keyImages"`
		} `json:"elements"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	games := make([]StoreGameInfo, 0, len(result.Elements))
	for _, element := range result.Elements {
		game := StoreGameInfo{
			StoreGameID: element.ID,
			Name:        element.Title,
		}

		for _, img := range element.KeyImages {
			if img.Type == "DieselStoreFrontWide" {
				game.CoverImage = img.URL
				break
			}
		}

		games = append(games, game)
	}

	return games, nil
}

func (c *EpicClient) GetGameDetails(ctx context.Context, storeGameID string) (*StoreGameInfo, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequestWithContext(ctx, "GET",
		fmt.Sprintf("https://store-content.ak.epicgames.com/api/en-US/content/products/%s", storeGameID), nil)
	if err != nil {
		return nil, err
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		ID        string `json:"id"`
		Title     string `json:"title"`
		KeyImages []struct {
			Type string `json:"type"`
			URL  string `json:"url"`
		} `json:"keyImages"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	game := &StoreGameInfo{
		StoreGameID: result.ID,
		Name:        result.Title,
	}

	for _, img := range result.KeyImages {
		if img.Type == "DieselStoreFrontWide" {
			game.CoverImage = img.URL
			break
		}
	}

	return game, nil
}

func (c *EpicClient) GetGamePrice(ctx context.Context, storeGameID string) (*StorePriceInfo, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequestWithContext(ctx, "GET",
		fmt.Sprintf("https://store-content.ak.epicgames.com/api/en-US/content/products/%s", storeGameID), nil)
	if err != nil {
		return nil, err
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Price struct {
			TotalPrice struct {
				OriginalPrice int    `json:"originalPrice"`
				Discount      int    `json:"discount"`
				FinalPrice    int    `json:"fmtPrice"`
				CurrencyCode  string `json:"currencyCode"`
			} `json:"totalPrice"`
		} `json:"price"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &StorePriceInfo{
		StoreGameID: storeGameID,
		Price:       float64(result.Price.TotalPrice.FinalPrice) / 100,
		Currency:    result.Price.TotalPrice.CurrencyCode,
		IsAvailable: true,
	}, nil
}
