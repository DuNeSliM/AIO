package keycloak

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client handles communication with Keycloak Admin and Token APIs
type Client struct {
	baseURL              string
	realm                string
	clientID             string
	clientSecret         string
	requireEmailVerified bool
	httpClient           *http.Client
}

// NewClient creates a new Keycloak client
func NewClient(baseURL, realm, clientID, clientSecret string, requireEmailVerified bool) *Client {
	return &Client{
		baseURL:              strings.TrimSuffix(baseURL, "/"),
		realm:                realm,
		clientID:             clientID,
		clientSecret:         clientSecret,
		requireEmailVerified: requireEmailVerified,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// TokenResponse represents the response from Keycloak token endpoint
type TokenResponse struct {
	AccessToken      string `json:"access_token"`
	ExpiresIn        int    `json:"expires_in"`
	RefreshToken     string `json:"refresh_token"`
	RefreshExpiresIn int    `json:"refresh_expires_in"`
	TokenType        string `json:"token_type"`
	IDToken          string `json:"id_token,omitempty"`
	Scope            string `json:"scope"`
}

// UserRepresentation represents a Keycloak user
type UserRepresentation struct {
	ID            string                     `json:"id,omitempty"`
	Username      string                     `json:"username"`
	Email         string                     `json:"email"`
	FirstName     string                     `json:"firstName,omitempty"`
	LastName      string                     `json:"lastName,omitempty"`
	Enabled       bool                       `json:"enabled"`
	EmailVerified bool                       `json:"emailVerified"`
	RequiredActions []string                 `json:"requiredActions,omitempty"`
	Credentials   []CredentialRepresentation `json:"credentials,omitempty"`
	Attributes    map[string][]string        `json:"attributes,omitempty"`
	VerificationEmailRequired bool           `json:"-"`
	VerificationEmailSent     bool           `json:"-"`
	VerificationEmailWarning  string         `json:"-"`
}

// CredentialRepresentation represents user credentials
type CredentialRepresentation struct {
	Type      string `json:"type"`
	Value     string `json:"value"`
	Temporary bool   `json:"temporary"`
}

// RegisterRequest represents a user registration request
type RegisterRequest struct {
	Username  string `json:"username"`
	Email     string `json:"email"`
	Password  string `json:"password"`
	FirstName string `json:"firstName,omitempty"`
	LastName  string `json:"lastName,omitempty"`
}

// LoginRequest represents a user login request
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// RefreshRequest represents a token refresh request
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// ErrorResponse represents a Keycloak error response
type ErrorResponse struct {
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
}

// getAdminToken gets an admin access token using client credentials
func (c *Client) getAdminToken(ctx context.Context) (string, error) {
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", c.baseURL, c.realm)

	data := url.Values{}
	data.Set("grant_type", "client_credentials")
	data.Set("client_id", c.clientID)
	data.Set("client_secret", c.clientSecret)

	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errResp ErrorResponse
		_ = json.Unmarshal(body, &errResp)
		return "", fmt.Errorf("keycloak error: %s - %s", errResp.Error, errResp.ErrorDescription)
	}

	var tokenResp TokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", fmt.Errorf("parse response: %w", err)
	}

	return tokenResp.AccessToken, nil
}

// Register creates a new user in Keycloak
func (c *Client) Register(ctx context.Context, req RegisterRequest) (*UserRepresentation, error) {
	// Get admin token first
	adminToken, err := c.getAdminToken(ctx)
	if err != nil {
		return nil, fmt.Errorf("get admin token: %w", err)
	}

	// Create user via Admin API
	usersURL := fmt.Sprintf("%s/admin/realms/%s/users", c.baseURL, c.realm)

	user := UserRepresentation{
		Username:      req.Username,
		Email:         req.Email,
		FirstName:     req.FirstName,
		LastName:      req.LastName,
		Enabled:       true,
		EmailVerified: !c.requireEmailVerified,
		Credentials: []CredentialRepresentation{
			{
				Type:      "password",
				Value:     req.Password,
				Temporary: false,
			},
		},
	}

	userJSON, err := json.Marshal(user)
	if err != nil {
		return nil, fmt.Errorf("marshal user: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", usersURL, bytes.NewReader(userJSON))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusConflict {
		return nil, fmt.Errorf("user already exists")
	}

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("keycloak error (status %d): %s", resp.StatusCode, string(body))
	}

	// Get the created user ID from the Location header
	location := resp.Header.Get("Location")
	if location == "" {
		return nil, fmt.Errorf("no location header in response")
	}

	// Extract user ID from location URL
	parts := strings.Split(location, "/")
	userID := parts[len(parts)-1]

	verificationEmailSent := !c.requireEmailVerified
	verificationEmailWarning := ""

	// Send verification mail only when verification is required.
	if !c.requireEmailVerified {
		if err := c.setEmailVerified(ctx, userID, true, adminToken); err != nil {
			log.Printf("keycloak: could not force emailVerified=true for user %s: %v", userID, err)
		}
	}
	if c.requireEmailVerified {
		if err := c.SendVerificationEmail(ctx, userID, adminToken); err != nil {
			verificationEmailSent = false
			verificationEmailWarning = "verification email could not be sent"
			log.Printf("keycloak: failed to send verification email for user %s: %v", userID, err)
		}
	}

	return &UserRepresentation{
		ID:            userID,
		Username:      req.Username,
		Email:         req.Email,
		FirstName:     req.FirstName,
		LastName:      req.LastName,
		Enabled:       true,
		EmailVerified: !c.requireEmailVerified,
		VerificationEmailRequired: c.requireEmailVerified,
		VerificationEmailSent:     verificationEmailSent,
		VerificationEmailWarning:  verificationEmailWarning,
	}, nil
}

