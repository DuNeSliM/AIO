// internal/stores/steam.go
package stores

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"
)

type SteamClient struct {
	apiKey       string
	clientID     string
	clientSecret string
	redirectURI  string
	httpClient   *http.Client
}

func NewSteamClient() StoreClient {
	return &SteamClient{
		apiKey:       os.Getenv("STEAM_API_KEY"),
		clientID:     os.Getenv("STEAM_CLIENT_ID"),
		clientSecret: os.Getenv("STEAM_CLIENT_SECRET"),
		redirectURI:  os.Getenv("STEAM_REDIRECT_URI"),
		httpClient:   &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *SteamClient) GetName() string {
	return "steam"
}

func (c *SteamClient) GetAuthURL(state string) string {
	// Steam uses OpenID, not OAuth2
	params := url.Values{}
	params.Set("openid.ns", "http://specs.openid.net/auth/2.0")
	params.Set("openid.mode", "checkid_setup")
	params.Set("openid.return_to", c.redirectURI+"?state="+state)
	params.Set("openid.realm", c.redirectURI)
	params.Set("openid.identity", "http://specs.openid.net/auth/2.0/identifier_select")
	params.Set("openid.claimed_id", "http://specs.openid.net/auth/2.0/identifier_select")

	return "https://steamcommunity.com/openid/login?" + params.Encode()
}

func (c *SteamClient) ExchangeCode(ctx context.Context, code string) (*StoreTokens, error) {
	// Steam OpenID doesn't use traditional OAuth tokens
	// The "code" here is actually the claimed_id from OpenID response
	// Extract Steam ID from the claimed_id URL

	return &StoreTokens{
		AccessToken:  code,                                 // Store the Steam ID as the access token
		RefreshToken: "",                                   // Steam doesn't use refresh tokens
		ExpiresAt:    time.Now().Add(365 * 24 * time.Hour), // Long-lived
	}, nil
}

func (c *SteamClient) RefreshToken(ctx context.Context, refreshToken string) (*StoreTokens, error) {
	return nil, fmt.Errorf("steam does not support token refresh")
}

func (c *SteamClient) GetUserInfo(ctx context.Context, accessToken string) (*StoreUserInfo, error) {
	steamID := accessToken

	url := fmt.Sprintf("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=%s&steamids=%s",
		c.apiKey, steamID)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Response struct {
			Players []struct {
				SteamID     string `json:"steamid"`
				PersonaName string `json:"personaname"`
				AvatarFull  string `json:"avatarfull"`
			} `json:"players"`
		} `json:"response"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if len(result.Response.Players) == 0 {
		return nil, fmt.Errorf("user not found")
	}

	player := result.Response.Players[0]
	return &StoreUserInfo{
		StoreUserID: player.SteamID,
		DisplayName: player.PersonaName,
		AvatarURL:   player.AvatarFull,
	}, nil
}

func (c *SteamClient) GetUserGames(ctx context.Context, accessToken string) ([]StoreGameInfo, error) {
	// Steam requires an API key to fetch games
	if c.apiKey == "" {
		return []StoreGameInfo{}, nil // Return empty list instead of error if no API key
	}

	steamID := accessToken

	url := fmt.Sprintf("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=%s&steamid=%s&include_appinfo=1&include_played_free_games=1",
		c.apiKey, steamID)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Response struct {
			Games []struct {
				AppID                  int    `json:"appid"`
				Name                   string `json:"name"`
				PlaytimeForever        int    `json:"playtime_forever"`
				ImgIconURL             string `json:"img_icon_url"`
				ImgLogoURL             string `json:"img_logo_url"`
				PlaytimeWindowsForever int    `json:"playtime_windows_forever"`
				PlaytimeMacForever     int    `json:"playtime_mac_forever"`
				PlaytimeLinuxForever   int    `json:"playtime_linux_forever"`
				RtimeLastPlayed        int64  `json:"rtime_last_played"`
			} `json:"games"`
		} `json:"response"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	games := make([]StoreGameInfo, 0, len(result.Response.Games))
	for _, game := range result.Response.Games {
		storeGame := StoreGameInfo{
			StoreGameID: strconv.Itoa(game.AppID),
			Name:        game.Name,
			StoreURL:    fmt.Sprintf("https://store.steampowered.com/app/%d", game.AppID),
			PlayTime:    game.PlaytimeForever,
		}

		if game.ImgIconURL != "" {
			storeGame.Icon = fmt.Sprintf("https://media.steampowered.com/steamcommunity/public/images/apps/%d/%s.jpg",
				game.AppID, game.ImgIconURL)
		}

		if game.RtimeLastPlayed > 0 {
			lastPlayed := time.Unix(game.RtimeLastPlayed, 0)
			storeGame.LastPlayed = &lastPlayed
		}

		games = append(games, storeGame)
	}

	return games, nil
}

func (c *SteamClient) SearchGames(ctx context.Context, query string, limit int) ([]StoreGameInfo, error) {
	// Steam doesn't have a direct search API, we'll use the store search
	// This is a simplified implementation
	searchURL := fmt.Sprintf("https://store.steampowered.com/api/storesearch/?term=%s&cc=us&l=english",
		url.QueryEscape(query))

	req, err := http.NewRequestWithContext(ctx, "GET", searchURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Items []struct {
			ID    int    `json:"id"`
			Name  string `json:"name"`
			Tiny  string `json:"tiny_image"`
			Small string `json:"small_image"`
		} `json:"items"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	games := make([]StoreGameInfo, 0, len(result.Items))
	for i, item := range result.Items {
		if limit > 0 && i >= limit {
			break
		}

		games = append(games, StoreGameInfo{
			StoreGameID: strconv.Itoa(item.ID),
			Name:        item.Name,
			Icon:        item.Tiny,
			CoverImage:  item.Small,
			StoreURL:    fmt.Sprintf("https://store.steampowered.com/app/%d", item.ID),
		})
	}

	return games, nil
}

func (c *SteamClient) GetGameDetails(ctx context.Context, storeGameID string) (*StoreGameInfo, error) {
	url := fmt.Sprintf("https://store.steampowered.com/api/appdetails?appids=%s&cc=us&l=english", storeGameID)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result map[string]struct {
		Success bool `json:"success"`
		Data    struct {
			Type         string   `json:"type"`
			Name         string   `json:"name"`
			SteamAppID   int      `json:"steam_appid"`
			Developers   []string `json:"developers"`
			Publishers   []string `json:"publishers"`
			ShortDesc    string   `json:"short_description"`
			DetailedDesc string   `json:"detailed_description"`
			HeaderImage  string   `json:"header_image"`
			Background   string   `json:"background"`
			Genres       []struct {
				Description string `json:"description"`
			} `json:"genres"`
			Categories []struct {
				Description string `json:"description"`
			} `json:"categories"`
			ReleaseDate struct {
				Date string `json:"date"`
			} `json:"release_date"`
			PriceOverview *struct {
				Currency        string `json:"currency"`
				Initial         int    `json:"initial"`
				Final           int    `json:"final"`
				DiscountPercent int    `json:"discount_percent"`
			} `json:"price_overview"`
			Platforms struct {
				Windows bool `json:"windows"`
				Mac     bool `json:"mac"`
				Linux   bool `json:"linux"`
			} `json:"platforms"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	data, ok := result[storeGameID]
	if !ok || !data.Success {
		return nil, fmt.Errorf("game not found")
	}

	game := &StoreGameInfo{
		StoreGameID:     storeGameID,
		Name:            data.Data.Name,
		Description:     data.Data.ShortDesc,
		CoverImage:      data.Data.HeaderImage,
		BackgroundImage: data.Data.Background,
		StoreURL:        fmt.Sprintf("https://store.steampowered.com/app/%s", storeGameID),
	}

	if len(data.Data.Developers) > 0 {
		game.Developer = data.Data.Developers[0]
	}

	if len(data.Data.Publishers) > 0 {
		game.Publisher = data.Data.Publishers[0]
	}

	for _, genre := range data.Data.Genres {
		game.Genres = append(game.Genres, genre.Description)
	}

	// Parse platforms
	if data.Data.Platforms.Windows {
		game.Platforms = append(game.Platforms, "Windows")
	}
	if data.Data.Platforms.Mac {
		game.Platforms = append(game.Platforms, "Mac")
	}
	if data.Data.Platforms.Linux {
		game.Platforms = append(game.Platforms, "Linux")
	}

	// Parse price
	if data.Data.PriceOverview != nil {
		price := float64(data.Data.PriceOverview.Initial) / 100
		game.Price = &price
		game.Currency = data.Data.PriceOverview.Currency

		if data.Data.PriceOverview.DiscountPercent > 0 {
			discountPrice := float64(data.Data.PriceOverview.Final) / 100
			game.DiscountPrice = &discountPrice
		}
	}

	return game, nil
}

func (c *SteamClient) GetGamePrice(ctx context.Context, storeGameID string) (*StorePriceInfo, error) {
	game, err := c.GetGameDetails(ctx, storeGameID)
	if err != nil {
		return nil, err
	}

	priceInfo := &StorePriceInfo{
		StoreGameID: storeGameID,
		Currency:    game.Currency,
		IsAvailable: true,
	}

	if game.Price != nil {
		priceInfo.Price = *game.Price
	}

	if game.DiscountPrice != nil {
		priceInfo.DiscountPrice = game.DiscountPrice
	}

	return priceInfo, nil
}
