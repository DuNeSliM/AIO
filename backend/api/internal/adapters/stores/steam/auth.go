package steam

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"time"

	"golang.org/x/time/rate"

	"gamedivers.de/api/internal/ports/store"
)

const (
	steamOpenIDURL = "https://steamcommunity.com/openid/login"
	steamAPIURL    = "https://api.steampowered.com"
)

// Client handles Steam authentication, API calls, and pricing
type Client struct {
	apiKey      string
	callbackURL string
	httpClient  *http.Client
	limiter     *rate.Limiter
}

// New creates a Steam client for pricing (no auth needed)
func New() *Client {
	return &Client{
		httpClient: &http.Client{Timeout: 12 * time.Second},
		limiter:    rate.NewLimiter(0.6, 5),
	}
}

// NewClient creates a new Steam API client with authentication
func NewClient(apiKey, callbackURL string) *Client {
	return &Client{
		apiKey:      apiKey,
		callbackURL: callbackURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		limiter: rate.NewLimiter(0.6, 5),
	}
}

func (c *Client) StoreID() string { return "steam" }

// --- Pricing API (existing) ---

type appDetailsResp map[string]struct {
	Success bool `json:"success"`
	Data    struct {
		Name          string `json:"name"`
		PriceOverview *struct {
			Currency        string `json:"currency"`
			Initial         int64  `json:"initial"`
			Final           int64  `json:"final"`
			DiscountPercent int    `json:"discount_percent"`
		} `json:"price_overview"`
	} `json:"data"`
}

func (c *Client) FetchDEPrice(ctx context.Context, externalGameID string) (*store.Price, string, error) {
	if c.limiter != nil {
		if err := c.limiter.Wait(ctx); err != nil {
			return nil, "", err
		}
	}

	url := fmt.Sprintf(
		"https://store.steampowered.com/api/appdetails?appids=%s&cc=de&filters=basic,price_overview",
		externalGameID,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", "gamedivers/1.0 (contact: you@example.com)")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 429 || resp.StatusCode >= 500 {
		return nil, "", fmt.Errorf("steam temporary error: %d", resp.StatusCode)
	}
	if resp.StatusCode != 200 {
		return nil, "", fmt.Errorf("steam unexpected status: %d", resp.StatusCode)
	}

	var parsed appDetailsResp
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, "", err
	}

	entry, ok := parsed[externalGameID]
	if !ok || !entry.Success {
		return nil, "", nil
	}

	name := entry.Data.Name
	if entry.Data.PriceOverview == nil {
		return nil, name, nil
	}

	po := entry.Data.PriceOverview
	return &store.Price{
		Currency:        po.Currency,
		InitialCents:    po.Initial,
		FinalCents:      po.Final,
		DiscountPercent: po.DiscountPercent,
	}, name, nil
}

// --- Authentication & Library API (new) ---

// GetLoginURL generates the Steam OpenID login URL
func (c *Client) GetLoginURL(returnURL string) string {
	params := url.Values{}
	params.Set("openid.ns", "http://specs.openid.net/auth/2.0")
	params.Set("openid.mode", "checkid_setup")
	params.Set("openid.return_to", returnURL)
	params.Set("openid.realm", returnURL)
	params.Set("openid.identity", "http://specs.openid.net/auth/2.0/identifier_select")
	params.Set("openid.claimed_id", "http://specs.openid.net/auth/2.0/identifier_select")

	return steamOpenIDURL + "?" + params.Encode()
}

// VerifyCallback verifies the Steam OpenID callback and extracts Steam ID
func (c *Client) VerifyCallback(values url.Values) (string, error) {
	// Change mode to check_authentication
	values.Set("openid.mode", "check_authentication")

	resp, err := c.httpClient.PostForm(steamOpenIDURL, values)
	if err != nil {
		return "", fmt.Errorf("failed to verify: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	// Check if authentication is valid
	if !regexp.MustCompile(`is_valid\s*:\s*true`).Match(body) {
		return "", fmt.Errorf("invalid authentication")
	}

	// Extract Steam ID from claimed_id
	claimedID := values.Get("openid.claimed_id")
	re := regexp.MustCompile(`https://steamcommunity\.com/openid/id/(\d+)`)
	matches := re.FindStringSubmatch(claimedID)
	if len(matches) < 2 {
		return "", fmt.Errorf("failed to extract steam id")
	}

	return matches[1], nil
}

// Game represents a Steam game
type Game struct {
	AppID            int    `json:"appid"`
	Name             string `json:"name"`
	PlaytimeForever  int    `json:"playtime_forever"`
	RtimeLastPlayed  int64  `json:"rtime_last_played"` // Unix timestamp of last played
	ImgIconURL       string `json:"img_icon_url"`
	ImgLogoURL       string `json:"img_logo_url"`
}

// PlayerSummary contains Steam player information
type PlayerSummary struct {
	SteamID      string `json:"steamid"`
	PersonaName  string `json:"personaname"`
	ProfileURL   string `json:"profileurl"`
	Avatar       string `json:"avatar"`
	AvatarMedium string `json:"avatarmedium"`
	AvatarFull   string `json:"avatarfull"`
}

// GetOwnedGames retrieves the user's game library
func (c *Client) GetOwnedGames(steamID string) ([]Game, error) {
	endpoint := fmt.Sprintf("%s/IPlayerService/GetOwnedGames/v1/", steamAPIURL)
	
	params := url.Values{}
	params.Set("key", c.apiKey)
	params.Set("steamid", steamID)
	params.Set("include_appinfo", "1")
	params.Set("include_played_free_games", "1")
	params.Set("format", "json")

	resp, err := c.httpClient.Get(endpoint + "?" + params.Encode())
	if err != nil {
		return nil, fmt.Errorf("failed to fetch games: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("steam api error: %d", resp.StatusCode)
	}

	var result struct {
		Response struct {
			GameCount int    `json:"game_count"`
			Games     []Game `json:"games"`
		} `json:"response"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return result.Response.Games, nil
}

// GetPlayerSummaries retrieves player profile information
func (c *Client) GetPlayerSummaries(steamIDs []string) ([]PlayerSummary, error) {
	endpoint := fmt.Sprintf("%s/ISteamUser/GetPlayerSummaries/v2/", steamAPIURL)
	
	params := url.Values{}
	params.Set("key", c.apiKey)
	params.Set("steamids", steamIDs[0]) // For simplicity, just get first one
	params.Set("format", "json")

	resp, err := c.httpClient.Get(endpoint + "?" + params.Encode())
	if err != nil {
		return nil, fmt.Errorf("failed to fetch player: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Response struct {
			Players []PlayerSummary `json:"players"`
		} `json:"response"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return result.Response.Players, nil
}
