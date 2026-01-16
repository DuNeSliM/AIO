package service

import (
	"context"
	"time"

	"gamedivers.de/api/internal/ports/repo"
	"gamedivers.de/api/internal/ports/store"
)

type PricingService struct {
	Repo    repo.Repo
	Steam   store.StoreClient
	TTL     time.Duration
	NowUnix func() int64
}

func (s *PricingService) EnsureSteamDEPriceFresh(ctx context.Context, appid string, force bool) error {
	now := s.NowUnix()

	if err := s.Repo.TrackGame(ctx, "steam", appid, "de", now); err != nil {
		return err
	}

	fetchedAt, found, err := s.Repo.GetPriceFetchedAt(ctx, "steam", appid, "de")
	if err != nil {
		return err
	}

	if !force && found {
		if time.Since(time.Unix(fetchedAt, 0)) < s.TTL {
			return nil
		}
	}

	price, name, err := s.Steam.FetchDEPrice(ctx, appid)
	if err != nil {
		return err
	}

	now = s.NowUnix()

	if name == "" {
		name = "Steam App " + appid
	}
	if err := s.Repo.UpsertGame(ctx, repo.UpsertGameParams{
		StoreID:        "steam",
		ExternalGameID: appid,
		Name:           name,
		Type:           "game",
		UpdatedAtUnix:  now,
	}); err != nil {
		return err
	}

	if price == nil {
		return nil
	}

	return s.Repo.UpsertPriceAndLowest(ctx, repo.UpsertPriceParams{
		StoreID:         "steam",
		ExternalGameID:  appid,
		CC:              "de",
		Currency:        price.Currency,
		InitialCents:    price.InitialCents,
		FinalCents:      price.FinalCents,
		DiscountPercent: price.DiscountPercent,
		FetchedAtUnix:   now,
	})
}
