package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"gamedivers.de/api/internal/adapters/auth/keycloak"
	"gamedivers.de/api/internal/adapters/http/middleware"
	"gamedivers.de/api/internal/ports/repo"
)

// AuthHandler handles authentication-related HTTP requests
type AuthHandler struct {
	Keycloak *keycloak.Client
	Repo     repo.UserRepo
}

// RegisterRequest represents the registration request body
type RegisterRequest struct {
	Username  string `json:"username"`
	Email     string `json:"email"`
	Password  string `json:"password"`
	FirstName string `json:"firstName,omitempty"`
	LastName  string `json:"lastName,omitempty"`
}

// LoginRequest represents the login request body
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// RefreshTokenRequest represents the token refresh request body
type RefreshTokenRequest struct {
	RefreshToken string `json:"refreshToken"`
}

// LogoutRequest represents the logout request body
type LogoutRequest struct {
	RefreshToken string `json:"refreshToken"`
}

// AuthResponse represents the authentication response
type AuthResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresIn    int    `json:"expiresIn"`
	TokenType    string `json:"tokenType"`
}

// UserResponse represents the user info response
type UserResponse struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	FirstName string `json:"firstName,omitempty"`
	LastName  string `json:"lastName,omitempty"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// Register handles user registration
// POST /v1/auth/register
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	// Validate required fields
	if req.Username == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Username is required")
		return
	}
	if req.Email == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Email is required")
		return
	}
	if req.Password == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Password is required")
		return
	}

	// Validate password strength (minimum 8 characters)
	if len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "validation_error", "Password must be at least 8 characters")
		return
	}

	// Register user in Keycloak
	kcUser, err := h.Keycloak.Register(r.Context(), keycloak.RegisterRequest{
		Username:  req.Username,
		Email:     req.Email,
		Password:  req.Password,
		FirstName: req.FirstName,
		LastName:  req.LastName,
	})
	if err != nil {
		if strings.Contains(err.Error(), "already exists") {
			writeError(w, http.StatusConflict, "user_exists", "User already exists")
			return
		}
		writeError(w, http.StatusBadGateway, "keycloak_error", err.Error())
		return
	}

	// Create user in our database (linked to Keycloak ID)
	if h.Repo != nil {
		if err := h.Repo.UpsertUser(r.Context(), kcUser.ID, time.Now().Unix()); err != nil {
			// Log error but don't fail - user is created in Keycloak
			// In production, you might want to rollback or queue for retry
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(UserResponse{
		ID:        kcUser.ID,
		Username:  kcUser.Username,
		Email:     kcUser.Email,
		FirstName: kcUser.FirstName,
		LastName:  kcUser.LastName,
	})
}

// Login handles user authentication
// POST /v1/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.Username == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Username and password are required")
		return
	}

	tokens, err := h.Keycloak.Login(r.Context(), keycloak.LoginRequest{
		Username: req.Username,
		Password: req.Password,
	})
	if err != nil {
		if strings.Contains(err.Error(), "invalid username or password") {
			writeError(w, http.StatusUnauthorized, "invalid_credentials", "Invalid username or password")
			return
		}
		writeError(w, http.StatusBadGateway, "keycloak_error", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AuthResponse{
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresIn:    tokens.ExpiresIn,
		TokenType:    tokens.TokenType,
	})
}

// RefreshToken handles token refresh
// POST /v1/auth/refresh
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.RefreshToken == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Refresh token is required")
		return
	}

	tokens, err := h.Keycloak.RefreshToken(r.Context(), req.RefreshToken)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_token", "Invalid or expired refresh token")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AuthResponse{
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresIn:    tokens.ExpiresIn,
		TokenType:    tokens.TokenType,
	})
}

// Logout handles user logout (invalidates tokens)
// POST /v1/auth/logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var req LogoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.RefreshToken == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Refresh token is required")
		return
	}

	if err := h.Keycloak.Logout(r.Context(), req.RefreshToken); err != nil {
		// Don't fail on logout errors, just log them
		// The client will discard the tokens anyway
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetMe returns the current authenticated user's info
// GET /v1/auth/me
func (h *AuthHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(UserResponse{
		ID:        user.ID,
		Username:  user.Username,
		Email:     user.Email,
		FirstName: user.FirstName,
		LastName:  user.LastName,
	})
}

// ChangePasswordRequest represents the password change request body
type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

// UpdateProfileRequest represents the profile update request body
type UpdateProfileRequest struct {
	Email     string `json:"email,omitempty"`
	FirstName string `json:"firstName,omitempty"`
	LastName  string `json:"lastName,omitempty"`
}

// ChangePassword handles password change for authenticated users
// PUT /v1/auth/password
func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.CurrentPassword == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Current password is required")
		return
	}
	if req.NewPassword == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "New password is required")
		return
	}
	if len(req.NewPassword) < 8 {
		writeError(w, http.StatusBadRequest, "validation_error", "New password must be at least 8 characters")
		return
	}

	err := h.Keycloak.ChangePassword(r.Context(), user.ID, req.CurrentPassword, req.NewPassword)
	if err != nil {
		if strings.Contains(err.Error(), "incorrect") {
			writeError(w, http.StatusBadRequest, "invalid_password", "Current password is incorrect")
			return
		}
		writeError(w, http.StatusBadGateway, "keycloak_error", err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// UpdateProfile handles profile updates for authenticated users
// PUT /v1/auth/profile
func (h *AuthHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	// At least one field should be provided
	if req.Email == "" && req.FirstName == "" && req.LastName == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "At least one field to update is required")
		return
	}

	updatedUser, err := h.Keycloak.UpdateProfile(r.Context(), user.ID, keycloak.UpdateProfileRequest{
		Email:     req.Email,
		FirstName: req.FirstName,
		LastName:  req.LastName,
	})
	if err != nil {
		writeError(w, http.StatusBadGateway, "keycloak_error", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(UserResponse{
		ID:        updatedUser.ID,
		Username:  updatedUser.Username,
		Email:     updatedUser.Email,
		FirstName: updatedUser.FirstName,
		LastName:  updatedUser.LastName,
	})
}

// ForgotPasswordRequest represents the forgot password request body
type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

// ResendVerificationRequest represents the resend verification request body
type ResendVerificationRequest struct {
	Email string `json:"email"`
}

// ForgotPassword sends a password reset email
// POST /v1/auth/forgot-password
func (h *AuthHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req ForgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.Email == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Email is required")
		return
	}

	// Send password reset email
	// Note: We don't reveal whether the email exists or not for security
	_ = h.Keycloak.SendPasswordResetEmail(r.Context(), req.Email)

	// Always return success to prevent email enumeration attacks
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "If an account with that email exists, a password reset link has been sent.",
	})
}

// ResendVerification resends the email verification link
// POST /v1/auth/resend-verification
func (h *AuthHandler) ResendVerification(w http.ResponseWriter, r *http.Request) {
	var req ResendVerificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.Email == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Email is required")
		return
	}

	// Resend verification email
	_ = h.Keycloak.ResendVerificationEmail(r.Context(), req.Email)

	// Always return success to prevent email enumeration attacks
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "If an account with that email exists and is not verified, a verification link has been sent.",
	})
}

func writeError(w http.ResponseWriter, status int, errorCode, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(ErrorResponse{
		Error:   errorCode,
		Message: message,
	})
}
