package handlers

import (
	"encoding/json"
	"net/http"

	"gamedivers.de/api/internal/adapters/http/middleware"
)

// AuthHandler handles authentication-related endpoints
type AuthHandler struct{}

// NewAuthHandler creates a new auth handler
func NewAuthHandler() *AuthHandler {
	return &AuthHandler{}
}

// MeResponse represents the response for /v1/auth/me
type MeResponse struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Username      string `json:"username,omitempty"`
}

// GetMe returns the current authenticated user's info
// GET /v1/auth/me
func (h *AuthHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		http.Error(w, `{"error":"not authenticated"}`, http.StatusUnauthorized)
		return
	}

	resp := MeResponse{
		ID:            user.Sub,
		Email:         user.Email,
		EmailVerified: user.EmailVerified,
		Name:          user.Name,
		Username:      user.PreferredName,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