func (c *Client) setEmailVerified(ctx context.Context, userID string, verified bool, adminToken string) error {
	if adminToken == "" {
		var err error
		adminToken, err = c.getAdminToken(ctx)
		if err != nil {
			return fmt.Errorf("get admin token: %w", err)
		}
	}

	userURL := fmt.Sprintf("%s/admin/realms/%s/users/%s", c.baseURL, c.realm, userID)

	getReq, err := http.NewRequestWithContext(ctx, "GET", userURL, nil)
	if err != nil {
		return fmt.Errorf("create get request: %w", err)
	}
	getReq.Header.Set("Authorization", "Bearer "+adminToken)

	getResp, err := c.httpClient.Do(getReq)
	if err != nil {
		return fmt.Errorf("execute get request: %w", err)
	}
	defer getResp.Body.Close()

	if getResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(getResp.Body)
		return fmt.Errorf("get user failed (status %d): %s", getResp.StatusCode, string(body))
	}

	var user UserRepresentation
	if err := json.NewDecoder(getResp.Body).Decode(&user); err != nil {
		return fmt.Errorf("parse user: %w", err)
	}

	user.EmailVerified = verified
	if verified {
		user.RequiredActions = removeRequiredAction(user.RequiredActions, "VERIFY_EMAIL")
	}

	userJSON, err := json.Marshal(user)
	if err != nil {
		return fmt.Errorf("marshal user: %w", err)
	}

	updateReq, err := http.NewRequestWithContext(ctx, "PUT", userURL, bytes.NewReader(userJSON))
	if err != nil {
		return fmt.Errorf("create update request: %w", err)
	}
	updateReq.Header.Set("Content-Type", "application/json")
	updateReq.Header.Set("Authorization", "Bearer "+adminToken)

	updateResp, err := c.httpClient.Do(updateReq)
	if err != nil {
		return fmt.Errorf("execute update request: %w", err)
	}
	defer updateResp.Body.Close()

	if updateResp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(updateResp.Body)
		return fmt.Errorf("update user failed (status %d): %s", updateResp.StatusCode, string(body))
	}

	return nil
}

func removeRequiredAction(actions []string, action string) []string {
	if len(actions) == 0 {
		return actions
	}

	out := make([]string, 0, len(actions))
	for _, a := range actions {
		if !strings.EqualFold(a, action) {
			out = append(out, a)
		}
	}
	return out
}

// Login authenticates a user and returns tokens
func (c *Client) Login(ctx context.Context, req LoginRequest) (*TokenResponse, error) {
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", c.baseURL, c.realm)

	data := url.Values{}
	data.Set("grant_type", "password")
	data.Set("client_id", c.clientID)
	data.Set("client_secret", c.clientSecret)
	data.Set("username", req.Username)
	data.Set("password", req.Password)

	httpReq, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errResp ErrorResponse
		_ = json.Unmarshal(body, &errResp)
		if errResp.Error == "invalid_grant" {
			desc := strings.ToLower(strings.TrimSpace(errResp.ErrorDescription))
			switch {
			case strings.Contains(desc, "account is not fully set up"),
				strings.Contains(desc, "email not verified"),
				strings.Contains(desc, "verify email"):
				return nil, fmt.Errorf("account not verified")
			case strings.Contains(desc, "account disabled"),
				strings.Contains(desc, "user is disabled"):
				return nil, fmt.Errorf("account disabled")
			case strings.Contains(desc, "invalid user credentials"),
				strings.Contains(desc, "invalid username or password"):
				return nil, fmt.Errorf("invalid username or password")
			default:
				if errResp.ErrorDescription != "" {
					return nil, fmt.Errorf("invalid login: %s", errResp.ErrorDescription)
				}
				return nil, fmt.Errorf("invalid username or password")
			}
		}
		return nil, fmt.Errorf("keycloak error: %s - %s", errResp.Error, errResp.ErrorDescription)
	}

	var tokenResp TokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	return &tokenResp, nil
}

