package jobs

import (
	"context"
	"log"
	"time"

	"gamedivers.de/api/internal/core/service"
	"gamedivers.de/api/internal/ports/repo"
)

type DailyUpdater struct {
	Repo     repo.Repo
	Pricing  *service.PricingService
	Interval time.Duration
	Batch    int
}

func (u *DailyUpdater) Run(ctx context.Context) {
	ticker := time.NewTicker(u.Interval)
	defer ticker.Stop()

	// run once at startup
	u.runOnce(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			u.runOnce(ctx)
		}
	}
}

func (u *DailyUpdater) runOnce(ctx context.Context) {
	ids, err := u.Repo.ListWatchedUniqueGamesForRefresh(ctx, "steam", "de", u.Batch)
	if err != nil {
		log.Printf("[daily-updater] list watched unique: %v", err)
		return
	}

	log.Printf("[daily-updater] refreshing %d watched steam games", len(ids))
	for _, appid := range ids {
		if ctx.Err() != nil {
			return
		}
		if err := u.Pricing.EnsureSteamDEPriceFresh(ctx, appid, true); err != nil {
			log.Printf("[daily-updater] refresh appid=%s err=%v", appid, err)
		}
	}
}
