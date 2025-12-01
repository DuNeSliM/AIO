// internal/stores/epic.go
package stores

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
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
	// Use Epic Developer Portal's standard OAuth authorize endpoint
	return fmt.Sprintf("https://www.epicgames.com/id/authorize?client_id=%s&response_type=code&redirect_uri=%s&state=%s",
		c.clientID, url.QueryEscape(c.redirectURI), state)
}

func (c *EpicClient) ExchangeCode(ctx context.Context, code string) (*StoreTokens, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	// Epic requires Basic Auth with base64 encoded client_id:client_secret (Playnite approach)
	auth := base64.StdEncoding.EncodeToString([]byte(c.clientID + ":" + c.clientSecret))

	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)

	// Use Epic Developer Portal OAuth endpoint
	req, err := http.NewRequestWithContext(ctx, "POST",
		"https://api.epicgames.dev/epic/oauth/v2/token",
		strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create token request: %w", err)
	}

	req.Header.Set("Authorization", "Basic "+auth)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange token: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		log.Printf("Epic token exchange failed: %s", string(body))
		return nil, fmt.Errorf("token exchange failed with status %d: %s", resp.StatusCode, string(body))
	}

	var tokenResp struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
		AccountID    string `json:"account_id"`
		TokenType    string `json:"token_type"`
	}

	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	expiresAt := time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)

	return &StoreTokens{
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: tokenResp.RefreshToken,
		ExpiresAt:    expiresAt,
	}, nil
}

func (c *EpicClient) RefreshToken(ctx context.Context, refreshToken string) (*StoreTokens, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	// Epic requires Basic Auth with base64 encoded client_id:client_secret
	auth := base64.StdEncoding.EncodeToString([]byte(c.clientID + ":" + c.clientSecret))

	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("refresh_token", refreshToken)

	req, err := http.NewRequestWithContext(ctx, "POST",
		"https://api.epicgames.dev/epic/oauth/v2/token",
		strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create refresh request: %w", err)
	}

	req.Header.Set("Authorization", "Basic "+auth)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to refresh token: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		log.Printf("Epic token refresh failed: %s", string(body))
		return nil, fmt.Errorf("token refresh failed with status %d: %s", resp.StatusCode, string(body))
	}

	var tokenResp struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
		AccountID    string `json:"account_id"`
	}

	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode refresh response: %w", err)
	}

	expiresAt := time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)

	return &StoreTokens{
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: tokenResp.RefreshToken,
		ExpiresAt:    expiresAt,
	}, nil
}

