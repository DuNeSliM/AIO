package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"gamedivers.de/api/internal/adapters/auth/keycloak"
	"gamedivers.de/api/internal/adapters/db/postgres"
	httpapi "gamedivers.de/api/internal/adapters/http"
	"gamedivers.de/api/internal/adapters/http/handlers"
	"gamedivers.de/api/internal/adapters/http/middleware"
	"gamedivers.de/api/internal/adapters/stores/itad"
	"gamedivers.de/api/internal/config"
	"gamedivers.de/api/internal/migrate"
	"gamedivers.de/api/internal/ports/repo"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load("../.env")
	_ = godotenv.Load("./.env")
	_ = godotenv.Load("../../../.env")

	cfg := config.Load()

	var appRepo repo.Repo
	if strings.TrimSpace(cfg.DatabaseURL) != "" {
		db, err := postgres.Open(cfg.DatabaseURL)
		if err != nil {
			log.Fatalf("database connect failed: %v", err)
		}

		migrateCtx, migrateCancel := context.WithTimeout(context.Background(), 30*time.Second)
		err = migrate.Run(migrateCtx, db)
		migrateCancel()
		if err != nil {
			_ = db.Close()
			log.Fatalf("database migration failed: %v", err)
		}

		appRepo = &postgres.Repo{DB: db}
		defer func() {
			_ = db.Close()
		}()
		log.Printf("database connected and migrations applied")
	} else {
		log.Printf("DATABASE_URL not set, running without persistence")
	}

	// Initialize ITAD client with API key
	itadClient := itad.New(cfg.ITADAPIKey)
	itadHandler := &handlers.ITADHandler{
		Client: itadClient,
	}

	// Initialize game handler
	gameHandler := &handlers.GameHandler{
		Repo: appRepo,
	}

	// Initialize Steam handler
	steamHandler := handlers.NewSteamHandler(
		cfg.SteamAPIKey,
		cfg.SteamCallbackURL,
		cfg.FrontendOrigin,
		appRepo,
	)

	// Initialize Epic Games handler
	epicHandler := handlers.NewEpicHandler(
		cfg.EpicClientID,
		cfg.EpicClientSecret,
		cfg.EpicCallbackURL,
		cfg.FrontendOrigin,
	)

	// Initialize Keycloak client
	keycloakClient := keycloak.NewClient(
		cfg.KeycloakURL,
		cfg.KeycloakRealm,
		cfg.KeycloakClientID,
		cfg.KeycloakClientSecret,
		cfg.KeycloakRequireEmailVerified,
	)

	// Initialize auth handler
	authHandler := &handlers.AuthHandler{
		Keycloak: keycloakClient,
		Repo:     appRepo,
	}

	// Initialize JWT middleware for token validation
	jwtMiddleware := middleware.NewJWTMiddleware(
		keycloakClient.GetJWKSURL(),
		keycloakClient.GetIssuer(),
		cfg.KeycloakClientID,
	)

	router := httpapi.Router(cfg.FrontendOrigin, itadHandler, gameHandler, steamHandler, epicHandler, authHandler, jwtMiddleware)

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
