// internal/http/auth_handlers.go
package http

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	nethttp "net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"aoi/api/internal/auth"
	"aoi/api/internal/crypto"
	"aoi/api/internal/library"
	"aoi/api/internal/models"
	"aoi/api/internal/users"
)

// AuthHandlers bundles everything needed for auth-related HTTP endpoints.
type AuthHandlers struct {
	Users     users.Service
	JWT       auth.JWTService
	JWTSecret string
	External  auth.ExternalAuthService
	Library   library.Service
	Encryptor crypto.Encryptor
}

// RegisterRoutes wires auth routes into the router group.
func (h *AuthHandlers) RegisterRoutes(r gin.IRoutes) {
	r.POST("/auth/register", h.Register)
	r.POST("/auth/login", h.LoginEmail)
	r.GET("/auth/:provider/login", h.LoginProvider)
	r.GET("/auth/:provider/callback", h.ProviderCallback)

	// Also register under /api prefix for frontend
	r.GET("/api/auth/:provider/login", h.LoginProvider)
	r.GET("/api/auth/:provider/callback", h.ProviderCallback)
}

// POST /auth/register
func (h *AuthHandlers) Register(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required,min=8"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(nethttp.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.Users.RegisterWithPassword(
		c.Request.Context(),
		req.Email,
		req.Username,
		req.Password,
	)
	if err != nil {
		c.JSON(nethttp.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	token, err := h.JWT.GenerateToken(user.ID)
	if err != nil {
		c.JSON(nethttp.StatusInternalServerError, gin.H{"error": "could not create token"})
		return
	}

	c.JSON(nethttp.StatusCreated, gin.H{
		"token": token,
		"user":  user.ToPublic(),
	})
}

// POST /auth/login
func (h *AuthHandlers) LoginEmail(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(nethttp.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.Users.AuthenticateWithEmail(
		c.Request.Context(),
		req.Email,
		req.Password,
	)
	if err != nil || user == nil {
		c.JSON(nethttp.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	log.Printf("User logged in: email=%s, userID=%d", req.Email, user.ID)

	token, err := h.JWT.GenerateToken(user.ID)
	if err != nil {
		c.JSON(nethttp.StatusInternalServerError, gin.H{"error": "could not create token"})
		return
	}

	c.JSON(nethttp.StatusOK, gin.H{
		"token": token,
		"user":  user.ToPublic(),
	})
}

// GET /auth/:provider/login
func (h *AuthHandlers) LoginProvider(c *gin.Context) {
	provider := c.Param("provider")
	if provider == "" {
		c.JSON(nethttp.StatusBadRequest, gin.H{"error": "missing provider"})
		return
	}

	state := generateRandomState(32)

	// Check if user is logged in by looking for JWT token
	// Try Authorization header first, then query parameter (for browser redirects)
	var userID int64
	var tokenStr string

	// Try Authorization header
	if authHeader := c.GetHeader("Authorization"); authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
		tokenStr = strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	}

	// Try query parameter (for browser-based OAuth flows)
	if tokenStr == "" {
		tokenStr = c.Query("token")
	}

	if tokenStr != "" {
		secretBytes := []byte(h.JWTSecret)

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return secretBytes, nil
		})

		if err == nil && token.Valid {
			if claims, ok := token.Claims.(jwt.MapClaims); ok {
				if sub, exists := claims["sub"]; exists {
					switch v := sub.(type) {
					case float64:
						userID = int64(v)
					case int64:
						userID = v
					case string:
						if parsed, err := strconv.ParseInt(v, 10, 64); err == nil {
							userID = parsed
						}
					}
				}
			}
		}

		if userID > 0 {
			log.Printf("OAuth flow for logged-in user: userID=%d, provider=%s", userID, provider)
			c.SetCookie("oauth_user_id_"+provider, fmt.Sprintf("%d", userID), 300, "/", "", true, true)
		}
	}

	authURL, err := h.External.GetAuthURL(c.Request.Context(), provider, state)
	if err != nil {
		log.Printf("GetAuthURL error for provider %s: %v", provider, err)
		c.JSON(nethttp.StatusInternalServerError, gin.H{"error": "failed to create auth URL"})
		return
	}

	cookieName := "oauth_state_" + provider
	c.SetCookie(cookieName, state, 300, "/", "", true, true)

	c.Redirect(nethttp.StatusFound, authURL)
}

// GET /auth/:provider/callback
func (h *AuthHandlers) ProviderCallback(c *gin.Context) {
	provider := c.Param("provider")
	if provider == "" {
		c.JSON(nethttp.StatusBadRequest, gin.H{"error": "missing provider"})
		return
	}

	// For Steam OpenID, the code is in claimed_id
	code := c.Query("code")
	if code == "" && provider == "steam" {
		code = c.Query("openid.claimed_id")
	}

	state := c.Query("state")

	if code == "" || state == "" {
		c.JSON(nethttp.StatusBadRequest, gin.H{"error": "missing code or state"})
		return
	}

	cookieName := "oauth_state_" + provider
	expectedState, err := c.Cookie(cookieName)
	if err != nil || expectedState == "" || expectedState != state {
		c.JSON(nethttp.StatusUnauthorized, gin.H{"error": "invalid oauth state"})
		return
	}

	// Check if this is linking to an existing user
	var existingUserID int64
	if userIDStr, err := c.Cookie("oauth_user_id_" + provider); err == nil && userIDStr != "" {
		if parsedID, err := fmt.Sscanf(userIDStr, "%d", &existingUserID); err == nil && parsedID == 1 {
			log.Printf("Linking %s to existing userID=%d", provider, existingUserID)
		}
		c.SetCookie("oauth_user_id_"+provider, "", -1, "/", "", true, true) // Clear cookie
	}

	user, storeInfo, err := h.External.HandleCallback(c.Request.Context(), provider, code, state)
	if err != nil || user == nil {
		// Check if this is Epic's SCOPE_CONSENT error
		if err != nil && strings.HasPrefix(err.Error(), "SCOPE_CONSENT_REQUIRED:") {
			continuationURL := strings.TrimPrefix(err.Error(), "SCOPE_CONSENT_REQUIRED:")
			log.Printf("Epic requires scope consent, redirecting to: %s", continuationURL)
			c.Redirect(nethttp.StatusFound, continuationURL)
			return
		}

		log.Printf("HandleCallback error for provider %s: %v", provider, err)
		c.JSON(nethttp.StatusUnauthorized, gin.H{"error": "provider login failed"})
		return
	}

	// If we have an existing user ID, use that instead of the newly created one
	if existingUserID > 0 {
		existingUser, err := h.Users.GetByID(c.Request.Context(), existingUserID)
		if err == nil && existingUser != nil {
			log.Printf("Using existing user %d instead of %d for %s link", existingUserID, user.ID, provider)
			user = existingUser
		}
	}

	// Save store account to library repository if we have library service
	if h.Library != nil && storeInfo != nil {
		// Encrypt tokens
		log.Printf("DEBUG: Encrypting access token for %s, token length: %d", provider, len(storeInfo.AccessToken))
		accessTokenEnc, err := h.Encryptor.Encrypt([]byte(storeInfo.AccessToken))
		if err != nil {
			log.Printf("Failed to encrypt access token: %v", err)
		} else {
			log.Printf("DEBUG: Encrypted token length: %d bytes", len(accessTokenEnc))
			var refreshTokenEnc []byte
			if storeInfo.RefreshToken != "" {
				refreshTokenEnc, err = h.Encryptor.Encrypt([]byte(storeInfo.RefreshToken))
				if err != nil {
					log.Printf("Failed to encrypt refresh token: %v", err)
				}
			}

			// Save store account
			expiresAt := &storeInfo.ExpiresAt
			if storeInfo.ExpiresAt.IsZero() {
				expiresAt = nil
			}

			account := &models.UserStoreAccount{
				UserID:         user.ID,
				Store:          provider,
				StoreUserID:    storeInfo.StoreUserID,
				DisplayName:    storeInfo.DisplayName,
				AccessToken:    accessTokenEnc,
				RefreshToken:   refreshTokenEnc,
				TokenExpiresAt: expiresAt,
				IsConnected:    true,
				AutoImport:     true,
			}

			err = h.Library.SaveStoreAccount(c.Request.Context(), account)
			if err != nil {
				log.Printf("Failed to save store account for %s: %v", provider, err)
			} else {
				log.Printf("Successfully saved store account for %s (user %d)", provider, user.ID)
			}
		}
	}

	token, err := h.JWT.GenerateToken(user.ID)
	if err != nil {
		c.JSON(nethttp.StatusInternalServerError, gin.H{"error": "could not create token"})
		return
	}

	// Return HTML page that auto-redirects to Tauri app
	// The Tauri app listens on localhost:1420 and can receive the token
	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <title>Login Success - Redirecting...</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            backdrop-filter: blur(10px);
            max-width: 600px;
            margin: 1rem;
        }
        h1 { margin: 0 0 1rem 0; font-size: 2rem; }
        .success { font-size: 4rem; margin-bottom: 1rem; }
        .info { margin: 1rem 0; font-size: 1.1rem; line-height: 1.6; }
        .token-box {
            margin: 1.5rem 0;
            padding: 1rem;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 8px;
            word-break: break-all;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
            position: relative;
        }
        .copy-btn {
            margin-top: 1rem;
            padding: 0.75rem 2rem;
            background: white;
            color: #667eea;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.2s;
        }
        .copy-btn:hover { transform: scale(1.05); }
        .copy-btn:active { transform: scale(0.95); }
        .steps {
            margin-top: 1.5rem;
            text-align: left;
            background: rgba(0, 0, 0, 0.2);
            padding: 1rem;
            border-radius: 8px;
        }
        .steps ol { margin: 0.5rem 0; padding-left: 1.5rem; }
        .steps li { margin: 0.5rem 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="success">✓</div>
        <h1>Login Successful!</h1>
        <p class="info">You've successfully logged in with <strong>%s</strong></p>
        
        <div class="token-box" id="tokenBox">%s</div>
        <button class="copy-btn" onclick="copyToken()">📋 Copy Token</button>
        
        <div class="steps">
            <strong>Next steps:</strong>
            <ol>
                <li>Click "Copy Token" above</li>
                <li>Go back to the AIO Game Library app</li>
                <li>Paste the token in the "Manual Token Entry" box</li>
                <li>Click "Login with Token"</li>
                <li>You can close this window</li>
            </ol>
        </div>
    </div>
    
    <script>
        const token = '%s';
        const store = '%s';
        
        function copyToken() {
            navigator.clipboard.writeText(token).then(() => {
                const btn = document.querySelector('.copy-btn');
                btn.textContent = '✓ Copied!';
                btn.style.background = '#27ae60';
                btn.style.color = 'white';
                setTimeout(() => {
                    btn.textContent = '📋 Copy Token';
                    btn.style.background = 'white';
                    btn.style.color = '#667eea';
                }, 2000);
            });
        }

        // Auto-redirect to Tauri app via deep link protocol
        window.onload = function() {
            // Try deep link first (desktop app)
            setTimeout(() => {
                window.location.href = 'aio://auth-callback?token=' + encodeURIComponent(token) + '&store=' + encodeURIComponent(store);
                
                // Fallback to localhost after 2 seconds if deep link fails (development mode)
                setTimeout(() => {
                    if (document.visibilityState === 'visible') {
                        window.location.href = 'http://localhost:1420/#/auth-success?token=' + encodeURIComponent(token) + '&store=' + encodeURIComponent(store);
                    }
                }, 2000);
            }, 500);
        };
    </script>
</body>
</html>`, token, storeInfo.Store, token, storeInfo.Store)

	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(nethttp.StatusOK, html)
}

func generateRandomState(numBytes int) string {
	if numBytes <= 0 {
		numBytes = 32
	}

	buf := make([]byte, numBytes)
	if _, err := io.ReadFull(rand.Reader, buf); err != nil {
		log.Printf("failed to generate random state: %v", err)
		return "state"
	}

	return base64.RawURLEncoding.EncodeToString(buf)
}
