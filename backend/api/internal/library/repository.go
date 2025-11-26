// internal/library/repository.go
package library

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"aoi/api/internal/models"
)

type Repository interface {
	// Game operations
	CreateGame(ctx context.Context, game *models.Game) (*models.Game, error)
	GetGameByID(ctx context.Context, id int64) (*models.Game, error)
	GetGameByStoreID(ctx context.Context, store, storeGameID string) (*models.Game, error)
	SearchGames(ctx context.Context, filter *models.SearchFilter) ([]*models.GameWithStores, error)
	UpdateGame(ctx context.Context, game *models.Game) error

	// Store game operations
	CreateStoreGame(ctx context.Context, storeGame *models.StoreGame) (*models.StoreGame, error)
	GetStoreGames(ctx context.Context, gameID int64) ([]*models.StoreGame, error)
	UpdateStoreGame(ctx context.Context, storeGame *models.StoreGame) error

	// User library operations
	AddToLibrary(ctx context.Context, entry *models.UserLibrary) (*models.UserLibrary, error)
	GetUserLibrary(ctx context.Context, userID int64, filter *models.LibraryFilter) ([]*models.LibraryGameDetail, error)
	GetLibraryEntry(ctx context.Context, userID, gameID int64) (*models.UserLibrary, error)
	UpdateLibraryEntry(ctx context.Context, entry *models.UserLibrary) error
	RemoveFromLibrary(ctx context.Context, userID, libraryID int64) error

	// Wishlist operations
	AddToWishlist(ctx context.Context, wishlist *models.Wishlist) (*models.Wishlist, error)
	GetUserWishlist(ctx context.Context, userID int64) ([]*models.WishlistItem, error)
	GetWishlistItem(ctx context.Context, userID, gameID int64) (*models.Wishlist, error)
	UpdateWishlistItem(ctx context.Context, wishlist *models.Wishlist) error
	RemoveFromWishlist(ctx context.Context, userID, wishlistID int64) error

	// Store account operations
	CreateStoreAccount(ctx context.Context, account *models.UserStoreAccount) (*models.UserStoreAccount, error)
	GetUserStoreAccounts(ctx context.Context, userID int64) ([]*models.UserStoreAccount, error)
	GetUserStoreAccount(ctx context.Context, userID int64, store string) (*models.UserStoreAccount, error)
	UpdateStoreAccount(ctx context.Context, account *models.UserStoreAccount) error
	DeleteStoreAccount(ctx context.Context, userID int64, store string) error
}

type postgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) Repository {
	return &postgresRepository{db: db}
}

// Game operations
func (r *postgresRepository) CreateGame(ctx context.Context, game *models.Game) (*models.Game, error) {
	query := `
		INSERT INTO games (name, description, release_date, developer, publisher, 
			cover_image, background_image, icon, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
		RETURNING id, created_at, updated_at`

	err := r.db.QueryRowContext(ctx, query,
		game.Name, game.Description, game.ReleaseDate, game.Developer, game.Publisher,
		game.CoverImage, game.BackgroundImage, game.Icon,
	).Scan(&game.ID, &game.CreatedAt, &game.UpdatedAt)

	if err != nil {
		return nil, err
	}

	// Insert genres
	if len(game.Genres) > 0 {
		if err := r.insertGameGenres(ctx, game.ID, game.Genres); err != nil {
			return nil, err
		}
	}

	// Insert tags
	if len(game.Tags) > 0 {
		if err := r.insertGameTags(ctx, game.ID, game.Tags); err != nil {
			return nil, err
		}
	}

	// Insert platforms
	if len(game.Platforms) > 0 {
		if err := r.insertGamePlatforms(ctx, game.ID, game.Platforms); err != nil {
			return nil, err
		}
	}

	return game, nil
}

func (r *postgresRepository) GetGameByID(ctx context.Context, id int64) (*models.Game, error) {
	query := `
		SELECT id, name, description, release_date, developer, publisher,
			cover_image, background_image, icon, created_at, updated_at
		FROM games
		WHERE id = $1`

	game := &models.Game{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&game.ID, &game.Name, &game.Description, &game.ReleaseDate, &game.Developer,
		&game.Publisher, &game.CoverImage, &game.BackgroundImage, &game.Icon,
		&game.CreatedAt, &game.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("game not found")
		}
		return nil, err
	}

	// Load genres, tags, platforms
	game.Genres, _ = r.getGameGenres(ctx, id)
	game.Tags, _ = r.getGameTags(ctx, id)
	game.Platforms, _ = r.getGamePlatforms(ctx, id)

	return game, nil
}

