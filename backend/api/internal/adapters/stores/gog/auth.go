package gog

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"golang.org/x/time/rate"
)

const (
	// GOG public galaxy client credentials - these are not secret and are safe to hardcode
	// They are the public credentials used by GOG Galaxy client
	gogClientID     = "46899977096215655"
	gogClientSecret = "9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9"

	gogAuthURL    = "https://auth.gog.com"
	gogEmbedURL   = "https://embed.gog.com"
	gogUserAgent  = "gamedivers/1.0 (contact: you@example.com)"
)

// Client handles GOG authentication, API calls, and library management
type Client struct {
	clientID     string
	clientSecret string
	redirectURI  string
	httpClient   *http.Client
	limiter      *rate.Limiter
}

// OAuthTokenResponse represents the response from GOG token endpoint
type OAuthTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
	UserID       string `json:"user_id"`
	SessionID    string `json:"session_id"`
}

// UserInfo represents GOG user information
type UserInfo struct {
	UserID   string `json:"userId"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

// GameResponse represents a game from GOG library
type GameResponse struct {
	ID       int64  `json:"id"`
	Title    string `json:"title"`
	CoverURL string `json:"coverUrl,omitempty"`
	Image    string `json:"image,omitempty"`
}

// WishlistItem represents an item in GOG wishlist
type WishlistItem struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
	Image string `json:"image,omitempty"`
}

// NewClient creates a new GOG API client
func NewClient(redirectURI string) *Client {
	return &Client{
		clientID:     gogClientID,
		clientSecret: gogClientSecret,
		redirectURI:  redirectURI,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		limiter: rate.NewLimiter(rate.Every(time.Second), 5),
	}
}

func (c *Client) StoreID() string {
	return "gog"
}

// GetLoginURL generates the GOG OAuth login URL
func (c *Client) GetLoginURL(state string) string {
	params := url.Values{}
	params.Set("client_id", c.clientID)
	params.Set("redirect_uri", c.redirectURI)
	params.Set("response_type", "code")
	params.Set("state", state)
	params.Set("layout", "client2")

	return gogAuthURL + "/auth?" + params.Encode()
}

// ExchangeCode exchanges an authorization code for an access token
func (c *Client) ExchangeCode(ctx context.Context, code string) (*OAuthTokenResponse, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return nil, err
	}

	data := url.Values{}
	data.Set("client_id", c.clientID)
	data.Set("client_secret", c.clientSecret)
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", c.redirectURI)

	req, err := http.NewRequestWithContext(ctx, "GET", gogAuthURL+"/token?"+data.Encode(), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", gogUserAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("token exchange failed: %s - %s", resp.Status, string(body))
	}

	var tokenResp OAuthTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, err
	}

	return &tokenResp, nil
}

// GetUserInfo fetches the authenticated user's information
func (c *Client) GetUserInfo(ctx context.Context, accessToken string) (*UserInfo, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return nil, err
	}

	url := gogEmbedURL + "/userData.json"
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("User-Agent", gogUserAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("user info fetch failed: %s - %s", resp.Status, string(body))
	}

	var userdata map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&userdata); err != nil {
		return nil, err
	}

	// Extract user info from response
	username := "GOGUser"
	if user, ok := userdata["user"].(map[string]interface{}); ok {
		if name, ok := user["username"].(string); ok && name != "" {
			username = name
		}
	}

	// UserID comes from OAuth token response, typically in the token response
	userInfo := &UserInfo{
		Username: username,
	}

	return userInfo, nil
}

// GetLibrary fetches the authenticated user's GOG library
func (c *Client) GetLibrary(ctx context.Context, accessToken string) ([]GameResponse, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return nil, err
	}

	url := gogEmbedURL + "/user/data/games"
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("User-Agent", gogUserAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("library fetch failed: %s - %s", resp.Status, string(body))
	}

	var gameIDs []int64
	if err := json.NewDecoder(resp.Body).Decode(&gameIDs); err != nil {
		return nil, err
	}

	// Fetch game details for each game
	games := make([]GameResponse, 0, len(gameIDs))
	for _, gameID := range gameIDs {
		game, err := c.getGameDetails(ctx, gameID, accessToken)
		if err != nil {
			// Continue even if one game fails to fetch
			continue
		}
		if game != nil {
			games = append(games, *game)
		}
	}

	return games, nil
}

// GetWishlist fetches the authenticated user's GOG wishlist
func (c *Client) GetWishlist(ctx context.Context, accessToken string) ([]WishlistItem, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return nil, err
	}

	url := gogEmbedURL + "/user/wishlist.json"
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("User-Agent", gogUserAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("wishlist fetch failed: %s - %s", resp.Status, string(body))
	}

	var wishlist []WishlistItem
	if err := json.NewDecoder(resp.Body).Decode(&wishlist); err != nil {
		return nil, err
	}

	return wishlist, nil
}

// getGameDetails fetches detailed information about a specific game
func (c *Client) getGameDetails(ctx context.Context, gameID int64, accessToken string) (*GameResponse, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/account/gameDetails/%d.json", gogEmbedURL, gameID)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("User-Agent", gogUserAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil // Game not found, skip it
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("game details fetch failed: %s - %s", resp.Status, string(body))
	}

	var gameData map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&gameData); err != nil {
		return nil, err
	}

	// Extract game information
	game := &GameResponse{
		ID: gameID,
	}

	if title, ok := gameData["title"].(string); ok {
		game.Title = title
	}

	if image, ok := gameData["image"].(string); ok {
		game.Image = image
	}

	return game, nil
}
