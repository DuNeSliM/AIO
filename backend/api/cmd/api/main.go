package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	httpapi "gamedivers.de/api/internal/adapters/http"
	"gamedivers.de/api/internal/adapters/http/handlers"
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

	// Initialize game handler
	gameHandler := &handlers.GameHandler{
		Repo: nil, // TODO: Inject repo dependency
	}

	// Initialize Steam handler
	steamHandler := handlers.NewSteamHandler(
		cfg.SteamAPIKey,
		cfg.SteamCallbackURL,
		nil, // TODO: Inject repo dependency
	)

	// Initialize Epic Games handler
	epicHandler := handlers.NewEpicHandler(
		cfg.EpicClientID,
		cfg.EpicClientSecret,
		cfg.EpicCallbackURL,
	)

	router := httpapi.Router(itadHandler, gameHandler, steamHandler, epicHandler)

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
