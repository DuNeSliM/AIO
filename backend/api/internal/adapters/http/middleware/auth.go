package middleware

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// ContextKey is a type for context keys
type ContextKey string

const (
	// UserContextKey is the context key for the authenticated user
	UserContextKey ContextKey = "user"
)

// AuthenticatedUser represents the authenticated user from the JWT
type AuthenticatedUser struct {
	ID            string   `json:"sub"`
	Username      string   `json:"preferred_username"`
	Email         string   `json:"email"`
	EmailVerified bool     `json:"email_verified"`
	FirstName     string   `json:"given_name"`
	LastName      string   `json:"family_name"`
	Roles         []string `json:"roles"`
}

// JWTMiddleware validates JWT tokens from Keycloak
type JWTMiddleware struct {
	jwksURL    string
	issuer     string
	clientID   string
	keys       map[string]*rsa.PublicKey
	keysMutex  sync.RWMutex
	httpClient *http.Client
}

// JWKS represents a JSON Web Key Set
type JWKS struct {
	Keys []JWK `json:"keys"`
}

// JWK represents a JSON Web Key
type JWK struct {
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	Alg string `json:"alg"`
	Use string `json:"use"`
	N   string `json:"n"`
	E   string `json:"e"`
}

// NewJWTMiddleware creates a new JWT middleware
func NewJWTMiddleware(jwksURL, issuer, clientID string) *JWTMiddleware {
	return &JWTMiddleware{
		jwksURL:  jwksURL,
		issuer:   issuer,
		clientID: clientID,
		keys:     make(map[string]*rsa.PublicKey),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// fetchJWKS fetches the JSON Web Key Set from Keycloak
func (m *JWTMiddleware) fetchJWKS() error {
	resp, err := m.httpClient.Get(m.jwksURL)
	if err != nil {
		return fmt.Errorf("fetch JWKS: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read JWKS response: %w", err)
	}

	var jwks JWKS
	if err := json.Unmarshal(body, &jwks); err != nil {
		return fmt.Errorf("parse JWKS: %w", err)
	}

	m.keysMutex.Lock()
	defer m.keysMutex.Unlock()

	for _, jwk := range jwks.Keys {
		if jwk.Kty != "RSA" {
			continue
		}

		key, err := parseRSAPublicKey(jwk)
		if err != nil {
			continue
		}
		m.keys[jwk.Kid] = key
	}

	return nil
}

// parseRSAPublicKey converts a JWK to an RSA public key
func parseRSAPublicKey(jwk JWK) (*rsa.PublicKey, error) {
	// Decode N (modulus)
	nBytes, err := base64.RawURLEncoding.DecodeString(jwk.N)
	if err != nil {
		return nil, fmt.Errorf("decode N: %w", err)
	}

	// Decode E (exponent)
	eBytes, err := base64.RawURLEncoding.DecodeString(jwk.E)
	if err != nil {
		return nil, fmt.Errorf("decode E: %w", err)
	}

	// Convert E to int
	var e int
	for _, b := range eBytes {
		e = e<<8 + int(b)
	}

	return &rsa.PublicKey{
		N: new(big.Int).SetBytes(nBytes),
		E: e,
	}, nil
}

// getKey returns the public key for the given key ID
func (m *JWTMiddleware) getKey(kid string) (*rsa.PublicKey, error) {
	m.keysMutex.RLock()
	key, ok := m.keys[kid]
	m.keysMutex.RUnlock()

	if ok {
		return key, nil
	}

	// Key not found, try to refresh JWKS
	if err := m.fetchJWKS(); err != nil {
		return nil, err
	}

	m.keysMutex.RLock()
	key, ok = m.keys[kid]
	m.keysMutex.RUnlock()

	if !ok {
		return nil, fmt.Errorf("key %s not found", kid)
	}

	return key, nil
}

// Authenticate is the middleware handler that validates JWT tokens
func (m *JWTMiddleware) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract token from Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error": "missing authorization header"}`, http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			http.Error(w, `{"error": "invalid authorization header format"}`, http.StatusUnauthorized)
			return
		}

		tokenString := parts[1]

		// Parse and validate the token
		// Note: We don't validate audience because Keycloak access tokens typically have "account" as audience
		// The azp (authorized party) claim contains the client_id
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Validate signing algorithm
			if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}

			// Get the key ID from the token header
			kid, ok := token.Header["kid"].(string)
			if !ok {
				return nil, fmt.Errorf("missing kid in token header")
			}

			return m.getKey(kid)
		}, jwt.WithValidMethods([]string{"RS256"}),
			jwt.WithIssuer(m.issuer))

		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "invalid token: %s"}`, err.Error()), http.StatusUnauthorized)
			return
		}

		if !token.Valid {
			http.Error(w, `{"error": "invalid token"}`, http.StatusUnauthorized)
			return
		}

		// Extract claims
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, `{"error": "invalid token claims"}`, http.StatusUnauthorized)
			return
		}

		// Build authenticated user from claims
		user := AuthenticatedUser{
			ID:            getStringClaim(claims, "sub"),
			Username:      getStringClaim(claims, "preferred_username"),
			Email:         getStringClaim(claims, "email"),
			EmailVerified: getBoolClaim(claims, "email_verified"),
			FirstName:     getStringClaim(claims, "given_name"),
			LastName:      getStringClaim(claims, "family_name"),
			Roles:         getRolesClaim(claims),
		}

		// Add user to context
		ctx := context.WithValue(r.Context(), UserContextKey, &user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetUserFromContext extracts the authenticated user from the request context
func GetUserFromContext(ctx context.Context) (*AuthenticatedUser, bool) {
	user, ok := ctx.Value(UserContextKey).(*AuthenticatedUser)
	return user, ok
}

// Helper functions to safely extract claims
func getStringClaim(claims jwt.MapClaims, key string) string {
	if val, ok := claims[key].(string); ok {
		return val
	}
	return ""
}

func getBoolClaim(claims jwt.MapClaims, key string) bool {
	if val, ok := claims[key].(bool); ok {
		return val
	}
	return false
}

func getRolesClaim(claims jwt.MapClaims) []string {
	var roles []string

	// Keycloak stores roles in realm_access.roles
	if realmAccess, ok := claims["realm_access"].(map[string]interface{}); ok {
		if rolesInterface, ok := realmAccess["roles"].([]interface{}); ok {
			for _, role := range rolesInterface {
				if roleStr, ok := role.(string); ok {
					roles = append(roles, roleStr)
				}
			}
		}
	}

	return roles
}
