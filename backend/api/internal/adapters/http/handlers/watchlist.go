package handlers

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

func (h *PriceHandler) AddSteamWatch(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")
	appid := chi.URLParam(r, "appid")
	if userID == "" || appid == "" {
		http.Error(w, "missing userId or appid", http.StatusBadRequest)
		return
	}

	now := time.Now().Unix()

	if err := h.Repo.UpsertUser(r.Context(), userID, now); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := h.Repo.AddWatch(r.Context(), userID, "steam", appid, "de", now); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := h.Repo.TrackGame(r.Context(), "steam", appid, "de", now); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if r.URL.Query().Get("prefetch") == "1" {
		if err := h.Pricing.EnsureSteamDEPriceFresh(r.Context(), appid, true); err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PriceHandler) RemoveSteamWatch(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")
	appid := chi.URLParam(r, "appid")
	if userID == "" || appid == "" {
		http.Error(w, "missing userId or appid", http.StatusBadRequest)
		return
	}

	if err := h.Repo.RemoveWatch(r.Context(), userID, "steam", appid, "de"); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
