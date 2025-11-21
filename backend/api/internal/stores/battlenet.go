// internal/stores/battlenet.go
package stores

import (
	"context"
	"fmt"
	"os"
)

type BattleNetClient struct {
	clientID     string
	clientSecret string
	redirectURI  string
}

func NewBattleNetClient() StoreClient {
	return &BattleNetClient{
		clientID:     os.Getenv("BATTLENET_CLIENT_ID"),
		clientSecret: os.Getenv("BATTLENET_CLIENT_SECRET"),
		redirectURI:  os.Getenv("BATTLENET_REDIRECT_URI"),
	}
}

func (c *BattleNetClient) GetName() string {
	return "battlenet"
}

func (c *BattleNetClient) GetAuthURL(state string) string {
	return fmt.Sprintf("https://oauth.battle.net/authorize?client_id=%s&response_type=code&redirect_uri=%s&state=%s",
		c.clientID, c.redirectURI, state)
}

func (c *BattleNetClient) ExchangeCode(ctx context.Context, code string) (*StoreTokens, error) {
	return nil, fmt.Errorf("battle.net integration not fully implemented")
}

func (c *BattleNetClient) RefreshToken(ctx context.Context, refreshToken string) (*StoreTokens, error) {
	return nil, fmt.Errorf("battle.net integration not fully implemented")
}

func (c *BattleNetClient) GetUserInfo(ctx context.Context, accessToken string) (*StoreUserInfo, error) {
	return nil, fmt.Errorf("use OAuth callback for user info")
}

func (c *BattleNetClient) GetUserGames(ctx context.Context, accessToken string) ([]StoreGameInfo, error) {
	// Battle.net doesn't expose library API publicly - games are managed by Battle.net desktop app
	// Return empty list as library is local to Battle.net client
	return []StoreGameInfo{}, nil
}

func (c *BattleNetClient) SearchGames(ctx context.Context, query string, limit int) ([]StoreGameInfo, error) {
	// Battle.net doesn't have a public search API
	// Games must be purchased/activated through Battle.net client or website
	return nil, fmt.Errorf("battle.net search not available via API")
}

func (c *BattleNetClient) GetGameDetails(ctx context.Context, storeGameID string) (*StoreGameInfo, error) {
	// Battle.net game details would require web scraping or desktop client integration
	return nil, fmt.Errorf("battle.net game details not available via API")
}

func (c *BattleNetClient) GetGamePrice(ctx context.Context, storeGameID string) (*StorePriceInfo, error) {
	return nil, fmt.Errorf("battle.net pricing not available via API")
}
