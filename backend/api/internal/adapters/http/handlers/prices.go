package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"gamedivers.de/api/internal/core/service"
	"gamedivers.de/api/internal/ports/repo"
)

type PriceHandler struct {
	Pricing *service.PricingService
	Repo    repo.Repo
}

func (h *PriceHandler) GetSteamDEPrice(w http.ResponseWriter, r *http.Request) {
	appid := chi.URLParam(r, "appid")
	if appid == "" {
		http.Error(w, "missing appid", http.StatusBadRequest)
		return
	}

	force := r.URL.Query().Get("refresh") == "1"

	if err := h.Pricing.EnsureSteamDEPriceFresh(r.Context(), appid, force); err != nil {
		logSafeError("ensure steam price failed", err)
		writeBadGateway(w)
		return
	}

	row, found, err := h.Repo.GetPriceRow(r.Context(), "steam", appid, "de")
	if err != nil {
		logSafeError("get price row failed", err)
		writeInternalError(w)
		return
	}

	if !found {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"store_id":         "steam",
			"external_game_id": appid,
			"cc":               "de",
			"note":             "no price data available",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(row)
}
func (h *PriceHandler) TrackSteamApp(w http.ResponseWriter, r *http.Request) {
	appid := chi.URLParam(r, "appid")
	if appid == "" {
		http.Error(w, "missing appid", http.StatusBadRequest)
		return
	}

	now := time.Now().Unix()
	if err := h.Repo.TrackGame(r.Context(), "steam", appid, "de", now); err != nil {
		logSafeError("track steam app failed", err)
		writeInternalError(w)
		return
	}

	if r.URL.Query().Get("prefetch") == "1" {
		_ = h.Pricing.EnsureSteamDEPriceFresh(r.Context(), appid, true)
	}

	w.WriteHeader(http.StatusNoContent)
}
