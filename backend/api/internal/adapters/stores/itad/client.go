package itad

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"golang.org/x/time/rate"
)

// Client handles communication with the IsThereAnyDeal API
type Client struct {
	http    *http.Client
	limiter *rate.Limiter
	apiKey  string
	baseURL string
}

// New creates a new ITAD client with API key authentication
func New(apiKey string) *Client {
	return &Client{
		http:    &http.Client{Timeout: 15 * time.Second},
		limiter: rate.NewLimiter(1, 5), // 1 request per second, burst of 5
		apiKey:  apiKey,
		baseURL: "https://api.isthereanydeal.com",
	}
}

// SearchResponse represents the raw response from ITAD search endpoint
type SearchResponse struct {
	Data []SearchResult `json:"data"`
}

type SearchResult struct {
	ID     string `json:"id"`
	Slug   string `json:"slug"`
	Title  string `json:"title"`
	Type   string `json:"type"`
	Mature bool   `json:"mature"`
}

// GameInfoResponse represents the raw response from ITAD game info endpoint
type GameInfoResponse struct {
	Found []string            `json:"found"`
	Games map[string]GameInfo `json:"games"`
}

type GameInfo struct {
	ID           string      `json:"id"`
	Slug         string      `json:"slug"`
	Title        string      `json:"title"`
	Type         string      `json:"type"`
	Mature       bool        `json:"mature"`
	Assets       *GameAssets `json:"assets"`
	EarlyAccess  bool        `json:"earlyAccess"`
	Achievements bool        `json:"achievements"`
	TradingCards bool        `json:"tradingCards"`
	AppID        int         `json:"appid"`
	Tags         []string    `json:"tags"`
	Developers   []Developer `json:"developers"`
	Publishers   []Publisher `json:"publishers"`
	Reviews      []Review    `json:"reviews"`
	Stats        *GameStats  `json:"stats"`
	Players      *Players    `json:"players"`
	URLs         *GameURLs   `json:"urls"`
	ReleaseDate  string      `json:"releaseDate"`
}

type GameAssets struct {
	BoxArt    string `json:"boxart"`
	Banner145 string `json:"banner145"`
	Banner300 string `json:"banner300"`
	Banner400 string `json:"banner400"`
	Banner600 string `json:"banner600"`
}

type Developer struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type Publisher struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type Review struct {
	Score  int    `json:"score"`
	Source string `json:"source"`
	Count  int    `json:"count"`
	URL    string `json:"url"`
}

type GameStats struct {
	Rank       int `json:"rank"`
	Waitlisted int `json:"waitlisted"`
	Collected  int `json:"collected"`
}

type Players struct {
	Recent int `json:"recent"`
	Day    int `json:"day"`
	Week   int `json:"week"`
	Peak   int `json:"peak"`
}

type GameURLs struct {
	Game    string `json:"game"`
	History string `json:"history"`
	Info    string `json:"info"`
}

// PricesResponse represents the raw response from ITAD prices endpoint
type PricesResponse struct {
	Found []string              `json:"found"`
	Games map[string]GamePrices `json:"games"`
}

type GamePrices struct {
	ID    string `json:"id"`
	Deals []Deal `json:"deals"`
}

type Deal struct {
	Shop       Shop       `json:"shop"`
	Price      PriceInfo  `json:"price"`
	Regular    PriceInfo  `json:"regular"`
	Cut        int        `json:"cut"`
	Voucher    *string    `json:"voucher"`
	StoreLow   PriceInfo  `json:"storeLow"`
	HistoryLow PriceInfo  `json:"historyLow"`
	Flag       *string    `json:"flag"`
	DRM        []DRM      `json:"drm"`
	Platforms  []Platform `json:"platforms"`
	Timestamp  string     `json:"timestamp"`
	Expiry     *string    `json:"expiry"`
	URL        string     `json:"url"`
}

type Shop struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type PriceInfo struct {
	Amount    float64 `json:"amount"`
	AmountInt int     `json:"amountInt"`
	Currency  string  `json:"currency"`
}

type DRM struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type Platform struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// OverviewResponse represents the raw response from ITAD overview endpoint
type OverviewResponse struct {
	Prices  []OverviewPrice `json:"prices"`
	Bundles int             `json:"bundles"`
}

type OverviewPrice struct {
	ID      string        `json:"id"`
	Current *CurrentPrice `json:"current"`
	Lowest  *LowestPrice  `json:"lowest"`
	Bundled int           `json:"bundled"`
}

