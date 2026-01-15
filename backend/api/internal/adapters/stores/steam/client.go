package steam

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"golang.org/x/time/rate"

	"gamedivers.de/api/internal/ports/store"
)

type Client struct {
	http    *http.Client
	limiter *rate.Limiter
}

func New() *Client {
	// Conservative rate limiting
	return &Client{
		http:    &http.Client{Timeout: 12 * time.Second},
		limiter: rate.NewLimiter(0.6, 5),
	}
}

func (c *Client) StoreID() string { return "steam" }

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
	if err := c.limiter.Wait(ctx); err != nil {
		return nil, "", err
	}

	url := fmt.Sprintf(
		"https://store.steampowered.com/api/appdetails?appids=%s&cc=de&filters=basic,price_overview",
		externalGameID,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", "game-price-tracker/1.0 (contact: you@example.com)")

	resp, err := c.http.Do(req)
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
