package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"gamedivers.de/api/internal/adapters/http/handlers"
)

func Router(ph *handlers.PriceHandler) *chi.Mux {
	r := chi.NewRouter()
	r.Use(middleware.RealIP)
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Route("/v1", func(r chi.Router) {
		r.Get("/steam/apps/{appid}/price", ph.GetSteamDEPrice)

		r.Post("/users/{userId}/watchlist/steam/{appid}", ph.AddSteamWatch)
		r.Delete("/users/{userId}/watchlist/steam/{appid}", ph.RemoveSteamWatch)
	})

	return r
}
