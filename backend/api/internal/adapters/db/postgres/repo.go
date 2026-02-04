package postgres

import (
	"context"
	"database/sql"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"

	"gamedivers.de/api/internal/ports/repo"
)

type Repo struct{ DB *sql.DB }

func Open(dsn string) (*sql.DB, error) {
	cfg, err := pgx.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}
	cfg.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	db := stdlib.OpenDB(*cfg)

	// sane pool defaults for small service
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
}

func (r *Repo) UpsertGame(ctx context.Context, p repo.UpsertGameParams) error {
	_, err := r.DB.ExecContext(ctx, `
INSERT INTO games(store_id, external_game_id, name, type, updated_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT(store_id, external_game_id) DO UPDATE SET
  name=excluded.name,
  type=excluded.type,
  updated_at=excluded.updated_at
`, p.StoreID, p.ExternalGameID, p.Name, p.Type, p.UpdatedAtUnix)
	return err
}

func (r *Repo) TrackGame(ctx context.Context, storeID, externalGameID, cc string, nowUnix int64) error {
	_, err := r.DB.ExecContext(ctx, `
INSERT INTO tracked_games(store_id, external_game_id, cc, added_at)
VALUES ($1, $2, $3, $4)
ON CONFLICT(store_id, external_game_id, cc) DO NOTHING
`, storeID, externalGameID, cc, nowUnix)
	return err
}

func (r *Repo) ListTrackedGames(ctx context.Context, storeID, cc string, limit int) ([]string, error) {
	rows, err := r.DB.QueryContext(ctx, `
SELECT external_game_id
FROM tracked_games
WHERE store_id=$1 AND cc=$2
ORDER BY added_at ASC
LIMIT $3
`, storeID, cc, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func (r *Repo) GetPriceFetchedAt(ctx context.Context, storeID, externalGameID, cc string) (int64, bool, error) {
	var fetched int64
	err := r.DB.QueryRowContext(ctx, `
SELECT fetched_at FROM prices
WHERE store_id=$1 AND external_game_id=$2 AND cc=$3
`, storeID, externalGameID, cc).Scan(&fetched)

	if err == sql.ErrNoRows {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	return fetched, true, nil
}

func (r *Repo) UpsertPriceAndLowest(ctx context.Context, p repo.UpsertPriceParams) error {
	_, err := r.DB.ExecContext(ctx, `
INSERT INTO prices(
  store_id, external_game_id, cc, currency,
  current_initial_cents, current_final_cents, current_discount_percent,
  fetched_at,
  lowest_final_cents, lowest_at
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
ON CONFLICT(store_id, external_game_id, cc) DO UPDATE SET
  currency=excluded.currency,
  current_initial_cents=excluded.current_initial_cents,
  current_final_cents=excluded.current_final_cents,
  current_discount_percent=excluded.current_discount_percent,
  fetched_at=excluded.fetched_at,
  lowest_final_cents =
    CASE
      WHEN prices.lowest_final_cents IS NULL THEN excluded.current_final_cents
      WHEN excluded.current_final_cents < prices.lowest_final_cents THEN excluded.current_final_cents
      ELSE prices.lowest_final_cents
    END,
  lowest_at =
    CASE
      WHEN prices.lowest_final_cents IS NULL THEN excluded.fetched_at
      WHEN excluded.current_final_cents < prices.lowest_final_cents THEN excluded.fetched_at
      ELSE prices.lowest_at
    END
`, p.StoreID, p.ExternalGameID, p.CC, p.Currency,
		p.InitialCents, p.FinalCents, p.DiscountPercent,
		p.FetchedAtUnix, p.FinalCents, p.FetchedAtUnix)
	return err
}

func (r *Repo) GetPriceRow(ctx context.Context, storeID, externalGameID, cc string) (*repo.PriceRow, bool, error) {
	row := &repo.PriceRow{}
	var (
		curInit, curFinal, disc, lowestFinal sql.NullInt64
		lowestAt                             sql.NullInt64
		currency                             sql.NullString
	)

	err := r.DB.QueryRowContext(ctx, `
SELECT store_id, external_game_id, cc, currency,
       current_initial_cents, current_final_cents, current_discount_percent,
       fetched_at, lowest_final_cents, lowest_at
FROM prices
WHERE store_id=$1 AND external_game_id=$2 AND cc=$3
`, storeID, externalGameID, cc).Scan(
		&row.StoreID, &row.ExternalGameID, &row.CC, &currency,
		&curInit, &curFinal, &disc,
		&row.FetchedAtUnix, &lowestFinal, &lowestAt,
	)

	if err == sql.ErrNoRows {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}

	if currency.Valid {
		row.Currency = currency.String
	}
	if curInit.Valid {
		v := curInit.Int64
		row.CurrentInitial = &v
	}
	if curFinal.Valid {
		v := curFinal.Int64
		row.CurrentFinal = &v
	}
	if disc.Valid {
		v := disc.Int64
		row.DiscountPercent = &v
	}
	if lowestFinal.Valid {
		v := lowestFinal.Int64
		row.LowestFinal = &v
	}
	if lowestAt.Valid {
		v := lowestAt.Int64
		row.LowestAtUnix = &v
	}

	return row, true, nil
}

func (r *Repo) UpsertUser(ctx context.Context, userID string, nowUnix int64) error {
	_, err := r.DB.ExecContext(ctx, `
INSERT INTO users(id, created_at)
VALUES ($1, $2)
ON CONFLICT(id) DO NOTHING
`, userID, nowUnix)
	return err
}

func (r *Repo) GetUser(ctx context.Context, userID string) (*repo.User, error) {
	var user repo.User
	err := r.DB.QueryRowContext(ctx, `
SELECT id, created_at FROM users WHERE id=$1
`, userID).Scan(&user.ID, &user.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *Repo) AddWatch(ctx context.Context, userID, storeID, externalGameID, cc string, nowUnix int64) error {
	_, err := r.DB.ExecContext(ctx, `
INSERT INTO user_watchlist(user_id, store_id, external_game_id, cc, added_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT(user_id, store_id, external_game_id, cc) DO NOTHING
`, userID, storeID, externalGameID, cc, nowUnix)
	return err
}

func (r *Repo) RemoveWatch(ctx context.Context, userID, storeID, externalGameID, cc string) error {
	_, err := r.DB.ExecContext(ctx, `
DELETE FROM user_watchlist
WHERE user_id=$1 AND store_id=$2 AND external_game_id=$3 AND cc=$4
`, userID, storeID, externalGameID, cc)
	return err
}

func (r *Repo) ListWatchedUniqueGamesForRefresh(ctx context.Context, storeID, cc string, limit int) ([]string, error) {
	rows, err := r.DB.QueryContext(ctx, `
SELECT uw.external_game_id
FROM (
  SELECT DISTINCT external_game_id
  FROM user_watchlist
  WHERE store_id=$1 AND cc=$2
) AS uw
LEFT JOIN prices p
  ON p.store_id=$1 AND p.external_game_id=uw.external_game_id AND p.cc=$2
ORDER BY COALESCE(p.fetched_at, 0) ASC
LIMIT $3
`, storeID, cc, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}
