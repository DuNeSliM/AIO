// internal/auth/providers.go
package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"aoi/api/internal/crypto"
	"aoi/api/internal/users"
)

type ExternalAuthService interface {
	GetAuthURL(ctx context.Context, provider, state string) (string, error)
	HandleCallback(ctx context.Context, provider, code, state string) (*users.User, *StoreAccountInfo, error)
}

// StoreAccountInfo contains the store account data after successful auth
type StoreAccountInfo struct {
	Store        string
	StoreUserID  string
	DisplayName  string
	AccessToken  string
	RefreshToken string
	ExpiresAt    time.Time
}

type externalAuthService struct {
	repo       users.Repository
	encryptor  crypto.Encryptor
	httpClient *http.Client
}

// NewExternalAuthService creates a real OAuth/OpenID service for store authentication
func NewExternalAuthService(repo users.Repository, encryptor crypto.Encryptor) ExternalAuthService {
	return &externalAuthService{
		repo:       repo,
		encryptor:  encryptor,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (s *externalAuthService) GetAuthURL(_ context.Context, provider, state string) (string, error) {
	switch provider {
	case "steam":
		return s.getSteamAuthURL(state), nil
	case "epic":
		return s.getEpicAuthURL(state), nil
	case "gog":
		return s.getGOGAuthURL(state), nil
	case "xbox":
		return s.getXboxAuthURL(state), nil
	case "battlenet":
		return s.getBattleNetAuthURL(state), nil
	case "uplay":
		return s.getUplayAuthURL(state), nil
	case "amazon":
		return s.getAmazonAuthURL(state), nil
	case "ea":
		return s.getEAAuthURL(state), nil
	case "psn":
		return s.getPSNAuthURL(state), nil
	default:
		return "", fmt.Errorf("unsupported provider: %s", provider)
	}
}

func (s *externalAuthService) HandleCallback(
	ctx context.Context,
	provider, code, state string,
) (*users.User, *StoreAccountInfo, error) {
	var storeInfo *StoreAccountInfo
	var err error

	switch provider {
	case "steam":
		storeInfo, err = s.handleSteamCallback(ctx, code)
	case "epic":
		storeInfo, err = s.handleEpicCallback(ctx, code)
	case "gog":
		storeInfo, err = s.handleGOGCallback(ctx, code)
	case "xbox":
		storeInfo, err = s.handleXboxCallback(ctx, code)
	case "battlenet":
		storeInfo, err = s.handleBattleNetCallback(ctx, code)
	case "uplay":
		storeInfo, err = s.handleUplayCallback(ctx, code)
	case "amazon":
		storeInfo, err = s.handleAmazonCallback(ctx, code)
	case "ea":
		storeInfo, err = s.handleEACallback(ctx, code)
	case "psn":
		storeInfo, err = s.handlePSNCallback(ctx, code)
	default:
		return nil, nil, fmt.Errorf("unsupported provider: %s", provider)
	}

	if err != nil {
		return nil, nil, err
	}

	// Find or create user based on store account
	email := fmt.Sprintf("%s_%s@gamestore.local", provider, storeInfo.StoreUserID)
	username := fmt.Sprintf("%s_%s", provider, storeInfo.DisplayName)

	// Sanitize username (remove special chars)
	username = sanitizeUsername(username)

	user, err := s.repo.FindByEmail(ctx, email)
	if err != nil || user == nil {
		// Create new user
		user, err = s.repo.Create(ctx, &users.User{
			Email:    &email,
			Username: username,
		})
		if err != nil {
			return nil, nil, fmt.Errorf("failed to create user: %w", err)
		}
	}

	return user, storeInfo, nil
}

// Steam OpenID implementation
func (s *externalAuthService) getSteamAuthURL(state string) string {
	redirectURI := os.Getenv("STEAM_REDIRECT_URI")
	if redirectURI == "" {
		redirectURI = "http://localhost:8080/auth/steam/callback"
	}

	params := url.Values{}
	params.Set("openid.ns", "http://specs.openid.net/auth/2.0")
	params.Set("openid.mode", "checkid_setup")
	params.Set("openid.return_to", redirectURI+"?state="+state)
	params.Set("openid.realm", redirectURI)
	params.Set("openid.identity", "http://specs.openid.net/auth/2.0/identifier_select")
	params.Set("openid.claimed_id", "http://specs.openid.net/auth/2.0/identifier_select")

	return "https://steamcommunity.com/openid/login?" + params.Encode()
}

func (s *externalAuthService) handleSteamCallback(ctx context.Context, claimedID string) (*StoreAccountInfo, error) {
	// Extract Steam ID from claimed_id URL
	// Format: https://steamcommunity.com/openid/id/{steamid}
	re := regexp.MustCompile(`/id/(\d+)$`)
	matches := re.FindStringSubmatch(claimedID)
	if len(matches) < 2 {
		return nil, fmt.Errorf("invalid steam claimed_id")
	}

	steamID := matches[1]
	apiKey := os.Getenv("STEAM_API_KEY")

	// If no API key, still return basic info with just the Steam ID
	if apiKey == "" {
		return &StoreAccountInfo{
			Store:        "steam",
			StoreUserID:  steamID,
			DisplayName:  "Steam User " + steamID,
			AccessToken:  steamID,
			RefreshToken: "",
			ExpiresAt:    time.Now().Add(365 * 24 * time.Hour),
		}, nil
	}

	// Fetch user info from Steam API
	apiURL := fmt.Sprintf("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=%s&steamids=%s",
		apiKey, steamID)

	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Response struct {
			Players []struct {
				SteamID     string `json:"steamid"`
				PersonaName string `json:"personaname"`
			} `json:"players"`
		} `json:"response"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if len(result.Response.Players) == 0 {
		return nil, fmt.Errorf("steam user not found")
	}

	player := result.Response.Players[0]
	return &StoreAccountInfo{
		Store:        "steam",
		StoreUserID:  player.SteamID,
		DisplayName:  player.PersonaName,
		AccessToken:  steamID, // For Steam, we use the Steam ID as the "token"
		RefreshToken: "",
		ExpiresAt:    time.Now().Add(365 * 24 * time.Hour), // Long-lived
	}, nil
}

// OAuth2 helper for other stores
func (s *externalAuthService) getOAuth2URL(clientID, authURL, redirectURI, state, scope string) string {
	params := url.Values{}
	params.Set("client_id", clientID)
	params.Set("redirect_uri", redirectURI)
	params.Set("response_type", "code")
	params.Set("state", state)
	if scope != "" {
		params.Set("scope", scope)
	}
	return authURL + "?" + params.Encode()
}

func (s *externalAuthService) exchangeOAuth2Code(ctx context.Context, tokenURL, clientID, clientSecret, redirectURI, code string) (string, string, time.Time, error) {
	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("redirect_uri", redirectURI)

	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", "", time.Time{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", "", time.Time{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", "", time.Time{}, fmt.Errorf("token exchange failed: %s", string(body))
	}

	var result struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", "", time.Time{}, err
	}

	expiresAt := time.Now().Add(time.Duration(result.ExpiresIn) * time.Second)
	return result.AccessToken, result.RefreshToken, expiresAt, nil
}

// Epic Games requires Basic Auth (not form-based client credentials)
func (s *externalAuthService) exchangeEpicOAuth2Code(ctx context.Context, clientID, clientSecret, redirectURI, code string) (string, string, time.Time, error) {
	auth := base64.StdEncoding.EncodeToString([]byte(clientID + ":" + clientSecret))

	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", redirectURI)

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.epicgames.dev/epic/oauth/v2/token", strings.NewReader(data.Encode()))
	if err != nil {
		return "", "", time.Time{}, err
	}
	req.Header.Set("Authorization", "Basic "+auth)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	// Debug logging
	log.Printf("=== Epic OAuth Token Request ===")
	log.Printf("URL: POST https://api.epicgames.dev/epic/oauth/v2/token")
	log.Printf("Headers:")
	log.Printf("  Authorization: Basic %s", auth)
	log.Printf("  Content-Type: application/x-www-form-urlencoded")
	log.Printf("Body: %s", data.Encode())
	log.Printf("ClientID: %s", clientID)
	log.Printf("RedirectURI: %s", redirectURI)
	log.Printf("================================")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", "", time.Time{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)

		// Check for Epic's SCOPE_CONSENT error
		var epicError struct {
			ErrorCode        string `json:"errorCode"`
			CorrectiveAction string `json:"correctiveAction"`
			ContinuationURL  string `json:"continuationUrl"`
		}

		if json.Unmarshal(body, &epicError) == nil && epicError.CorrectiveAction == "SCOPE_CONSENT" {
			// Return a special error with the continuation URL
			return "", "", time.Time{}, fmt.Errorf("SCOPE_CONSENT_REQUIRED:%s", epicError.ContinuationURL)
		}

		return "", "", time.Time{}, fmt.Errorf("token exchange failed: %s", string(body))
	}

	var result struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", "", time.Time{}, err
	}

	expiresAt := time.Now().Add(time.Duration(result.ExpiresIn) * time.Second)
	return result.AccessToken, result.RefreshToken, expiresAt, nil
}

// Epic Games
func (s *externalAuthService) getEpicAuthURL(state string) string {
	clientID := os.Getenv("EPIC_CLIENT_ID")
	redirectURI := getEnvOrDefault("EPIC_REDIRECT_URI", "http://localhost:8080/auth/epic/callback")
	// Try without explicit scope - let Epic use default scopes from the client policy
	return fmt.Sprintf("%s?client_id=%s&response_type=code&redirect_uri=%s&state=%s",
		"https://www.epicgames.com/id/authorize", clientID, url.QueryEscape(redirectURI), state)
}

func (s *externalAuthService) handleEpicCallback(ctx context.Context, code string) (*StoreAccountInfo, error) {
	clientID := os.Getenv("EPIC_CLIENT_ID")
	clientSecret := os.Getenv("EPIC_CLIENT_SECRET")
	redirectURI := getEnvOrDefault("EPIC_REDIRECT_URI", "http://localhost:8080/auth/epic/callback")

	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("Epic Games credentials not configured")
	}

	accessToken, refreshToken, expiresAt, err := s.exchangeEpicOAuth2Code(ctx,
		clientID, clientSecret, redirectURI, code)
	if err != nil {
		return nil, err
	}

	// Get user info
	userInfo, err := s.getEpicUserInfo(ctx, accessToken)
	if err != nil {
		return nil, err
	}

	// Debug: log the entire userInfo response
	userInfoJSON, _ := json.Marshal(userInfo)
	log.Printf("Epic userInfo response: %s", string(userInfoJSON))

	// Epic uses "sub" for account ID (standard OpenID Connect)
	accountID, ok := userInfo["sub"].(string)
	if !ok {
		// Fallback to account_id if sub is not present
		accountID, ok = userInfo["account_id"].(string)
		if !ok {
			return nil, fmt.Errorf("no account identifier in Epic userInfo response")
		}
	}

	// Epic uses "preferred_username" for display name
	displayName, ok := userInfo["preferred_username"].(string)
	if !ok {
		// Try other common fields
		displayName, ok = userInfo["display_name"].(string)
		if !ok {
			displayName, ok = userInfo["displayName"].(string)
			if !ok {
				displayName = accountID // fallback to account ID
			}
		}
	}

	return &StoreAccountInfo{
		Store:        "epic",
		StoreUserID:  accountID,
		DisplayName:  displayName,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
	}, nil
}

func (s *externalAuthService) getEpicUserInfo(ctx context.Context, accessToken string) (map[string]interface{}, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.epicgames.dev/epic/oauth/v1/userInfo", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

// GOG
func (s *externalAuthService) getGOGAuthURL(state string) string {
	clientID := os.Getenv("GOG_CLIENT_ID")
	redirectURI := getEnvOrDefault("GOG_REDIRECT_URI", "http://localhost:8080/auth/gog/callback")
	return s.getOAuth2URL(clientID, "https://auth.gog.com/auth", redirectURI, state, "")
}

func (s *externalAuthService) handleGOGCallback(ctx context.Context, code string) (*StoreAccountInfo, error) {
	clientID := os.Getenv("GOG_CLIENT_ID")
	clientSecret := os.Getenv("GOG_CLIENT_SECRET")
	redirectURI := getEnvOrDefault("GOG_REDIRECT_URI", "http://localhost:8080/auth/gog/callback")

	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("GOG credentials not configured")
	}

	accessToken, refreshToken, expiresAt, err := s.exchangeOAuth2Code(ctx,
		"https://auth.gog.com/token",
		clientID, clientSecret, redirectURI, code)
	if err != nil {
		return nil, err
	}

	userInfo, err := s.getGOGUserInfo(ctx, accessToken)
	if err != nil {
		return nil, err
	}

	return &StoreAccountInfo{
		Store:        "gog",
		StoreUserID:  fmt.Sprintf("%v", userInfo["userId"]),
		DisplayName:  userInfo["username"].(string),
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
	}, nil
}

func (s *externalAuthService) getGOGUserInfo(ctx context.Context, accessToken string) (map[string]interface{}, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://embed.gog.com/user/data/games", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

// Xbox (Microsoft)
func (s *externalAuthService) getXboxAuthURL(state string) string {
	clientID := os.Getenv("XBOX_CLIENT_ID")
	redirectURI := getEnvOrDefault("XBOX_REDIRECT_URI", "http://localhost:8080/auth/xbox/callback")
	return s.getOAuth2URL(clientID, "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize",
		redirectURI, state, "XboxLive.signin XboxLive.offline_access")
}

func (s *externalAuthService) handleXboxCallback(ctx context.Context, code string) (*StoreAccountInfo, error) {
	clientID := os.Getenv("XBOX_CLIENT_ID")
	clientSecret := os.Getenv("XBOX_CLIENT_SECRET")
	redirectURI := getEnvOrDefault("XBOX_REDIRECT_URI", "http://localhost:8080/auth/xbox/callback")

	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("Xbox credentials not configured")
	}

	accessToken, refreshToken, expiresAt, err := s.exchangeOAuth2Code(ctx,
		"https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
		clientID, clientSecret, redirectURI, code)
	if err != nil {
		return nil, err
	}

	// Exchange Microsoft token for Xbox Live token
	xblToken, err := s.exchangeXboxLiveToken(ctx, accessToken)
	if err != nil {
		return nil, err
	}

	// Get Xbox user info
	userInfo, err := s.getXboxUserInfo(ctx, xblToken)
	if err != nil {
		return nil, err
	}

	return &StoreAccountInfo{
		Store:        "xbox",
		StoreUserID:  userInfo["xuid"].(string),
		DisplayName:  userInfo["gamertag"].(string),
		AccessToken:  xblToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
	}, nil
}

func (s *externalAuthService) exchangeXboxLiveToken(ctx context.Context, msToken string) (string, error) {
	reqBody := map[string]interface{}{
		"RelyingParty": "http://auth.xboxlive.com",
		"TokenType":    "JWT",
		"Properties": map[string]interface{}{
			"AuthMethod": "RPS",
			"SiteName":   "user.auth.xboxlive.com",
			"RpsTicket":  "d=" + msToken,
		},
	}

	body, _ := json.Marshal(reqBody)
	req, err := http.NewRequestWithContext(ctx, "POST", "https://user.auth.xboxlive.com/user/authenticate", strings.NewReader(string(body)))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-xbl-contract-version", "1")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		Token string `json:"Token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	return result.Token, nil
}

func (s *externalAuthService) getXboxUserInfo(ctx context.Context, xblToken string) (map[string]interface{}, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://profile.xboxlive.com/users/me/profile/settings", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "XBL3.0 x="+xblToken)
	req.Header.Set("x-xbl-contract-version", "2")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	// Extract user info from response
	userInfo := make(map[string]interface{})
	if settings, ok := result["profileUsers"].([]interface{}); ok && len(settings) > 0 {
		if user, ok := settings[0].(map[string]interface{}); ok {
			userInfo["xuid"] = user["id"]
			if settingsArray, ok := user["settings"].([]interface{}); ok {
				for _, setting := range settingsArray {
					if s, ok := setting.(map[string]interface{}); ok {
						if s["id"] == "Gamertag" {
							userInfo["gamertag"] = s["value"]
						}
					}
				}
			}
		}
	}

	return userInfo, nil
}

// Battle.net
func (s *externalAuthService) getBattleNetAuthURL(state string) string {
	clientID := os.Getenv("BATTLENET_CLIENT_ID")
	redirectURI := getEnvOrDefault("BATTLENET_REDIRECT_URI", "http://localhost:8080/auth/battlenet/callback")
	return s.getOAuth2URL(clientID, "https://oauth.battle.net/authorize", redirectURI, state, "")
}

func (s *externalAuthService) handleBattleNetCallback(ctx context.Context, code string) (*StoreAccountInfo, error) {
	clientID := os.Getenv("BATTLENET_CLIENT_ID")
	clientSecret := os.Getenv("BATTLENET_CLIENT_SECRET")
	redirectURI := getEnvOrDefault("BATTLENET_REDIRECT_URI", "http://localhost:8080/auth/battlenet/callback")

	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("Battle.net credentials not configured")
	}

	accessToken, refreshToken, expiresAt, err := s.exchangeOAuth2Code(ctx,
		"https://oauth.battle.net/token",
		clientID, clientSecret, redirectURI, code)
	if err != nil {
		return nil, err
	}

	userInfo, err := s.getBattleNetUserInfo(ctx, accessToken)
	if err != nil {
		return nil, err
	}

	return &StoreAccountInfo{
		Store:        "battlenet",
		StoreUserID:  fmt.Sprintf("%v", userInfo["id"]),
		DisplayName:  userInfo["battletag"].(string),
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
	}, nil
}

func (s *externalAuthService) getBattleNetUserInfo(ctx context.Context, accessToken string) (map[string]interface{}, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://oauth.battle.net/oauth/userinfo", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

// Uplay (Ubisoft Connect)
func (s *externalAuthService) getUplayAuthURL(state string) string {
	clientID := os.Getenv("UPLAY_CLIENT_ID")
	redirectURI := getEnvOrDefault("UPLAY_REDIRECT_URI", "http://localhost:8080/auth/uplay/callback")
	return s.getOAuth2URL(clientID, "https://connect.ubisoft.com/oauth/authorize", redirectURI, state, "")
}

func (s *externalAuthService) handleUplayCallback(ctx context.Context, code string) (*StoreAccountInfo, error) {
	clientID := os.Getenv("UPLAY_CLIENT_ID")
	clientSecret := os.Getenv("UPLAY_CLIENT_SECRET")
	redirectURI := getEnvOrDefault("UPLAY_REDIRECT_URI", "http://localhost:8080/auth/uplay/callback")

	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("Uplay credentials not configured")
	}

	accessToken, refreshToken, expiresAt, err := s.exchangeOAuth2Code(ctx,
		"https://connect.ubisoft.com/oauth/token",
		clientID, clientSecret, redirectURI, code)
	if err != nil {
		return nil, err
	}

	userInfo, err := s.getUplayUserInfo(ctx, accessToken)
	if err != nil {
		return nil, err
	}

	return &StoreAccountInfo{
		Store:        "uplay",
		StoreUserID:  userInfo["userId"].(string),
		DisplayName:  userInfo["username"].(string),
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
	}, nil
}

func (s *externalAuthService) getUplayUserInfo(ctx context.Context, accessToken string) (map[string]interface{}, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://public-ubiservices.ubi.com/v3/users/me", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Ubi-AppId", os.Getenv("UPLAY_CLIENT_ID"))

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

// Amazon Games
func (s *externalAuthService) getAmazonAuthURL(state string) string {
	clientID := os.Getenv("AMAZON_CLIENT_ID")
	redirectURI := getEnvOrDefault("AMAZON_REDIRECT_URI", "http://localhost:8080/auth/amazon/callback")
	return s.getOAuth2URL(clientID, "https://www.amazon.com/ap/oa", redirectURI, state, "profile")
}

func (s *externalAuthService) handleAmazonCallback(ctx context.Context, code string) (*StoreAccountInfo, error) {
	clientID := os.Getenv("AMAZON_CLIENT_ID")
	clientSecret := os.Getenv("AMAZON_CLIENT_SECRET")
	redirectURI := getEnvOrDefault("AMAZON_REDIRECT_URI", "http://localhost:8080/auth/amazon/callback")

	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("Amazon credentials not configured")
	}

	accessToken, refreshToken, expiresAt, err := s.exchangeOAuth2Code(ctx,
		"https://api.amazon.com/auth/o2/token",
		clientID, clientSecret, redirectURI, code)
	if err != nil {
		return nil, err
	}

	userInfo, err := s.getAmazonUserInfo(ctx, accessToken)
	if err != nil {
		return nil, err
	}

	return &StoreAccountInfo{
		Store:        "amazon",
		StoreUserID:  userInfo["user_id"].(string),
		DisplayName:  userInfo["name"].(string),
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
	}, nil
}

func (s *externalAuthService) getAmazonUserInfo(ctx context.Context, accessToken string) (map[string]interface{}, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.amazon.com/user/profile", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

// EA (Electronic Arts)
func (s *externalAuthService) getEAAuthURL(state string) string {
	clientID := os.Getenv("EA_CLIENT_ID")
	redirectURI := getEnvOrDefault("EA_REDIRECT_URI", "http://localhost:8080/auth/ea/callback")
	return s.getOAuth2URL(clientID, "https://accounts.ea.com/connect/auth", redirectURI, state, "basic.identity offline")
}

func (s *externalAuthService) handleEACallback(ctx context.Context, code string) (*StoreAccountInfo, error) {
	clientID := os.Getenv("EA_CLIENT_ID")
	clientSecret := os.Getenv("EA_CLIENT_SECRET")
	redirectURI := getEnvOrDefault("EA_REDIRECT_URI", "http://localhost:8080/auth/ea/callback")

	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("EA credentials not configured")
	}

	accessToken, refreshToken, expiresAt, err := s.exchangeOAuth2Code(ctx,
		"https://accounts.ea.com/connect/token",
		clientID, clientSecret, redirectURI, code)
	if err != nil {
		return nil, err
	}

	userInfo, err := s.getEAUserInfo(ctx, accessToken)
	if err != nil {
		return nil, err
	}

	return &StoreAccountInfo{
		Store:        "ea",
		StoreUserID:  fmt.Sprintf("%v", userInfo["pid"]),
		DisplayName:  userInfo["displayName"].(string),
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
	}, nil
}

func (s *externalAuthService) getEAUserInfo(ctx context.Context, accessToken string) (map[string]interface{}, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://gateway.ea.com/proxy/identity/pids/me", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

// PSN (PlayStation Network)
func (s *externalAuthService) getPSNAuthURL(state string) string {
	clientID := os.Getenv("PSN_CLIENT_ID")
	redirectURI := getEnvOrDefault("PSN_REDIRECT_URI", "http://localhost:8080/auth/psn/callback")
	return s.getOAuth2URL(clientID, "https://ca.account.sony.com/api/authz/v3/oauth/authorize", redirectURI, state, "psn:s2s")
}

func (s *externalAuthService) handlePSNCallback(ctx context.Context, code string) (*StoreAccountInfo, error) {
	clientID := os.Getenv("PSN_CLIENT_ID")
	clientSecret := os.Getenv("PSN_CLIENT_SECRET")
	redirectURI := getEnvOrDefault("PSN_REDIRECT_URI", "http://localhost:8080/auth/psn/callback")

	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("PSN credentials not configured")
	}

	accessToken, refreshToken, expiresAt, err := s.exchangeOAuth2Code(ctx,
		"https://ca.account.sony.com/api/authz/v3/oauth/token",
		clientID, clientSecret, redirectURI, code)
	if err != nil {
		return nil, err
	}

	userInfo, err := s.getPSNUserInfo(ctx, accessToken)
	if err != nil {
		return nil, err
	}

	return &StoreAccountInfo{
		Store:        "psn",
		StoreUserID:  userInfo["accountId"].(string),
		DisplayName:  userInfo["onlineId"].(string),
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
	}, nil
}

func (s *externalAuthService) getPSNUserInfo(ctx context.Context, accessToken string) (map[string]interface{}, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://us-prof.np.community.playstation.net/userProfile/v1/users/me/profile", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Profile map[string]interface{} `json:"profile"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Profile, nil
}

// Helper functions
func getEnvOrDefault(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func sanitizeUsername(username string) string {
	re := regexp.MustCompile(`[^a-zA-Z0-9_-]`)
	sanitized := re.ReplaceAllString(username, "_")
	if len(sanitized) > 32 {
		sanitized = sanitized[:32]
	}
	return sanitized
}

func generateTempID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}
