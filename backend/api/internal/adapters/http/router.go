package httpapi

import (
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"golang.org/x/time/rate"

	"gamedivers.de/api/internal/adapters/http/handlers"
	authmw "gamedivers.de/api/internal/adapters/http/middleware"
)

func Router(frontendOrigin string, itadh *handlers.ITADHandler, gameHandler *handlers.GameHandler, steamHandler *handlers.SteamHandler, epicHandler *handlers.EpicHandler, authh *handlers.AuthHandler, jwtMw *authmw.JWTMiddleware) *chi.Mux {
	r := chi.NewRouter()
	r.Use(middleware.RealIP)
	r.Use(middleware.RequestID)
	r.Use(requestLogMiddleware)
	r.Use(middleware.Recoverer)

	allowedOrigins := map[string]struct{}{}
	if normalized := normalizeOrigin(frontendOrigin); normalized != "" {
		allowedOrigins[normalized] = struct{}{}
	}
	sensitiveAuthLimiter := authmw.NewIPRateLimiter(rate.Every(12*time.Second), 5, 15*time.Minute)
	tokenAuthLimiter := authmw.NewIPRateLimiter(rate.Every(time.Second), 20, 15*time.Minute)

	// CORS middleware for frontend
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rawOrigin := r.Header.Get("Origin")
			if rawOrigin == "" {
				next.ServeHTTP(w, r)
				return
			}

			origin := normalizeOrigin(rawOrigin)
			if _, ok := allowedOrigins[origin]; ok || isLocalOrigin(origin) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type")

			if r.Method == http.MethodOptions {
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
		// Game endpoints: keep a single mount path to avoid chi route collisions
		r.Route("/games", func(r chi.Router) {
			r.Get("/installed", gameHandler.GetInstalledGames)

			// Authenticated launch endpoints
			r.With(jwtMw.Authenticate).Post("/steam/{appid}/start", gameHandler.StartSteamGame)
			r.With(jwtMw.Authenticate).Post("/epic/{appname}/start", gameHandler.StartEpicGame)
			r.With(jwtMw.Authenticate).Post("/gog/{gamename}/start", gameHandler.StartGOGGame)

			// Authenticated local library endpoints
			r.With(jwtMw.Authenticate).Get("/steam/library", gameHandler.GetSteamLibrary)
			r.With(jwtMw.Authenticate).Get("/epic/library", gameHandler.GetEpicLibrary)
			r.With(jwtMw.Authenticate).Get("/gog/library", gameHandler.GetGOGLibrary)
		})

		// Public auth endpoints (no authentication required)
		r.Route("/auth", func(r chi.Router) {
			r.With(sensitiveAuthLimiter.Middleware).Post("/register", authh.Register)
			r.With(sensitiveAuthLimiter.Middleware).Post("/login", authh.Login)
			r.With(tokenAuthLimiter.Middleware).Post("/refresh", authh.RefreshToken)
			r.With(tokenAuthLimiter.Middleware).Post("/logout", authh.Logout)
			r.With(sensitiveAuthLimiter.Middleware).Post("/forgot-password", authh.ForgotPassword)
			r.With(sensitiveAuthLimiter.Middleware).Post("/resend-verification", authh.ResendVerification)

			// Protected auth endpoint
			r.Group(func(r chi.Router) {
				r.Use(jwtMw.Authenticate)
				r.Get("/me", authh.GetMe)
				r.Put("/password", authh.ChangePassword)
				r.Put("/profile", authh.UpdateProfile)
			})
		})

		// Steam endpoints
		r.Route("/steam", func(r chi.Router) {
			r.Get("/login", steamHandler.LoginRedirect)
			r.Get("/callback", steamHandler.Callback)

			// Authenticated Steam endpoints
			r.With(jwtMw.Authenticate).Get("/library", steamHandler.GetLibrary)
			r.With(jwtMw.Authenticate).Get("/wishlist", steamHandler.GetWishlist)
			r.With(jwtMw.Authenticate).Post("/wishlist/sync", steamHandler.SyncWishlistToWatchlist)
			r.With(jwtMw.Authenticate).Post("/sync", steamHandler.SyncLibrary)
		})

		// Epic endpoints
		r.Route("/epic", func(r chi.Router) {
			r.Get("/login", epicHandler.LoginRedirect)
			r.Get("/callback", epicHandler.Callback)

			// Authenticated Epic endpoints
			r.With(jwtMw.Authenticate).Get("/library", epicHandler.GetLibrary)
			r.With(jwtMw.Authenticate).Post("/sync", epicHandler.SyncLibrary)
		})

		// Protected API endpoints (authentication required)
		r.Group(func(r chi.Router) {
			r.Use(jwtMw.Authenticate)

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
					r.Get("/historylow", itadh.GetHistoricalLow)
				})
			})

		})
	})

	return r
}

func normalizeOrigin(origin string) string {
	u, err := url.Parse(strings.TrimSpace(origin))
	if err != nil || u.Scheme == "" || u.Host == "" {
		return ""
	}
	return strings.ToLower(u.Scheme) + "://" + strings.ToLower(u.Host)
}

func isLocalOrigin(origin string) bool {
	u, err := url.Parse(strings.TrimSpace(origin))
	if err != nil {
		return false
	}
	switch strings.ToLower(u.Hostname()) {
	case "localhost", "127.0.0.1", "::1":
		return true
	default:
		return false
	}
}