// RefreshToken refreshes an access token
func (c *Client) RefreshToken(ctx context.Context, refreshToken string) (*TokenResponse, error) {
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", c.baseURL, c.realm)

	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("client_id", c.clientID)
	data.Set("client_secret", c.clientSecret)
	data.Set("refresh_token", refreshToken)

	httpReq, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errResp ErrorResponse
		_ = json.Unmarshal(body, &errResp)
		return nil, fmt.Errorf("keycloak error: %s - %s", errResp.Error, errResp.ErrorDescription)
	}

	var tokenResp TokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	return &tokenResp, nil
}

// Logout invalidates tokens
func (c *Client) Logout(ctx context.Context, refreshToken string) error {
	logoutURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/logout", c.baseURL, c.realm)

	data := url.Values{}
	data.Set("client_id", c.clientID)
	data.Set("client_secret", c.clientSecret)
	data.Set("refresh_token", refreshToken)

	httpReq, err := http.NewRequestWithContext(ctx, "POST", logoutURL, strings.NewReader(data.Encode()))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("keycloak error (status %d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// GetUserInfo gets the current user's info from the token
func (c *Client) GetUserInfo(ctx context.Context, accessToken string) (*UserRepresentation, error) {
	userInfoURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/userinfo", c.baseURL, c.realm)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", userInfoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("keycloak error (status %d): %s", resp.StatusCode, string(body))
	}

	// UserInfo endpoint returns different structure
	var userInfo struct {
		Sub               string `json:"sub"`
		PreferredUsername string `json:"preferred_username"`
		Email             string `json:"email"`
		GivenName         string `json:"given_name"`
		FamilyName        string `json:"family_name"`
		EmailVerified     bool   `json:"email_verified"`
	}
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	return &UserRepresentation{
		ID:            userInfo.Sub,
		Username:      userInfo.PreferredUsername,
		Email:         userInfo.Email,
		FirstName:     userInfo.GivenName,
		LastName:      userInfo.FamilyName,
		EmailVerified: userInfo.EmailVerified,
	}, nil
}

// GetJWKSURL returns the JWKS URL for the realm
func (c *Client) GetJWKSURL() string {
	return fmt.Sprintf("%s/realms/%s/protocol/openid-connect/certs", c.baseURL, c.realm)
}

// GetIssuer returns the expected issuer for JWT validation
func (c *Client) GetIssuer() string {
	return fmt.Sprintf("%s/realms/%s", c.baseURL, c.realm)
}

// SendVerificationEmail sends an email verification link to the user
func (c *Client) SendVerificationEmail(ctx context.Context, userID string, adminToken string) error {
	// If no admin token provided, get one
	if adminToken == "" {
		var err error
		adminToken, err = c.getAdminToken(ctx)
		if err != nil {
			return fmt.Errorf("get admin token: %w", err)
		}
	}

	verifyURL := fmt.Sprintf("%s/admin/realms/%s/users/%s/send-verify-email", c.baseURL, c.realm, userID)

	httpReq, err := http.NewRequestWithContext(ctx, "PUT", verifyURL, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("keycloak error (status %d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// SendPasswordResetEmail sends a password reset email to the user
func (c *Client) SendPasswordResetEmail(ctx context.Context, email string) error {
	adminToken, err := c.getAdminToken(ctx)
	if err != nil {
		return fmt.Errorf("get admin token: %w", err)
	}

	// First, find the user by email
	searchURL := fmt.Sprintf("%s/admin/realms/%s/users?email=%s&exact=true", c.baseURL, c.realm, url.QueryEscape(email))

	httpReq, err := http.NewRequestWithContext(ctx, "GET", searchURL, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("keycloak error (status %d): %s", resp.StatusCode, string(body))
	}

	var users []UserRepresentation
	if err := json.NewDecoder(resp.Body).Decode(&users); err != nil {
		return fmt.Errorf("parse users: %w", err)
	}

	if len(users) == 0 {
		// Don't reveal if email exists or not for security
		return nil
	}

	userID := users[0].ID

	// Send password reset email using execute-actions-email
	resetURL := fmt.Sprintf("%s/admin/realms/%s/users/%s/execute-actions-email", c.baseURL, c.realm, userID)

	// The actions to execute - UPDATE_PASSWORD will send the reset link
	actions := []string{"UPDATE_PASSWORD"}
	actionsJSON, _ := json.Marshal(actions)

	httpReq, err = http.NewRequestWithContext(ctx, "PUT", resetURL, bytes.NewReader(actionsJSON))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err = c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("keycloak error (status %d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// ResendVerificationEmail resends the verification email for a user
func (c *Client) ResendVerificationEmail(ctx context.Context, email string) error {
	adminToken, err := c.getAdminToken(ctx)
	if err != nil {
		return fmt.Errorf("get admin token: %w", err)
	}

	// Find user by email
	searchURL := fmt.Sprintf("%s/admin/realms/%s/users?email=%s&exact=true", c.baseURL, c.realm, url.QueryEscape(email))

	httpReq, err := http.NewRequestWithContext(ctx, "GET", searchURL, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("user not found")
	}

	var users []UserRepresentation
	if err := json.NewDecoder(resp.Body).Decode(&users); err != nil {
		return fmt.Errorf("parse users: %w", err)
	}

	if len(users) == 0 {
		return nil // Don't reveal if email exists
	}

	return c.SendVerificationEmail(ctx, users[0].ID, adminToken)
}

// ChangePasswordRequest represents a password change request
type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

// UpdateProfileRequest represents a profile update request
type UpdateProfileRequest struct {
	Email     string `json:"email,omitempty"`
	FirstName string `json:"firstName,omitempty"`
	LastName  string `json:"lastName,omitempty"`
}

// ChangePassword changes the user's password
func (c *Client) ChangePassword(ctx context.Context, userID string, currentPassword, newPassword string) error {
	// Get admin token
	adminToken, err := c.getAdminToken(ctx)
	if err != nil {
		return fmt.Errorf("get admin token: %w", err)
	}

	// First verify the current password by attempting a login
	// We need to get the username first
	userURL := fmt.Sprintf("%s/admin/realms/%s/users/%s", c.baseURL, c.realm, userID)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", userURL, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("user not found")
	}

	var user UserRepresentation
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return fmt.Errorf("parse user: %w", err)
	}

	// Verify current password by attempting login
	_, err = c.Login(ctx, LoginRequest{
		Username: user.Username,
		Password: currentPassword,
	})
	if err != nil {
		return fmt.Errorf("current password is incorrect")
	}

	// Set new password via Admin API
	resetURL := fmt.Sprintf("%s/admin/realms/%s/users/%s/reset-password", c.baseURL, c.realm, userID)

	credential := CredentialRepresentation{
		Type:      "password",
		Value:     newPassword,
		Temporary: false,
	}

	credJSON, err := json.Marshal(credential)
	if err != nil {
		return fmt.Errorf("marshal credential: %w", err)
	}

	httpReq, err = http.NewRequestWithContext(ctx, "PUT", resetURL, bytes.NewReader(credJSON))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err = c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("keycloak error (status %d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// UpdateProfile updates the user's profile information
func (c *Client) UpdateProfile(ctx context.Context, userID string, req UpdateProfileRequest) (*UserRepresentation, error) {
	// Get admin token
	adminToken, err := c.getAdminToken(ctx)
	if err != nil {
		return nil, fmt.Errorf("get admin token: %w", err)
	}

	// Get current user data
	userURL := fmt.Sprintf("%s/admin/realms/%s/users/%s", c.baseURL, c.realm, userID)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", userURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("user not found")
	}

	var user UserRepresentation
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("parse user: %w", err)
	}

	// Update fields if provided
	if req.Email != "" {
		user.Email = req.Email
	}
	if req.FirstName != "" {
		user.FirstName = req.FirstName
	}
	if req.LastName != "" {
		user.LastName = req.LastName
	}

	// Clear credentials (we don't want to send them in update)
	user.Credentials = nil

	userJSON, err := json.Marshal(user)
	if err != nil {
		return nil, fmt.Errorf("marshal user: %w", err)
	}

	httpReq, err = http.NewRequestWithContext(ctx, "PUT", userURL, bytes.NewReader(userJSON))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err = c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("keycloak error (status %d): %s", resp.StatusCode, string(body))
	}

	return &user, nil
}
