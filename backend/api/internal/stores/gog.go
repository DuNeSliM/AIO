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
	// GOG uses a public client_id for Galaxy - community tools use this same approach
	// client_id "46899977096215655" is the GOG Galaxy client ID used by community tools
	publicClientID := "46899977096215655"
	return fmt.Sprintf("https://auth.gog.com/auth?client_id=%s&redirect_uri=%s&response_type=code&state=%s&layout=client2",
		publicClientID, url.QueryEscape(c.redirectURI), state)
}

func (c *GOGClient) ExchangeCode(ctx context.Context, code string) (*StoreTokens, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	// GOG Galaxy public client credentials (used by community tools)
	publicClientID := "46899977096215655"
	publicClientSecret := "9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9"

	data := url.Values{}
	data.Set("client_id", publicClientID)
	data.Set("client_secret", publicClientSecret)
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", c.redirectURI)

	resp, err := httpClient.PostForm("https://auth.gog.com/token", data)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token exchange failed with status %d", resp.StatusCode)
	}

	var tokenResp struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
		TokenType    string `json:"token_type"`
		UserID       string `json:"user_id"`
		SessionID    string `json:"session_id"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	expiresAt := time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)

	return &StoreTokens{
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: tokenResp.RefreshToken,
		ExpiresAt:    expiresAt,
	}, nil
}

func (c *GOGClient) RefreshToken(ctx context.Context, refreshToken string) (*StoreTokens, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	// GOG Galaxy public client credentials
	publicClientID := "46899977096215655"
	publicClientSecret := "9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9"

	data := url.Values{}
	data.Set("client_id", publicClientID)
	data.Set("client_secret", publicClientSecret)
	data.Set("grant_type", "refresh_token")
	data.Set("refresh_token", refreshToken)

	resp, err := httpClient.PostForm("https://auth.gog.com/token", data)
	if err != nil {
		return nil, fmt.Errorf("failed to refresh token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token refresh failed with status %d", resp.StatusCode)
	}

	var tokenResp struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
		TokenType    string `json:"token_type"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode refresh response: %w", err)
	}

	expiresAt := time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)

	return &StoreTokens{
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: tokenResp.RefreshToken,
		ExpiresAt:    expiresAt,
	}, nil
}

func (c *GOGClient) GetUserInfo(ctx context.Context, accessToken string) (*StoreUserInfo, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	// Get user data from GOG's embed API
	req, err := http.NewRequestWithContext(ctx, "GET", "https://embed.gog.com/userData.json", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create user info request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("user info request failed with status %d", resp.StatusCode)
	}

	var userInfo struct {
		UserID   string `json:"userId"`
		Username string `json:"username"`
		Email    string `json:"email"`
		Avatar   string `json:"avatar"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	return &StoreUserInfo{
		StoreUserID: userInfo.UserID,
		DisplayName: userInfo.Username,
		AvatarURL:   userInfo.Avatar,
	}, nil
}

func (c *GOGClient) GetUserGames(ctx context.Context, accessToken string) ([]StoreGameInfo, error) {
	httpClient := &http.Client{Timeout: 60 * time.Second}

	allGames := []StoreGameInfo{}
	page := 1

	// GOG uses pagination - fetch all pages
	for {
		// Use the getFilteredProducts endpoint that Galaxy uses
		apiURL := fmt.Sprintf("https://embed.gog.com/account/getFilteredProducts?mediaType=1&page=%d", page)

		req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}
		req.Header.Set("Authorization", "Bearer "+accessToken)

		resp, err := httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch games: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("GOG API returned status %d", resp.StatusCode)
		}

		var result struct {
			Products []struct {
				ID    int    `json:"id"`
				Title string `json:"title"`
				Image string `json:"image"`
				URL   string `json:"url"`
			} `json:"products"`
			TotalPages int `json:"totalPages"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			return nil, fmt.Errorf("failed to decode response: %w", err)
		}

		// Add games from this page
		for _, game := range result.Products {
			allGames = append(allGames, StoreGameInfo{
				StoreGameID: strconv.Itoa(game.ID),
				Name:        game.Title,
				CoverImage:  game.Image,
				StoreURL:    game.URL,
			})
		}

		// Check if there are more pages
		if page >= result.TotalPages || len(result.Products) == 0 {
			break
		}

		page++

		// Safety limit
		if page > 100 {
			break
		}
	}

	return allGames, nil
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