type CurrentPrice struct {
	Shop    Shop      `json:"shop"`
	Price   PriceInfo `json:"price"`
	Regular PriceInfo `json:"regular"`
	Cut     int       `json:"cut"`
	URL     string    `json:"url"`
}

type LowestPrice struct {
	Shop      Shop      `json:"shop"`
	Price     PriceInfo `json:"price"`
	Regular   PriceInfo `json:"regular"`
	Cut       int       `json:"cut"`
	Timestamp string    `json:"timestamp"`
}

// Search searches for games by title
func (c *Client) Search(ctx context.Context, query string, limit int) (json.RawMessage, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return nil, err
	}

	endpoint := fmt.Sprintf("%s/games/search/v1", c.baseURL)
	params := url.Values{}
	params.Set("title", query)
	params.Set("results", fmt.Sprintf("%d", limit))

	return c.doRequest(ctx, http.MethodGet, endpoint, params, nil)
}

// GetGameInfo gets detailed info about a game by its ITAD ID
func (c *Client) GetGameInfo(ctx context.Context, gameID string) (json.RawMessage, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return nil, err
	}

	endpoint := fmt.Sprintf("%s/games/info/v2", c.baseURL)
	params := url.Values{}
	params.Set("id", gameID)

	return c.doRequest(ctx, http.MethodGet, endpoint, params, nil)
}

// GetGamePrices gets current prices for a game across all stores
func (c *Client) GetGamePrices(ctx context.Context, gameID string, country string) (json.RawMessage, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return nil, err
	}

	endpoint := fmt.Sprintf("%s/games/prices/v3", c.baseURL)
	params := url.Values{}
	if country != "" {
		params.Set("country", country)
	}
	params.Set("vouchers", "true") // Allow vouchers in prices

	body, err := json.Marshal([]string{gameID})
	if err != nil {
		return nil, fmt.Errorf("marshal body: %w", err)
	}

	return c.doRequest(ctx, http.MethodPost, endpoint, params, body)
}

// GetOverview gets price overview for multiple games
func (c *Client) GetOverview(ctx context.Context, gameIDs []string, country string) (json.RawMessage, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return nil, err
	}

	endpoint := fmt.Sprintf("%s/games/overview/v2", c.baseURL)
	params := url.Values{}
	if country != "" {
		params.Set("country", country)
	}

	body, err := json.Marshal(gameIDs)
	if err != nil {
		return nil, fmt.Errorf("marshal body: %w", err)
	}

	return c.doRequest(ctx, http.MethodPost, endpoint, params, body)
}

// GetHistoricalLow gets the historical lowest price for a game
func (c *Client) GetHistoricalLow(ctx context.Context, gameID string, country string) (json.RawMessage, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return nil, err
	}

	endpoint := fmt.Sprintf("%s/games/historylow/v1", c.baseURL)
	params := url.Values{}
	if country != "" {
		params.Set("country", country)
	}

	body, err := json.Marshal([]string{gameID})
	if err != nil {
		return nil, fmt.Errorf("marshal body: %w", err)
	}

	return c.doRequest(ctx, http.MethodPost, endpoint, params, body)
}

// GetStores gets all available stores
func (c *Client) GetStores(ctx context.Context, country string) (json.RawMessage, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return nil, err
	}

	endpoint := fmt.Sprintf("%s/service/shops/v1", c.baseURL)
	params := url.Values{}
	if country != "" {
		params.Set("country", country)
	}

	return c.doRequest(ctx, http.MethodGet, endpoint, params, nil)
}

func (c *Client) doRequest(ctx context.Context, method string, endpoint string, params url.Values, body []byte) (json.RawMessage, error) {
	// Add API key to query params
	params.Set("key", c.apiKey)

	fullURL := fmt.Sprintf("%s?%s", endpoint, params.Encode())

	var bodyReader io.Reader
	if len(body) > 0 {
		bodyReader = bytes.NewReader(body)
	}

	req, err := http.NewRequestWithContext(ctx, method, fullURL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("itad request build failed")
	}

	req.Header.Set("Accept", "application/json")
	if method == http.MethodPost {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("User-Agent", "gamedivers/1.0")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("itad request failed")
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("itad response read failed")
	}

	if resp.StatusCode == 429 {
		return nil, fmt.Errorf("ITAD rate limited: %d", resp.StatusCode)
	}
	if resp.StatusCode == 401 {
		return nil, fmt.Errorf("ITAD unauthorized: check API key")
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("ITAD error: %d", resp.StatusCode)
	}

	return json.RawMessage(respBody), nil
}
