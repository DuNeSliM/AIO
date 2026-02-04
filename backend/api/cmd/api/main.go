package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gamedivers.de/api/internal/adapters/auth/keycloak"
	httpapi "gamedivers.de/api/internal/adapters/http"
	"gamedivers.de/api/internal/adapters/http/handlers"
	"gamedivers.de/api/internal/adapters/http/middleware"
	"gamedivers.de/api/internal/adapters/stores/itad"
	"gamedivers.de/api/internal/config"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	_ = godotenv.Load("../../.env")

	cfg := config.Load()

	// Initialize ITAD client with API key
	itadClient := itad.New(cfg.ITADAPIKey)
	itadHandler := &handlers.ITADHandler{
		Client: itadClient,
	}

	// Initialize Keycloak client
	keycloakClient := keycloak.NewClient(
		cfg.KeycloakURL,
		cfg.KeycloakRealm,
		cfg.KeycloakClientID,
		cfg.KeycloakClientSecret,
	)

	// Initialize auth handler (repo is nil for now, can be wired later)
	authHandler := &handlers.AuthHandler{
		Keycloak: keycloakClient,
		Repo:     nil, // Wire up repo if you want to persist users locally
	}

	// Initialize JWT middleware for token validation
	jwtMiddleware := middleware.NewJWTMiddleware(
		keycloakClient.GetJWKSURL(),
		keycloakClient.GetIssuer(),
		cfg.KeycloakClientID,
	)

	router := httpapi.Router(itadHandler, authHandler, jwtMiddleware)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh
	log.Printf("shutting down...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = srv.Shutdown(shutdownCtx)
}
