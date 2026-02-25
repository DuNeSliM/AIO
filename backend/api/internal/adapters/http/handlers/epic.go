package handlers

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	authmw "gamedivers.de/api/internal/adapters/http/middleware"
	"gamedivers.de/api/internal/adapters/stores/epic"
	"gamedivers.de/api/internal/ports/repo"
	"github.com/go-chi/chi/v5"
)

type EpicHandler struct {
	client          *epic.Client
	repo            repo.Repo
	allowedRedirect string
}

type EpicGameResponse struct {
	ID        string `json:"id"`
	AppName   string `json:"appName"`
	Name      string `json:"name"`
	Platform  string `json:"platform"`
	Image     string `json:"image,omitempty"`
	Namespace string `json:"namespace"`
}

func NewEpicHandler(clientID, clientSecret, redirectURI, frontendOrigin string, repo repo.Repo) *EpicHandler {
	return &EpicHandler{
		client:          epic.NewClient(clientID, clientSecret, redirectURI),
		repo:            repo,
		allowedRedirect: frontendOrigin,
	}
}

func (h *EpicHandler) LoginRedirect(w http.ResponseWriter, r *http.Request) {
	state, err := newEpicStateToken()
	if err != nil {
		http.Error(w, "state generation failed", http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "epic_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   isSecureRequest(r),
	})

	loginURL := h.client.GetLoginURL(state)

	http.Redirect(w, r, loginURL, http.StatusTemporaryRedirect)
}

func (h *EpicHandler) Callback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	if code == "" {
		http.Error(w, "missing code parameter", http.StatusBadRequest)
		return
	}

	if err := h.verifyState(r, state); err != nil {
		http.Error(w, "invalid state", http.StatusBadRequest)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "epic_state",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   isSecureRequest(r),
		MaxAge:   -1,
	})

	tokenResp, err := h.client.ExchangeCode(r.Context(), code)
	if err != nil {
		logSafeError("epic token exchange failed", err)
		http.Error(w, "authentication failed", http.StatusInternalServerError)
		return
	}

	accountInfo, err := h.client.GetAccountInfo(r.Context(), tokenResp.AccessToken)
	if err != nil {
		logSafeError("epic account info fetch failed", err)
		http.Error(w, "failed to get account info", http.StatusInternalServerError)
		return
	}

	displayName := "EpicUser"
	if name, ok := accountInfo["displayName"].(string); ok && name != "" {
		displayName = name
	}

	redirectBase := h.allowedRedirect
	if redirectBase == "" {
		redirectBase = requestScheme(r) + "://" + r.Host
	}
	allowedRedirect := h.allowedRedirect
	if allowedRedirect == "" {
		allowedRedirect = redirectBase
	}
	redirectURL, err := safeRedirect(redirectBase, allowedRedirect, map[string]string{
		"epicid":       tokenResp.AccountID,
		"username":     displayName,
		"access_token": tokenResp.AccessToken,
	})
	if err != nil {
		http.Error(w, "invalid redirect", http.StatusBadRequest)
		return
	}

	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

func (h *EpicHandler) GetLibrary(w http.ResponseWriter, r *http.Request) {
	accessToken := extractBearerToken(r)
	if accessToken == "" {
		http.Error(w, "missing access token", http.StatusBadRequest)
		return
	}

	games, err := h.client.GetLibrary(r.Context(), accessToken)
	if err != nil {
		logSafeError("epic library fetch failed", err)
		http.Error(w, "failed to fetch library", http.StatusInternalServerError)
		return
	}

	response := make([]EpicGameResponse, 0, len(games))
	for _, game := range games {
		response = append(response, EpicGameResponse{
			ID:        game.CatalogItemID,
			AppName:   game.AppName,
			Name:      game.Title,
			Platform:  "epic",
			Namespace: game.Namespace,
			Image:     "", // Epic doesn't provide images in library API by default
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *EpicHandler) SyncLibrary(w http.ResponseWriter, r *http.Request) {
	user, ok := authmw.GetUserFromContext(r.Context())
	if !ok || strings.TrimSpace(user.ID) == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	accessToken := extractBearerToken(r)
	if accessToken == "" {
		http.Error(w, "missing access token", http.StatusBadRequest)
		return
	}

	if h.repo == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	games, err := h.client.GetLibrary(r.Context(), accessToken)
	if err != nil {
		logSafeError("epic sync failed", err)
		http.Error(w, "sync failed", http.StatusInternalServerError)
		return
	}

	now := time.Now().Unix()
	if err := h.repo.UpsertUser(r.Context(), user.ID, now); err != nil {
		logSafeError("upsert user failed during epic library sync", err)
		writeInternalError(w)
		return
	}

	// Store games in database
	synced := 0
	for _, game := range games {
		gameIDStr := game.AppName
		if err := h.repo.TrackGame(r.Context(), "epic", gameIDStr, "de", now); err != nil {
			logSafeError("track game failed during epic library sync", err)
			continue
		}
		synced++
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"synced":  synced,
		"status":  "success",
		"message": "",
	})
}

func (h *EpicHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/login", h.LoginRedirect)
	r.Get("/callback", h.Callback)
	r.Get("/library", h.GetLibrary)
	r.Post("/sync", h.SyncLibrary)
	return r
}

// --- helpers ---

func newEpicStateToken() (string, error) {
	var buf [32]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf[:]), nil
}

func (h *EpicHandler) verifyState(r *http.Request, state string) error {
	if state == "" {
		return errors.New("empty state")
	}
	cookie, err := r.Cookie("epic_state")
	if err != nil {
		return err
	}
	if subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(state)) != 1 {
		return errors.New("state mismatch")
	}
	return nil
}

func safeRedirect(base, allowedBase string, params map[string]string) (string, error) {
	u, err := url.Parse(base)
	if err != nil {
		return "", err
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "", errors.New("invalid scheme")
	}
	if u.Host == "" {
		return "", errors.New("empty host")
	}

	allowedURL, err := url.Parse(allowedBase)
	if err != nil {
		return "", err
	}
	if allowedURL.Scheme != "http" && allowedURL.Scheme != "https" {
		return "", errors.New("invalid allowed scheme")
	}
	if allowedURL.Host == "" {
		return "", errors.New("empty allowed host")
	}
	if !strings.EqualFold(u.Host, allowedURL.Host) {
		return "", errors.New("untrusted host")
	}

	fragment := url.Values{}
	for k, v := range params {
		fragment.Set(k, v)
	}
	u.RawFragment = fragment.Encode()
	return u.String(), nil
}

func extractBearerToken(r *http.Request) string {
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if authHeader == "" {
		return ""
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}
