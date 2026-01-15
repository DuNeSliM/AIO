package store

import "context"

type Price struct {
	Currency        string
	InitialCents    int64
	FinalCents      int64
	DiscountPercent int
}

type StoreClient interface {
	StoreID() string
	FetchDEPrice(ctx context.Context, externalGameID string) (*Price, string /*name*/, error)
}
