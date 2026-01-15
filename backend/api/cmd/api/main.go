package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gamedivers.de/api/internal/adapters/db/sqlite"
	"gamedivers.de/api/internal/adapters/http"
	"gamedivers.de/api/internal/adapters/http/handlers"
	"gamedivers.de/api/internal/adapters/stores/steam"
	"gamedivers.de/api/internal/config"
	"gamedivers.de/api/internal/core/service"
	"gamedivers.de/api/internal/jobs"
	"gamedivers.de/api/internal/migrate"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	cfg := config.Load()

	db, err := sqlite.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := migrate.Run(ctx, db); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	repo := &sqlite.Repo{DB: db}
	steamClient := steam.New()

	pricing := &service.PricingService{
		Repo:    repo,
		Steam:   steamClient,
		TTL:     cfg.PriceTTL,
		NowUnix: func() int64 { return time.Now().Unix() },
	}

	priceHandler := &handlers.PriceHandler{
		Pricing: pricing,
		Repo:    repo,
	}

	router := httpapi.Router(priceHandler)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	updater := &jobs.DailyUpdater{
		Repo:     repo,
		Pricing:  pricing,
		Interval: cfg.DailyInterval,
		Batch:    5000,
	}
	go updater.Run(ctx)

	go func() {
		log.Printf("listening on :%s (db=%s)", cfg.Port, cfg.DBPath)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh
	log.Printf("shutting down...")

	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = srv.Shutdown(shutdownCtx)
}