func (r *postgresRepository) GetGameByStoreID(ctx context.Context, store, storeGameID string) (*models.Game, error) {
	query := `
		SELECT g.id, g.name, g.description, g.release_date, g.developer, g.publisher,
			g.cover_image, g.background_image, g.icon, g.created_at, g.updated_at
		FROM games g
		JOIN store_games sg ON g.id = sg.game_id
		WHERE sg.store = $1 AND sg.store_game_id = $2`

	game := &models.Game{}
	err := r.db.QueryRowContext(ctx, query, store, storeGameID).Scan(
		&game.ID, &game.Name, &game.Description, &game.ReleaseDate, &game.Developer,
		&game.Publisher, &game.CoverImage, &game.BackgroundImage, &game.Icon,
		&game.CreatedAt, &game.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("game not found")
		}
		return nil, err
	}

	game.Genres, _ = r.getGameGenres(ctx, game.ID)
	game.Tags, _ = r.getGameTags(ctx, game.ID)
	game.Platforms, _ = r.getGamePlatforms(ctx, game.ID)

	return game, nil
}

func (r *postgresRepository) SearchGames(ctx context.Context, filter *models.SearchFilter) ([]*models.GameWithStores, error) {
	queryBuilder := strings.Builder{}
	queryBuilder.WriteString(`
		SELECT DISTINCT g.id, g.name, g.description, g.release_date, g.developer, g.publisher,
			g.cover_image, g.background_image, g.icon, g.created_at, g.updated_at
		FROM games g
		LEFT JOIN store_games sg ON g.id = sg.game_id
		LEFT JOIN game_genres gg ON g.id = gg.game_id
		LEFT JOIN game_tags gt ON g.id = gt.game_id
		LEFT JOIN game_platforms gp ON g.id = gp.game_id
		WHERE 1=1`)

	args := []interface{}{}
	argCount := 1

	if filter.Query != "" {
		queryBuilder.WriteString(fmt.Sprintf(" AND g.name ILIKE $%d", argCount))
		args = append(args, "%"+filter.Query+"%")
		argCount++
	}

	if len(filter.Stores) > 0 {
		placeholders := []string{}
		for _, store := range filter.Stores {
			placeholders = append(placeholders, fmt.Sprintf("$%d", argCount))
			args = append(args, store)
			argCount++
		}
		queryBuilder.WriteString(" AND sg.store IN (" + strings.Join(placeholders, ",") + ")")
	}

	if len(filter.Genres) > 0 {
		placeholders := []string{}
		for _, genre := range filter.Genres {
			placeholders = append(placeholders, fmt.Sprintf("$%d", argCount))
			args = append(args, genre)
			argCount++
		}
		queryBuilder.WriteString(" AND gg.genre IN (" + strings.Join(placeholders, ",") + ")")
	}

	if filter.MinPrice != nil || filter.MaxPrice != nil || filter.OnSale {
		if filter.MinPrice != nil {
			queryBuilder.WriteString(fmt.Sprintf(" AND sg.price >= $%d", argCount))
			args = append(args, *filter.MinPrice)
			argCount++
		}
		if filter.MaxPrice != nil {
			queryBuilder.WriteString(fmt.Sprintf(" AND sg.price <= $%d", argCount))
			args = append(args, *filter.MaxPrice)
			argCount++
		}
		if filter.OnSale {
			queryBuilder.WriteString(" AND sg.discount_price IS NOT NULL")
		}
	}

	// Sorting
	sortBy := "g.name"
	if filter.SortBy != "" {
		switch filter.SortBy {
		case "release_date":
			sortBy = "g.release_date"
		case "price":
			sortBy = "sg.price"
		}
	}

	sortOrder := "ASC"
	if filter.SortOrder == "desc" {
		sortOrder = "DESC"
	}

	queryBuilder.WriteString(fmt.Sprintf(" ORDER BY %s %s", sortBy, sortOrder))

	// Pagination
	limit := 50
	if filter.Limit > 0 {
		limit = filter.Limit
	}
	queryBuilder.WriteString(fmt.Sprintf(" LIMIT $%d OFFSET $%d", argCount, argCount+1))
	args = append(args, limit, filter.Offset)

	rows, err := r.db.QueryContext(ctx, queryBuilder.String(), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	games := []*models.GameWithStores{}
	for rows.Next() {
		game := &models.Game{}
		err := rows.Scan(
			&game.ID, &game.Name, &game.Description, &game.ReleaseDate, &game.Developer,
			&game.Publisher, &game.CoverImage, &game.BackgroundImage, &game.Icon,
			&game.CreatedAt, &game.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		// Load related data
		game.Genres, _ = r.getGameGenres(ctx, game.ID)
		game.Tags, _ = r.getGameTags(ctx, game.ID)
		game.Platforms, _ = r.getGamePlatforms(ctx, game.ID)

		stores, _ := r.GetStoreGames(ctx, game.ID)

		gameWithStores := &models.GameWithStores{
			Game:   *game,
			Stores: make([]models.StoreGame, len(stores)),
		}
		for i, store := range stores {
			gameWithStores.Stores[i] = *store
		}

		games = append(games, gameWithStores)
	}

	return games, nil
}

func (r *postgresRepository) UpdateGame(ctx context.Context, game *models.Game) error {
	query := `
		UPDATE games
		SET name = $1, description = $2, release_date = $3, developer = $4, publisher = $5,
			cover_image = $6, background_image = $7, icon = $8, updated_at = NOW()
		WHERE id = $9`

	_, err := r.db.ExecContext(ctx, query,
		game.Name, game.Description, game.ReleaseDate, game.Developer, game.Publisher,
		game.CoverImage, game.BackgroundImage, game.Icon, game.ID,
	)

	return err
}

// Helper functions for genres, tags, platforms
func (r *postgresRepository) insertGameGenres(ctx context.Context, gameID int64, genres []string) error {
	for _, genre := range genres {
		_, err := r.db.ExecContext(ctx, "INSERT INTO game_genres (game_id, genre) VALUES ($1, $2) ON CONFLICT DO NOTHING", gameID, genre)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *postgresRepository) insertGameTags(ctx context.Context, gameID int64, tags []string) error {
	for _, tag := range tags {
		_, err := r.db.ExecContext(ctx, "INSERT INTO game_tags (game_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING", gameID, tag)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *postgresRepository) insertGamePlatforms(ctx context.Context, gameID int64, platforms []string) error {
	for _, platform := range platforms {
		_, err := r.db.ExecContext(ctx, "INSERT INTO game_platforms (game_id, platform) VALUES ($1, $2) ON CONFLICT DO NOTHING", gameID, platform)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *postgresRepository) getGameGenres(ctx context.Context, gameID int64) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT genre FROM game_genres WHERE game_id = $1", gameID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	genres := []string{}
	for rows.Next() {
		var genre string
		if err := rows.Scan(&genre); err != nil {
			return nil, err
		}
		genres = append(genres, genre)
	}
	return genres, nil
}

func (r *postgresRepository) getGameTags(ctx context.Context, gameID int64) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT tag FROM game_tags WHERE game_id = $1", gameID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tags := []string{}
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}
	return tags, nil
}

func (r *postgresRepository) getGamePlatforms(ctx context.Context, gameID int64) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT platform FROM game_platforms WHERE game_id = $1", gameID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	platforms := []string{}
	for rows.Next() {
		var platform string
		if err := rows.Scan(&platform); err != nil {
			return nil, err
		}
		platforms = append(platforms, platform)
	}
	return platforms, nil
}

// Store game operations
func (r *postgresRepository) CreateStoreGame(ctx context.Context, storeGame *models.StoreGame) (*models.StoreGame, error) {
	query := `
		INSERT INTO store_games (game_id, store, store_game_id, store_url, price, 
			discount_price, currency, is_available, last_checked, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
		ON CONFLICT (store, store_game_id) DO UPDATE SET
			price = EXCLUDED.price,
			discount_price = EXCLUDED.discount_price,
			is_available = EXCLUDED.is_available,
			last_checked = EXCLUDED.last_checked,
			updated_at = NOW()
		RETURNING id, created_at, updated_at`

	err := r.db.QueryRowContext(ctx, query,
		storeGame.GameID, storeGame.Store, storeGame.StoreGameID, storeGame.StoreURL,
		storeGame.Price, storeGame.DiscountPrice, storeGame.Currency,
		storeGame.IsAvailable, time.Now(),
	).Scan(&storeGame.ID, &storeGame.CreatedAt, &storeGame.UpdatedAt)

	return storeGame, err
}

func (r *postgresRepository) GetStoreGames(ctx context.Context, gameID int64) ([]*models.StoreGame, error) {
	query := `
		SELECT id, game_id, store, store_game_id, store_url, price, discount_price,
			currency, is_available, last_checked, created_at, updated_at
		FROM store_games
		WHERE game_id = $1`

	rows, err := r.db.QueryContext(ctx, query, gameID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	storeGames := []*models.StoreGame{}
	for rows.Next() {
		sg := &models.StoreGame{}
		err := rows.Scan(
			&sg.ID, &sg.GameID, &sg.Store, &sg.StoreGameID, &sg.StoreURL,
			&sg.Price, &sg.DiscountPrice, &sg.Currency, &sg.IsAvailable,
			&sg.LastChecked, &sg.CreatedAt, &sg.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		storeGames = append(storeGames, sg)
	}

	return storeGames, nil
}

func (r *postgresRepository) UpdateStoreGame(ctx context.Context, storeGame *models.StoreGame) error {
	query := `
		UPDATE store_games
		SET price = $1, discount_price = $2, is_available = $3, 
			last_checked = $4, updated_at = NOW()
		WHERE id = $5`

	_, err := r.db.ExecContext(ctx, query,
		storeGame.Price, storeGame.DiscountPrice, storeGame.IsAvailable,
		time.Now(), storeGame.ID,
	)

	return err
}
