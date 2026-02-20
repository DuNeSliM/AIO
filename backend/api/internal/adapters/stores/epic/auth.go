package epic

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

type Client struct {
	clientID     string
	clientSecret string
	redirectURI  string
	httpClient   *http.Client
	limiter      *rate.Limiter
}

type OAuthTokenResponse struct {
	AccessToken  string `json:"access_token"`
	ExpiresIn    int    `json:"expires_in"`
	ExpiresAt    string `json:"expires_at"`
	TokenType    string `json:"token_type"`
	RefreshToken string `json:"refresh_token"`
	AccountID    string `json:"account_id"`
}

type Game struct {
	AppName       string `json:"appName"`
	CatalogItemID string `json:"catalogItemId"`
	Namespace     string `json:"namespace"`
	Title         string `json:"title"`
}

type LibraryResponse struct {
	Records []Game `json:"records"`
}

func NewClient(clientID, clientSecret, redirectURI string) *Client {
	return &Client{
		clientID:     clientID,
		clientSecret: clientSecret,
		redirectURI:  redirectURI,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		limiter: rate.NewLimiter(rate.Every(time.Second), 5),
	}
}

func (c *Client) GetLoginURL(state string) string {
	params := url.Values{}
	params.Set("client_id", c.clientID)
	params.Set("redirect_uri", c.redirectURI)
	params.Set("response_type", "code")
	params.Set("scope", "basic_profile friends_list presence")
	params.Set("state", state)

	return "https://www.epicgames.com/id/authorize?" + params.Encode()
}

func (c *Client) ExchangeCode(ctx context.Context, code string) (*OAuthTokenResponse, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return nil, err
	}

	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", c.redirectURI)

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.epicgames.dev/epic/oauth/v1/token", nil)
	if err != nil {
		return nil, err
	}

	req.URL.RawQuery = data.Encode()
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(c.clientID, c.clientSecret)

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

func (c *Client) GetLibrary(ctx context.Context, accessToken string) ([]Game, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.epicgames.dev/epic/ecom/v1/platforms/EPIC/identities/me/ownership", nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("library fetch failed: %s - %s", resp.Status, string(body))
	}

	var libraryResp LibraryResponse
	if err := json.NewDecoder(resp.Body).Decode(&libraryResp); err != nil {
		return nil, err
	}

	return libraryResp.Records, nil
}

func (c *Client) GetAccountInfo(ctx context.Context, accessToken string) (map[string]interface{}, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.epicgames.dev/epic/id/v1/accounts/me", nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("account info fetch failed: %s - %s", resp.Status, string(body))
	}

	var accountInfo map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&accountInfo); err != nil {
		return nil, err
	}

	return accountInfo, nil
}
