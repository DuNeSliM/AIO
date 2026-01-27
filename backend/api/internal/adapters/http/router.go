package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"gamedivers.de/api/internal/adapters/http/handlers"
)

func Router(itadh *handlers.ITADHandler, gameHandler *handlers.GameHandler) *chi.Mux {
	r := chi.NewRouter()
	r.Use(middleware.RealIP)
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// CORS middleware for frontend
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type")

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}

			next.ServeHTTP(w, r)
		})
	})

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Route("/v1", func(r chi.Router) {
		// IsThereAnyDeal endpoints - provides prices from all stores including Steam
		r.Route("/itad", func(r chi.Router) {
			// Search for games
			r.Get("/search", itadh.Search)

			// Get all available stores
			r.Get("/stores", itadh.GetStores)

			// Get price overview for multiple games
			r.Get("/overview", itadh.GetOverview)

			// Game-specific endpoints
			r.Route("/games/{gameId}", func(r chi.Router) {
				// Get combined game details (info + prices + history)
				r.Get("/", itadh.GetGameDetails)

				// Get just game info
				r.Get("/info", itadh.GetGameInfo)

				// Get current prices across stores
				r.Get("/prices", itadh.GetGamePrices)

				// Get historical lowest price
				r.Get("/historylow", itadh.GetHistoricalLow)				curl -X POST http://localhost:8080/v1/games/epic/Bloons%20TD%206/start
			})
		})

		// Game launch endpoints
		r.Route("/games", func(r chi.Router) {
			// Start a Steam game by app ID
			r.Post("/steam/{appid}/start", gameHandler.StartSteamGame)

			// Start an Epic Games game by app name
			r.Post("/epic/{appname}/start", gameHandler.StartEpicGame)

			// Get installed/synced games
			r.Get("/installed", gameHandler.GetInstalledGames)

			// Get Steam library (placeholder)
			r.Get("/steam/library", gameHandler.GetSteamLibrary)

			// Get Epic Games library (placeholder)
			r.Get("/epic/library", gameHandler.GetEpicLibrary)
		})
	})

	return r
}
