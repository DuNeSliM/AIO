package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"

	"gamedivers.de/api/internal/adapters/http/handlers"
	"gamedivers.de/api/internal/adapters/http/middleware"
)

func Router(itadh *handlers.ITADHandler, authMw *middleware.AuthMiddleware) *chi.Mux {
	r := chi.NewRouter()
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)

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
		// Auth endpoints (protected)
		authHandler := handlers.NewAuthHandler()
		r.Route("/auth", func(r chi.Router) {
			r.Use(authMw.Authenticate)
			r.Get("/me", authHandler.GetMe)
		})

		// IsThereAnyDeal endpoints - protected by auth
		r.Route("/itad", func(r chi.Router) {
			r.Use(authMw.Authenticate)

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
				r.Get("/historylow", itadh.GetHistoricalLow)
			})
		})
	})

	return r
}
