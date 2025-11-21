// internal/stores/xbox.go
package stores

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type XboxClient struct {
	clientID     string
	clientSecret string
	redirectURI  string
}

func NewXboxClient() StoreClient {
	return &XboxClient{
		clientID:     os.Getenv("XBOX_CLIENT_ID"),
		clientSecret: os.Getenv("XBOX_CLIENT_SECRET"),
		redirectURI:  os.Getenv("XBOX_REDIRECT_URI"),
	}
}

func (c *XboxClient) GetName() string {
	return "xbox"
}

func (c *XboxClient) GetAuthURL(state string) string {
	return fmt.Sprintf("https://login.live.com/oauth20_authorize.srf?client_id=%s&response_type=code&redirect_uri=%s&scope=XboxLive.signin&state=%s",
		c.clientID, c.redirectURI, state)
}

func (c *XboxClient) ExchangeCode(ctx context.Context, code string) (*StoreTokens, error) {
	// TODO: Implement Xbox OAuth token exchange
	return nil, fmt.Errorf("xbox integration not fully implemented")
}

func (c *XboxClient) RefreshToken(ctx context.Context, refreshToken string) (*StoreTokens, error) {
	return nil, fmt.Errorf("xbox integration not fully implemented")
}

func (c *XboxClient) GetUserInfo(ctx context.Context, accessToken string) (*StoreUserInfo, error) {
	return nil, fmt.Errorf("use OAuth callback for user info")
}

func (c *XboxClient) GetUserGames(ctx context.Context, xblToken string) ([]StoreGameInfo, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	// First get user's XUID
	req, err := http.NewRequestWithContext(ctx, "GET", "https://profile.xboxlive.com/users/me/profile/settings?settings=Gamertag", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "XBL3.0 x="+xblToken)
	req.Header.Set("x-xbl-contract-version", "2")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var profileResult struct {
		ProfileUsers []struct {
			ID string `json:"id"`
		} `json:"profileUsers"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&profileResult); err != nil {
		return nil, err
	}

	if len(profileResult.ProfileUsers) == 0 {
		return nil, fmt.Errorf("no profile found")
	}

	xuid := profileResult.ProfileUsers[0].ID

	// Get user's games
	gamesURL := fmt.Sprintf("https://titlehub.xboxlive.com/users/xuid(%s)/titles/titlehistory/decoration/detail", xuid)
	req, err = http.NewRequestWithContext(ctx, "GET", gamesURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "XBL3.0 x="+xblToken)
	req.Header.Set("x-xbl-contract-version", "2")

	resp, err = httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var gamesResult struct {
		Titles []struct {
			TitleID      string `json:"titleId"`
			Name         string `json:"name"`
			DisplayImage string `json:"displayImage"`
		} `json:"titles"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&gamesResult); err != nil {
		return nil, err
	}

	games := make([]StoreGameInfo, 0, len(gamesResult.Titles))
	for _, title := range gamesResult.Titles {
		games = append(games, StoreGameInfo{
			StoreGameID: title.TitleID,
			Name:        title.Name,
			CoverImage:  title.DisplayImage,
		})
	}

	return games, nil
}

func (c *XboxClient) SearchGames(ctx context.Context, query string, limit int) ([]StoreGameInfo, error) {
	return nil, fmt.Errorf("xbox search requires user authentication")
}

func (c *XboxClient) GetGameDetails(ctx context.Context, storeGameID string) (*StoreGameInfo, error) {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	apiURL := fmt.Sprintf("https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=%s&market=US&languages=en-us", storeGameID)

	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
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
			ProductID           string `json:"ProductId"`
			LocalizedProperties []struct {
				ProductTitle string `json:"ProductTitle"`
				Images       []struct {
					ImagePurpose string `json:"ImagePurpose"`
					URI          string `json:"Uri"`
				} `json:"Images"`
			} `json:"LocalizedProperties"`
		} `json:"Products"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if len(result.Products) == 0 {
		return nil, fmt.Errorf("game not found")
	}

	product := result.Products[0]
	game := &StoreGameInfo{
		StoreGameID: product.ProductID,
	}

	if len(product.LocalizedProperties) > 0 {
		game.Name = product.LocalizedProperties[0].ProductTitle
		for _, img := range product.LocalizedProperties[0].Images {
			if img.ImagePurpose == "BoxArt" {
				game.CoverImage = "https:" + img.URI
				break
			}
		}
	}

	return game, nil
}

func (c *XboxClient) GetGamePrice(ctx context.Context, storeGameID string) (*StorePriceInfo, error) {
	return &StorePriceInfo{
		StoreGameID: storeGameID,
		IsAvailable: true,
		Currency:    "USD",
	}, nil
}
