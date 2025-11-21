// internal/stores/gog.go
package stores

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"
)

type GOGClient struct {
	clientID     string
	clientSecret string
	redirectURI  string
}

func NewGOGClient() StoreClient {
	return &GOGClient{
		clientID:     os.Getenv("GOG_CLIENT_ID"),
		clientSecret: os.Getenv("GOG_CLIENT_SECRET"),
		redirectURI:  os.Getenv("GOG_REDIRECT_URI"),
	}
}

func (c *GOGClient) GetName() string {
	return "gog"
}

func (c *GOGClient) GetAuthURL(state string) string {
	return fmt.Sprintf("https://auth.gog.com/auth?client_id=%s&redirect_uri=%s&response_type=code&state=%s",
		c.clientID, c.redirectURI, state)
}

func (c *GOGClient) ExchangeCode(ctx context.Context, code string) (*StoreTokens, error) {
	// TODO: Implement GOG OAuth token exchange
	return nil, fmt.Errorf("gog integration not fully implemented")
}

func (c *GOGClient) RefreshToken(ctx context.Context, refreshToken string) (*StoreTokens, error) {
	return nil, fmt.Errorf("gog integration not fully implemented")
}

func (c *GOGClient) GetUserInfo(ctx context.Context, accessToken string) (*StoreUserInfo, error) {
	// User info is fetched during OAuth - store client doesn't need this separately
	return nil, fmt.Errorf("use OAuth callback for user info")
}

func (c *GOGClient) GetUserGames(ctx context.Context, accessToken string) ([]StoreGameInfo, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequestWithContext(ctx, "GET", "https://embed.gog.com/user/data/games", nil)
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
		Owned []struct {
			ID     int    `json:"id"`
			Title  string `json:"title"`
			Image  string `json:"image"`
			URL    string `json:"url"`
			IsGame bool   `json:"isGame"`
		} `json:"owned"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	games := make([]StoreGameInfo, 0, len(result.Owned))
	for _, game := range result.Owned {
		if !game.IsGame {
			continue
		}

		games = append(games, StoreGameInfo{
			StoreGameID: strconv.Itoa(game.ID),
			Name:        game.Title,
			CoverImage:  game.Image,
			StoreURL:    game.URL,
		})
	}

	return games, nil
}

func (c *GOGClient) SearchGames(ctx context.Context, query string, limit int) ([]StoreGameInfo, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	searchURL := fmt.Sprintf("https://embed.gog.com/games/ajax/filtered?mediaType=game&search=%s&limit=%d",
		url.QueryEscape(query), limit)

	req, err := http.NewRequestWithContext(ctx, "GET", searchURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Products []struct {
			ID    int    `json:"id"`
			Title string `json:"title"`
			Image string `json:"image"`
			URL   string `json:"url"`
		} `json:"products"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	games := make([]StoreGameInfo, 0, len(result.Products))
	for _, product := range result.Products {
		games = append(games, StoreGameInfo{
			StoreGameID: strconv.Itoa(product.ID),
			Name:        product.Title,
			CoverImage:  product.Image,
			StoreURL:    product.URL,
		})
	}

	return games, nil
}

func (c *GOGClient) GetGameDetails(ctx context.Context, storeGameID string) (*StoreGameInfo, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	apiURL := fmt.Sprintf("https://api.gog.com/products/%s?expand=downloads,description", storeGameID)

	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	game := &StoreGameInfo{
		StoreGameID: storeGameID,
		Name:        result["title"].(string),
		StoreURL:    result["links"].(map[string]interface{})["product_card"].(string),
	}

	if images, ok := result["images"].(map[string]interface{}); ok {
		if logo, ok := images["logo"].(string); ok {
			game.CoverImage = "https:" + logo
		}
	}

	return game, nil
}

func (c *GOGClient) GetGamePrice(ctx context.Context, storeGameID string) (*StorePriceInfo, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	apiURL := fmt.Sprintf("https://api.gog.com/products/%s/prices", storeGameID)

	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	priceInfo := &StorePriceInfo{
		StoreGameID: storeGameID,
		IsAvailable: true,
	}

	if priceData, ok := result["_embedded"].(map[string]interface{}); ok {
		if finalPrice, ok := priceData["finalPrice"].(float64); ok {
			priceInfo.Price = finalPrice
		}
		if currency, ok := priceData["currency"].(string); ok {
			priceInfo.Currency = currency
		}
	}

	return priceInfo, nil
}
