package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/MicahParks/keyfunc/v2"
	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const UserContextKey contextKey = "user"

// UserClaims represents the user info extracted from the JWT token
type UserClaims struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	PreferredName string `json:"preferred_username"`
}

// AuthMiddleware handles JWT validation against ZITADEL
type AuthMiddleware struct {
	jwks   *keyfunc.JWKS
	issuer string
}

// NewAuthMiddleware creates a new auth middleware that validates JWTs from ZITADEL
func NewAuthMiddleware(issuerURL string) (*AuthMiddleware, error) {
	jwksURL := strings.TrimSuffix(issuerURL, "/") + "/oauth/v2/keys"

	jwks, err := keyfunc.Get(jwksURL, keyfunc.Options{
		RefreshErrorHandler: func(err error) {
			// Log JWKS refresh errors silently
		},
	})
	if err != nil {
		return nil, err
	}

	return &AuthMiddleware{
		jwks:   jwks,
		issuer: issuerURL,
	}, nil
}

// Authenticate requires a valid JWT token
func (m *AuthMiddleware) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			http.Error(w, `{"error":"invalid authorization header"}`, http.StatusUnauthorized)
			return
		}

		tokenString := parts[1]

		token, err := jwt.Parse(tokenString, m.jwks.Keyfunc,
			jwt.WithIssuer(m.issuer),
			jwt.WithValidMethods([]string{"RS256"}),
		)
		if err != nil || !token.Valid {
			http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, `{"error":"invalid claims"}`, http.StatusUnauthorized)
			return
		}

		user := UserClaims{
			Sub:           getString(claims, "sub"),
			Email:         getString(claims, "email"),
			EmailVerified: getBool(claims, "email_verified"),
			Name:          getString(claims, "name"),
			PreferredName: getString(claims, "preferred_username"),
		}

		ctx := context.WithValue(r.Context(), UserContextKey, &user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// Optional allows requests without a token but attaches user if present
func (m *AuthMiddleware) Optional(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			next.ServeHTTP(w, r)
			return
		}

		// Try to authenticate but don't fail if invalid
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			next.ServeHTTP(w, r)
			return
		}

		tokenString := parts[1]
		token, err := jwt.Parse(tokenString, m.jwks.Keyfunc,
			jwt.WithIssuer(m.issuer),
			jwt.WithValidMethods([]string{"RS256"}),
		)
		if err != nil || !token.Valid {
			next.ServeHTTP(w, r)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			next.ServeHTTP(w, r)
			return
		}

		user := UserClaims{
			Sub:           getString(claims, "sub"),
			Email:         getString(claims, "email"),
			EmailVerified: getBool(claims, "email_verified"),
			Name:          getString(claims, "name"),
			PreferredName: getString(claims, "preferred_username"),
		}

		ctx := context.WithValue(r.Context(), UserContextKey, &user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetUser extracts the user from the request context
func GetUser(ctx context.Context) *UserClaims {
	user, _ := ctx.Value(UserContextKey).(*UserClaims)
	return user
}

func getString(claims jwt.MapClaims, key string) string {
	if val, ok := claims[key].(string); ok {
		return val
	}
	return ""
}

func getBool(claims jwt.MapClaims, key string) bool {
	if val, ok := claims[key].(bool); ok {
		return val
	}
	return false
}
