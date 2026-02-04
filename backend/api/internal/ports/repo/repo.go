package repo

import "context"

type UpsertGameParams struct {
	StoreID        string
	ExternalGameID string
	Name           string
	Type           string
	UpdatedAtUnix  int64
}

type UpsertPriceParams struct {
	StoreID         string
	ExternalGameID  string
	CC              string
	Currency        string
	InitialCents    int64
	FinalCents      int64
	DiscountPercent int
	FetchedAtUnix   int64
}

type PriceRow struct {
	StoreID         string `json:"store_id"`
	ExternalGameID  string `json:"external_game_id"`
	CC              string `json:"cc"`
	Currency        string `json:"currency,omitempty"`
	CurrentInitial  *int64 `json:"current_initial_cents,omitempty"`
	CurrentFinal    *int64 `json:"current_final_cents,omitempty"`
	DiscountPercent *int64 `json:"current_discount_percent,omitempty"`
	FetchedAtUnix   int64  `json:"fetched_at_unix"`
	LowestFinal     *int64 `json:"lowest_final_cents,omitempty"`
	LowestAtUnix    *int64 `json:"lowest_at_unix,omitempty"`
}

// UserRepo handles user-related database operations
type UserRepo interface {
	UpsertUser(ctx context.Context, userID string, nowUnix int64) error
	GetUser(ctx context.Context, userID string) (*User, error)
}

// User represents a user in the database
type User struct {
	ID        string `json:"id"`
	CreatedAt int64  `json:"created_at"`
}

type Repo interface {
	UpsertGame(ctx context.Context, p UpsertGameParams) error

	TrackGame(ctx context.Context, storeID, externalGameID, cc string, nowUnix int64) error
	GetPriceFetchedAt(ctx context.Context, storeID, externalGameID, cc string) (fetchedAtUnix int64, found bool, err error)
	UpsertPriceAndLowest(ctx context.Context, p UpsertPriceParams) error
	GetPriceRow(ctx context.Context, storeID, externalGameID, cc string) (*PriceRow, bool, error)

	UpsertUser(ctx context.Context, userID string, nowUnix int64) error
	GetUser(ctx context.Context, userID string) (*User, error)
	AddWatch(ctx context.Context, userID, storeID, externalGameID, cc string, nowUnix int64) error
	RemoveWatch(ctx context.Context, userID, storeID, externalGameID, cc string) error

	ListWatchedUniqueGamesForRefresh(ctx context.Context, storeID, cc string, limit int) ([]string, error)
}
