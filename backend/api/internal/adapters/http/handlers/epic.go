package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"gamedivers.de/api/internal/adapters/stores/epic"
)

type EpicHandler struct {
	client *epic.Client
}

type EpicGameResponse struct {
	ID        string `json:"id"`
	AppName   string `json:"appName"`
	Name      string `json:"name"`
	Platform  string `json:"platform"`
	Image     string `json:"image,omitempty"`
	Namespace string `json:"namespace"`
}

func NewEpicHandler(clientID, clientSecret, redirectURI string) *EpicHandler {
	return &EpicHandler{
		client: epic.NewClient(clientID, clientSecret, redirectURI),
	}
}

func (h *EpicHandler) LoginRedirect(w http.ResponseWriter, r *http.Request) {
	returnURL := r.URL.Query().Get("return_url")
	if returnURL == "" {
		returnURL = "http://localhost:3000"
	}

	state := returnURL
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

	returnURL := state
	if returnURL == "" {
		returnURL = "http://localhost:3000"
	}

	tokenResp, err := h.client.ExchangeCode(r.Context(), code)
	if err != nil {
		log.Printf("Epic token exchange failed: %v", err)
		http.Error(w, "authentication failed", http.StatusInternalServerError)
		return
	}

	accountInfo, err := h.client.GetAccountInfo(r.Context(), tokenResp.AccessToken)
	if err != nil {
		log.Printf("Epic account info fetch failed: %v", err)
		http.Error(w, "failed to get account info", http.StatusInternalServerError)
		return
	}

	displayName := "EpicUser"
	if name, ok := accountInfo["displayName"].(string); ok && name != "" {
		displayName = name
	}

	redirectURL := returnURL + "?epicid=" + tokenResp.AccountID + "&username=" + displayName + "&access_token=" + tokenResp.AccessToken

	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

func (h *EpicHandler) GetLibrary(w http.ResponseWriter, r *http.Request) {
	accessToken := r.URL.Query().Get("access_token")
	if accessToken == "" {
		http.Error(w, "missing access_token parameter", http.StatusBadRequest)
		return
	}

	games, err := h.client.GetLibrary(r.Context(), accessToken)
	if err != nil {
		log.Printf("Epic library fetch failed: %v", err)
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
	accessToken := r.URL.Query().Get("access_token")
	if accessToken == "" {
		http.Error(w, "missing access_token parameter", http.StatusBadRequest)
		return
	}

	games, err := h.client.GetLibrary(r.Context(), accessToken)
	if err != nil {
		log.Printf("Epic sync failed: %v", err)
		http.Error(w, "sync failed", http.StatusInternalServerError)
		return
	}

	// TODO: Store in database

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"synced": len(games),
		"status": "success",
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
