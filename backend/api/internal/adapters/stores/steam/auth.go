package steam

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
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
	appListOnce sync.Once
	appListMu   sync.RWMutex
	appList     map[int]string
	appListErr  error
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
			Timeout: 40 * time.Second,
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
	AppID           int    `json:"appid"`
	Name            string `json:"name"`
	PlaytimeForever int    `json:"playtime_forever"`
	RtimeLastPlayed int64  `json:"rtime_last_played"` // Unix timestamp of last played
	ImgIconURL      string `json:"img_icon_url"`
	ImgLogoURL      string `json:"img_logo_url"`
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

// WishlistEntry represents a Steam wishlist entry returned by the store endpoint.
type WishlistEntry struct {
	Name    string `json:"name"`
	Capsule string `json:"capsule"`
	Added   int64  `json:"added"`
}

// WishlistItem represents a normalized wishlist item.
type WishlistItem struct {
	AppID   int    `json:"appId"`
	Name    string `json:"name"`
	Capsule string `json:"capsule,omitempty"`
	Added   int64  `json:"added"`
}

var ErrSteamWishlistPrivate = errors.New("steam_wishlist_private")

// GetWishlist retrieves the user's Steam wishlist via the public store endpoint.
func (c *Client) GetWishlist(steamID string) ([]WishlistItem, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("steam api key missing")
	}

	endpoint := "https://api.steampowered.com/IWishlistService/GetWishlist/v1"
	params := url.Values{}
	params.Set("key", c.apiKey)
	params.Set("steamid", steamID)

	req, err := http.NewRequest(http.MethodGet, endpoint+"?"+params.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build wishlist request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "gamedivers/1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch wishlist")
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, ErrSteamWishlistPrivate
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read wishlist response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("wishlist api error: %d", resp.StatusCode)
	}

	var raw struct {
		Response struct {
			Items []struct {
				AppID     int   `json:"appid"`
				Priority  int   `json:"priority"`
				DateAdded int64 `json:"date_added"`
			} `json:"items"`
		} `json:"response"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("failed to decode wishlist: %w", err)
	}

	appIDs := make([]int, 0, len(raw.Response.Items))
	for _, entry := range raw.Response.Items {
		appIDs = append(appIDs, entry.AppID)
	}

	nameByID := c.getAppNamesBatch(appIDs, 50)
	items := make([]WishlistItem, 0, len(raw.Response.Items))
	for _, entry := range raw.Response.Items {
		name := nameByID[entry.AppID]
		if name == "" {
			name = "App " + strconv.Itoa(entry.AppID)
		}
		items = append(items, WishlistItem{
			AppID: entry.AppID,
			Name:  name,
			Added: entry.DateAdded,
		})
	}

	sort.Slice(items, func(i, j int) bool { return items[i].Added > items[j].Added })
	return items, nil
}

func (c *Client) getAppNamesBatch(appIDs []int, chunkSize int) map[int]string {
	out := make(map[int]string, len(appIDs))
	if len(appIDs) == 0 {
		return out
	}
	if chunkSize <= 0 {
		chunkSize = 50
	}

	for i := 0; i < len(appIDs); i += chunkSize {
		end := i + chunkSize
		if end > len(appIDs) {
			end = len(appIDs)
		}
		chunk := appIDs[i:end]
		names, err := c.fetchAppDetailsChunk(chunk)
		if err != nil {
			continue
		}
		for id, name := range names {
			if name != "" {
				out[id] = name
			}
		}
	}

	missing := make([]int, 0)
	for _, id := range appIDs {
		if out[id] == "" {
			missing = append(missing, id)
		}
	}
	if len(missing) > 0 {
		if fromList, err := c.getAppNamesFromList(missing); err == nil {
			for id, name := range fromList {
				if name != "" && out[id] == "" {
					out[id] = name
				}
			}
		}
	}

	return out
}

func (c *Client) fetchAppDetailsChunk(appIDs []int) (map[int]string, error) {
	if c.limiter != nil {
		if err := c.limiter.Wait(context.Background()); err != nil {
			return nil, err
		}
	}

	var ids []string
	for _, id := range appIDs {
		ids = append(ids, strconv.Itoa(id))
	}
	endpoint := fmt.Sprintf("https://store.steampowered.com/api/appdetails?appids=%s&filters=basic", strings.Join(ids, ","))
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "gamedivers/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("appdetails error: %d", resp.StatusCode)
	}

	var parsed map[string]struct {
		Success bool `json:"success"`
		Data    struct {
			Name string `json:"name"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}

	out := make(map[int]string, len(parsed))
	for key, entry := range parsed {
		if !entry.Success || entry.Data.Name == "" {
			continue
		}
		id, err := strconv.Atoi(key)
		if err != nil {
			continue
		}
		out[id] = entry.Data.Name
	}
	return out, nil
}

func (c *Client) getAppNamesFromList(appIDs []int) (map[int]string, error) {
	c.appListOnce.Do(func() {
		c.appList, c.appListErr = c.fetchFullAppList()
	})
	if c.appListErr != nil {
		return nil, c.appListErr
	}

	c.appListMu.RLock()
	defer c.appListMu.RUnlock()

	out := make(map[int]string, len(appIDs))
	for _, id := range appIDs {
		if name, ok := c.appList[id]; ok {
			out[id] = name
		}
	}
	return out, nil
}

func (c *Client) fetchFullAppList() (map[int]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	endpoint := "https://api.steampowered.com/ISteamApps/GetAppList/v2"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "gamedivers/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("applist error: %d", resp.StatusCode)
	}

	var parsed struct {
		AppList struct {
			Apps []struct {
				AppID int    `json:"appid"`
				Name  string `json:"name"`
			} `json:"apps"`
		} `json:"applist"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}

	out := make(map[int]string, len(parsed.AppList.Apps))
	for _, app := range parsed.AppList.Apps {
		if app.AppID == 0 || app.Name == "" {
			continue
		}
		out[app.AppID] = app.Name
	}
	return out, nil
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

	req, err := http.NewRequest(http.MethodGet, endpoint+"?"+params.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build games request")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch games")
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

	req, err := http.NewRequest(http.MethodGet, endpoint+"?"+params.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build player request")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch player")
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
