package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"
)

// GameMapper provides game ID mapping between different stores using IsThereAnyDeal API
type GameMapper struct {
	apiKey string
	client *http.Client
	cache  map[string]*GameMapping
	mu     sync.RWMutex
}

// GameMapping represents mapped IDs across stores
type GameMapping struct {
	SteamID   string `json:"steam,omitempty"`
	EpicID    string `json:"epic,omitempty"`
	GOGID     string `json:"gog,omitempty"`
	ITADPlain string `json:"itad_plain,omitempty"`
	Title     string `json:"title,omitempty"`
}

type itadSearchResponse struct {
	Data []struct {
		Plain string `json:"plain"`
		Title string `json:"title"`
		Buy   map[string]struct {
			ID string `json:"id"`
		} `json:"buy"`
	} `json:"data"`
}

// NewGameMapper creates a new game mapper
func NewGameMapper(apiKey string) *GameMapper {
	return &GameMapper{
		apiKey: apiKey,
		client: &http.Client{Timeout: 10 * time.Second},
		cache:  make(map[string]*GameMapping),
	}
}

// MapGameID attempts to map a game ID from one store to others using IsThereAnyDeal API
func (m *GameMapper) MapGameID(ctx context.Context, sourceStore, sourceID string) (*GameMapping, error) {
	if sourceStore == "" || sourceID == "" {
		return nil, errors.New("sourceStore and sourceID required")
	}

	cacheKey := fmt.Sprintf("%s:%s", sourceStore, sourceID)

	m.mu.RLock()
	if cached, ok := m.cache[cacheKey]; ok {
		m.mu.RUnlock()
		return cached, nil
	}
	m.mu.RUnlock()

	// Query ITAD for mapping
	mapping, err := m.queryITAD(ctx, sourceStore, sourceID)
	if err != nil {
		return nil, err
	}

	m.mu.Lock()
	m.cache[cacheKey] = mapping
	m.mu.Unlock()

	return mapping, nil
}

// queryITAD queries IsThereAnyDeal API for game ID mapping
func (m *GameMapper) queryITAD(ctx context.Context, store, gameID string) (*GameMapping, error) {
	if m.apiKey == "" {
		// Without API key, return partial mapping with just the source ID
		return &GameMapping{}, nil
	}

	// Build ITAD query URL
	searchURL := fmt.Sprintf("https://api.isthereanydeal.com/v2/search?q=%s&key=%s",
		url.QueryEscape(gameID), url.QueryEscape(m.apiKey))

	req, err := http.NewRequestWithContext(ctx, "GET", searchURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := m.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("itad api error: %d - %s", resp.StatusCode, string(body))
	}

	var result itadSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	mapping := &GameMapping{}

	// Extract store IDs from the first search result
	if len(result.Data) > 0 {
		game := result.Data[0]
		mapping.Title = game.Title
		mapping.ITADPlain = game.Plain

		if stores, ok := game.Buy["steam"]; ok {
			mapping.SteamID = stores.ID
		}
		if stores, ok := game.Buy["epic"]; ok {
			mapping.EpicID = stores.ID
		}
		if stores, ok := game.Buy["gog"]; ok {
			mapping.GOGID = stores.ID
		}
	}

	return mapping, nil
}

// ClearCache clears the mapping cache
func (m *GameMapper) ClearCache() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.cache = make(map[string]*GameMapping)
}