func (c *EpicClient) GetUserInfo(ctx context.Context, accessToken string) (*StoreUserInfo, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.epicgames.dev/epic/oauth/v2/userInfo", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create userInfo request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("epic userInfo failed with status %d", resp.StatusCode)
	}

	var userInfo struct {
		AccountID     string `json:"account_id"`
		DisplayName   string `json:"displayName"`
		PreferredLang string `json:"preferredLanguage"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	return &StoreUserInfo{
		StoreUserID: userInfo.AccountID,
		DisplayName: userInfo.DisplayName,
	}, nil
}

func (c *EpicClient) GetUserGames(ctx context.Context, accessToken string) ([]StoreGameInfo, error) {
	// Note: Epic's order history API requires browser session cookies, not OAuth tokens
	// The OAuth token from Developer Portal doesn't have access to payment/order endpoints
	// Users will need to add Epic games manually or we need a different approach

	games, err := c.fetchOwnedGames(ctx, accessToken)
	if err != nil {
		return []StoreGameInfo{}, nil
	}

	return games, nil
}

// fetchOwnedGames fetches all owned games from Epic's order history API
// This uses the same endpoint that the Epic Games website uses
func (c *EpicClient) fetchOwnedGames(ctx context.Context, accessToken string) ([]StoreGameInfo, error) {
	httpClient := &http.Client{
		Timeout: 60 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse // Don't follow redirects to login page
		},
	}

	allGames := make(map[string]StoreGameInfo) // Use map to deduplicate by name
	nextPageToken := ""
	pageCount := 0

	log.Printf("Fetching Epic order history to get all owned games...")

	for {
		pageCount++

		// Build the order history URL with pagination (same as the working JS code)
		orderURL := fmt.Sprintf(
			"https://www.epicgames.com/account/v2/payment/ajaxGetOrderHistory?sortDir=DESC&sortBy=DATE&nextPageToken=%s&locale=en-US",
			url.QueryEscape(nextPageToken),
		)

		req, err := http.NewRequestWithContext(ctx, "GET", orderURL, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create order history request: %w", err)
		}

		// Try to mimic browser request headers more closely
		req.Header.Set("Accept", "application/json, text/plain, */*")
		req.Header.Set("Accept-Language", "en-US,en;q=0.9")
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
		req.Header.Set("Referer", "https://www.epicgames.com/account/payment")
		req.Header.Set("Origin", "https://www.epicgames.com")
		req.Header.Set("X-Requested-With", "XMLHttpRequest")

		// Try both Authorization header and as a cookie
		req.Header.Set("Authorization", "Bearer "+accessToken)
		req.AddCookie(&http.Cookie{
			Name:  "EPIC_BEARER_TOKEN",
			Value: accessToken,
		})

		resp, err := httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch order history: %w", err)
		}

		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode == 302 || resp.StatusCode == 301 {
			return nil, fmt.Errorf("order history API redirected (needs browser session)")
		}

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("order history API returned %d", resp.StatusCode)
		}

		// Check if response is HTML (login page) instead of JSON
		if strings.Contains(string(body), "<!DOCTYPE") || strings.Contains(string(body), "<html") {
			return nil, fmt.Errorf("order history API requires browser session (not available via OAuth)")
		}

		var orderResp struct {
			Orders []struct {
				Items []struct {
					Description string `json:"description"`
				} `json:"items"`
			} `json:"orders"`
			NextPageToken string `json:"nextPageToken"`
		}

		if err := json.Unmarshal(body, &orderResp); err != nil {
			return nil, fmt.Errorf("failed to decode order history: %w", err)
		}

		// Extract game names from orders
		gamesInPage := 0
		for _, order := range orderResp.Orders {
			for _, item := range order.Items {
				if item.Description != "" {
					// Deduplicate by name
					if _, exists := allGames[item.Description]; !exists {
						allGames[item.Description] = StoreGameInfo{
							StoreGameID: item.Description, // We'll use name as ID for now
							Name:        item.Description,
						}
						gamesInPage++
					}
				}
			}
		}

		// Check if there are more pages
		if orderResp.NextPageToken == "" {
			break
		}

		nextPageToken = orderResp.NextPageToken

		// Safety limit to prevent infinite loops
		if pageCount > 100 {
			break
		}
	}

	// Convert map to slice
	games := make([]StoreGameInfo, 0, len(allGames))
	for _, game := range allGames {
		games = append(games, game)
	}

	return games, nil
}

func (c *EpicClient) getEpicGameDetails(ctx context.Context, namespace, catalogItemID string) (*StoreGameInfo, error) {
	httpClient := &http.Client{Timeout: 10 * time.Second}

	req, err := http.NewRequestWithContext(ctx, "GET",
		fmt.Sprintf("https://catalog-public-service-prod06.ol.epicgames.com/catalog/api/shared/namespace/%s/bulk/items?id=%s&includeDLCDetails=false&includeMainGameDetails=false&country=US&locale=en-US", namespace, catalogItemID), nil)
	if err != nil {
		return nil, err
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("catalog request failed with status %d", resp.StatusCode)
	}

	var catalogResp map[string]struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Developer   string `json:"developer"`
		KeyImages   []struct {
			Type string `json:"type"`
			URL  string `json:"url"`
		} `json:"keyImages"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&catalogResp); err != nil {
		return nil, err
	}

	// Get the first (and usually only) item from the response
	for itemID, details := range catalogResp {
		game := &StoreGameInfo{
			StoreGameID: itemID,
			Name:        details.Title,
			Description: details.Description,
			Developer:   details.Developer,
		}

		// Extract cover image
		for _, img := range details.KeyImages {
			if img.Type == "DieselStoreFrontWide" || img.Type == "OfferImageWide" {
				game.CoverImage = img.URL
				break
			}
		}

		return game, nil
	}

	return nil, fmt.Errorf("no game details found")
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
