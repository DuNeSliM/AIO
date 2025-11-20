// internal/http/auth_handlers.go
package http

import (
	"crypto/rand"
	"encoding/base64"
	"io"
	"log"
	nethttp "net/http"

	"github.com/gin-gonic/gin"

	"aoi/api/internal/auth"
	"aoi/api/internal/users"
)

// AuthHandlers bundles everything needed for auth-related HTTP endpoints.
type AuthHandlers struct {
	Users    users.Service
	JWT      auth.JWTService
	External auth.ExternalAuthService
}

// RegisterRoutes wires auth routes into the router group.
func (h *AuthHandlers) RegisterRoutes(r gin.IRoutes) {
	r.POST("/auth/register", h.Register)
	r.POST("/auth/login", h.LoginEmail)
	r.GET("/auth/:provider/login", h.LoginProvider)
	r.GET("/auth/:provider/callback", h.ProviderCallback)
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

	code := c.Query("code")
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

	user, err := h.External.HandleCallback(c.Request.Context(), provider, code, state)
	if err != nil || user == nil {
		log.Printf("HandleCallback error for provider %s: %v", provider, err)
		c.JSON(nethttp.StatusUnauthorized, gin.H{"error": "provider login failed"})
		return
	}

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
