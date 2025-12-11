// internal/library/repository_user.go
package library

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"

	"aoi/api/internal/models"
)

// User library operations
func (r *postgresRepository) AddToLibrary(ctx context.Context, entry *models.UserLibrary) (*models.UserLibrary, error) {
	query := `
		INSERT INTO user_library (user_id, game_id, store, store_game_id, play_time,
			last_played, install_path, is_installed, is_favorite, is_hidden,
			completion_status, user_rating, user_notes, added_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
		ON CONFLICT (user_id, store, store_game_id) DO UPDATE SET
			play_time = EXCLUDED.play_time,
			last_played = EXCLUDED.last_played,
			install_path = EXCLUDED.install_path,
			is_installed = EXCLUDED.is_installed,
			updated_at = NOW()
		RETURNING id, added_at, updated_at`

	err := r.db.QueryRowContext(ctx, query,
		entry.UserID, entry.GameID, entry.Store, entry.StoreGameID, entry.PlayTime,
		entry.LastPlayed, entry.InstallPath, entry.IsInstalled, entry.IsFavorite,
		entry.IsHidden, entry.CompletionStatus, entry.UserRating, entry.UserNotes,
	).Scan(&entry.ID, &entry.AddedAt, &entry.UpdatedAt)

	return entry, err
}

func (r *postgresRepository) GetUserLibrary(ctx context.Context, userID int64, filter *models.LibraryFilter) ([]*models.LibraryGameDetail, error) {
	queryBuilder := strings.Builder{}
	queryBuilder.WriteString(`
		SELECT ul.id, ul.user_id, ul.game_id, ul.store, ul.store_game_id, ul.play_time,
			ul.last_played, ul.install_path, ul.is_installed, ul.is_favorite, ul.is_hidden,
			ul.completion_status, ul.user_rating, ul.user_notes, ul.added_at, ul.updated_at,
			g.id, g.name, g.description, g.release_date, g.developer, g.publisher,
			g.cover_image, g.background_image, g.icon, g.created_at, g.updated_at
		FROM user_library ul
		JOIN games g ON ul.game_id = g.id
		WHERE ul.user_id = $1`)

	args := []interface{}{userID}
	argCount := 2

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
		queryBuilder.WriteString(" AND ul.store IN (" + strings.Join(placeholders, ",") + ")")
	}

	if len(filter.CompletionStatus) > 0 {
		placeholders := []string{}
		for _, status := range filter.CompletionStatus {
			placeholders = append(placeholders, fmt.Sprintf("$%d", argCount))
			args = append(args, status)
			argCount++
		}
		queryBuilder.WriteString(" AND ul.completion_status IN (" + strings.Join(placeholders, ",") + ")")
	}

	if filter.IsFavorite != nil {
		queryBuilder.WriteString(fmt.Sprintf(" AND ul.is_favorite = $%d", argCount))
		args = append(args, *filter.IsFavorite)
		argCount++
	}

	if filter.IsInstalled != nil {
		queryBuilder.WriteString(fmt.Sprintf(" AND ul.is_installed = $%d", argCount))
		args = append(args, *filter.IsInstalled)
		argCount++
	}

	if filter.IsHidden != nil {
		queryBuilder.WriteString(fmt.Sprintf(" AND ul.is_hidden = $%d", argCount))
		args = append(args, *filter.IsHidden)
		argCount++
	}

	// Sorting
	sortBy := "g.name"
	if filter.SortBy != "" {
		switch filter.SortBy {
		case "play_time":
			sortBy = "ul.play_time"
		case "last_played":
			sortBy = "ul.last_played"
		case "added_at":
			sortBy = "ul.added_at"
		}
	}

	sortOrder := "ASC"
	if filter.SortOrder == "desc" {
		sortOrder = "DESC"
	}

	queryBuilder.WriteString(fmt.Sprintf(" ORDER BY %s %s", sortBy, sortOrder))

	// Pagination
	limit := 1000 // Increased default limit
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

	results := []*models.LibraryGameDetail{}
	for rows.Next() {
		detail := &models.LibraryGameDetail{}
		err := rows.Scan(
			&detail.UserLibrary.ID, &detail.UserLibrary.UserID, &detail.UserLibrary.GameID,
			&detail.UserLibrary.Store, &detail.UserLibrary.StoreGameID, &detail.UserLibrary.PlayTime,
			&detail.UserLibrary.LastPlayed, &detail.UserLibrary.InstallPath, &detail.UserLibrary.IsInstalled,
			&detail.UserLibrary.IsFavorite, &detail.UserLibrary.IsHidden, &detail.UserLibrary.CompletionStatus,
			&detail.UserLibrary.UserRating, &detail.UserLibrary.UserNotes, &detail.UserLibrary.AddedAt,
			&detail.UserLibrary.UpdatedAt,
			&detail.Game.ID, &detail.Game.Name, &detail.Game.Description, &detail.Game.ReleaseDate,
			&detail.Game.Developer, &detail.Game.Publisher, &detail.Game.CoverImage, &detail.Game.BackgroundImage,
			&detail.Game.Icon, &detail.Game.CreatedAt, &detail.Game.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		// Load related data
		detail.Game.Genres, _ = r.getGameGenres(ctx, detail.Game.ID)
		detail.Game.Tags, _ = r.getGameTags(ctx, detail.Game.ID)
		detail.Game.Platforms, _ = r.getGamePlatforms(ctx, detail.Game.ID)

		stores, _ := r.GetStoreGames(ctx, detail.Game.ID)
		detail.Stores = make([]models.StoreGame, len(stores))
		for i, store := range stores {
			detail.Stores[i] = *store
		}

		results = append(results, detail)
	}

	return results, nil
}

func (r *postgresRepository) GetLibraryEntry(ctx context.Context, userID, gameID int64) (*models.UserLibrary, error) {
	query := `
		SELECT id, user_id, game_id, store, store_game_id, play_time, last_played,
			install_path, is_installed, is_favorite, is_hidden, completion_status,
			user_rating, user_notes, added_at, updated_at
		FROM user_library
		WHERE user_id = $1 AND game_id = $2`

	entry := &models.UserLibrary{}
	err := r.db.QueryRowContext(ctx, query, userID, gameID).Scan(
		&entry.ID, &entry.UserID, &entry.GameID, &entry.Store, &entry.StoreGameID,
		&entry.PlayTime, &entry.LastPlayed, &entry.InstallPath, &entry.IsInstalled,
		&entry.IsFavorite, &entry.IsHidden, &entry.CompletionStatus, &entry.UserRating,
		&entry.UserNotes, &entry.AddedAt, &entry.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("library entry not found")
		}
		return nil, err
	}

	return entry, nil
}

func (r *postgresRepository) UpdateLibraryEntry(ctx context.Context, entry *models.UserLibrary) error {
	query := `
		UPDATE user_library
		SET play_time = $1, last_played = $2, install_path = $3, is_installed = $4,
			is_favorite = $5, is_hidden = $6, completion_status = $7, user_rating = $8,
			user_notes = $9, updated_at = NOW()
		WHERE id = $10 AND user_id = $11`

	_, err := r.db.ExecContext(ctx, query,
		entry.PlayTime, entry.LastPlayed, entry.InstallPath, entry.IsInstalled,
		entry.IsFavorite, entry.IsHidden, entry.CompletionStatus, entry.UserRating,
		entry.UserNotes, entry.ID, entry.UserID,
	)

	return err
}

func (r *postgresRepository) RemoveFromLibrary(ctx context.Context, userID, libraryID int64) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM user_library WHERE id = $1 AND user_id = $2", libraryID, userID)
	return err
}

// Wishlist operations
func (r *postgresRepository) AddToWishlist(ctx context.Context, wishlist *models.Wishlist) (*models.Wishlist, error) {
	query := `
		INSERT INTO wishlist (user_id, game_id, priority, notes, notify_on_discount, max_price, added_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
		ON CONFLICT (user_id, game_id) DO UPDATE SET
			priority = EXCLUDED.priority,
			notes = EXCLUDED.notes,
			notify_on_discount = EXCLUDED.notify_on_discount,
			max_price = EXCLUDED.max_price,
			updated_at = NOW()
		RETURNING id, added_at, updated_at`

	err := r.db.QueryRowContext(ctx, query,
		wishlist.UserID, wishlist.GameID, wishlist.Priority, wishlist.Notes,
		wishlist.NotifyOnDiscount, wishlist.MaxPrice,
	).Scan(&wishlist.ID, &wishlist.AddedAt, &wishlist.UpdatedAt)

	return wishlist, err
}

func (r *postgresRepository) GetUserWishlist(ctx context.Context, userID int64) ([]*models.WishlistItem, error) {
	query := `
		SELECT w.id, w.user_id, w.game_id, w.priority, w.notes, w.notify_on_discount, 
			w.max_price, w.added_at, w.updated_at,
			g.id, g.name, g.description, g.release_date, g.developer, g.publisher,
			g.cover_image, g.background_image, g.icon, g.created_at, g.updated_at
		FROM wishlist w
		JOIN games g ON w.game_id = g.id
		WHERE w.user_id = $1
		ORDER BY w.priority DESC, w.added_at DESC`

	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []*models.WishlistItem{}
	for rows.Next() {
		item := &models.WishlistItem{}
		err := rows.Scan(
			&item.Wishlist.ID, &item.Wishlist.UserID, &item.Wishlist.GameID,
			&item.Wishlist.Priority, &item.Wishlist.Notes, &item.Wishlist.NotifyOnDiscount,
			&item.Wishlist.MaxPrice, &item.Wishlist.AddedAt, &item.Wishlist.UpdatedAt,
			&item.Game.ID, &item.Game.Name, &item.Game.Description, &item.Game.ReleaseDate,
			&item.Game.Developer, &item.Game.Publisher, &item.Game.CoverImage,
			&item.Game.BackgroundImage, &item.Game.Icon, &item.Game.CreatedAt, &item.Game.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		// Load game details
		item.Game.Genres, _ = r.getGameGenres(ctx, item.Game.ID)
		item.Game.Tags, _ = r.getGameTags(ctx, item.Game.ID)
		item.Game.Platforms, _ = r.getGamePlatforms(ctx, item.Game.ID)

		// Find best price across all stores
		item.BestPrice = r.getBestPrice(ctx, item.Game.ID)

		items = append(items, item)
	}

	return items, nil
}

func (r *postgresRepository) GetWishlistItem(ctx context.Context, userID, gameID int64) (*models.Wishlist, error) {
	query := `
		SELECT id, user_id, game_id, priority, notes, notify_on_discount, max_price, added_at, updated_at
		FROM wishlist
		WHERE user_id = $1 AND game_id = $2`

	item := &models.Wishlist{}
	err := r.db.QueryRowContext(ctx, query, userID, gameID).Scan(
		&item.ID, &item.UserID, &item.GameID, &item.Priority, &item.Notes,
		&item.NotifyOnDiscount, &item.MaxPrice, &item.AddedAt, &item.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("wishlist item not found")
		}
		return nil, err
	}

	return item, nil
}

func (r *postgresRepository) UpdateWishlistItem(ctx context.Context, wishlist *models.Wishlist) error {
	query := `
		UPDATE wishlist
		SET priority = $1, notes = $2, notify_on_discount = $3, max_price = $4, updated_at = NOW()
		WHERE id = $5 AND user_id = $6`

	_, err := r.db.ExecContext(ctx, query,
		wishlist.Priority, wishlist.Notes, wishlist.NotifyOnDiscount, wishlist.MaxPrice,
		wishlist.ID, wishlist.UserID,
	)

	return err
}

func (r *postgresRepository) RemoveFromWishlist(ctx context.Context, userID, wishlistID int64) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM wishlist WHERE id = $1 AND user_id = $2", wishlistID, userID)
	return err
}

func (r *postgresRepository) getBestPrice(ctx context.Context, gameID int64) *models.StoreGame {
	query := `
		SELECT id, game_id, store, store_game_id, store_url, price, discount_price,
			currency, is_available, last_checked, created_at, updated_at
		FROM store_games
		WHERE game_id = $1 AND is_available = true
		ORDER BY COALESCE(discount_price, price) ASC
		LIMIT 1`

	sg := &models.StoreGame{}
	err := r.db.QueryRowContext(ctx, query, gameID).Scan(
		&sg.ID, &sg.GameID, &sg.Store, &sg.StoreGameID, &sg.StoreURL,
		&sg.Price, &sg.DiscountPrice, &sg.Currency, &sg.IsAvailable,
		&sg.LastChecked, &sg.CreatedAt, &sg.UpdatedAt,
	)

	if err != nil {
		return nil
	}

	return sg
}

// Store account operations
func (r *postgresRepository) CreateStoreAccount(ctx context.Context, account *models.UserStoreAccount) (*models.UserStoreAccount, error) {
	// First, delete any existing link to this store account from other users
	// This prevents the unique constraint violation on (store, store_user_id)
	deleteQuery := `DELETE FROM user_store_accounts WHERE store = $1 AND store_user_id = $2 AND user_id != $3`
	_, err := r.db.ExecContext(ctx, deleteQuery, account.Store, account.StoreUserID, account.UserID)
	if err != nil {
		log.Printf("Warning: Failed to delete existing store account links: %v", err)
	} else {
		log.Printf("Removed any existing %s account links for store_user_id=%s from other users", account.Store, account.StoreUserID)
	}

	query := `
		INSERT INTO user_store_accounts (user_id, store, store_user_id, display_name, avatar_url,
			access_token_enc, refresh_token_enc, expires_at, is_connected, last_synced_at,
			auto_import, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
		ON CONFLICT (user_id, store) DO UPDATE SET
			store_user_id = EXCLUDED.store_user_id,
			display_name = EXCLUDED.display_name,
			avatar_url = EXCLUDED.avatar_url,
			access_token_enc = EXCLUDED.access_token_enc,
			refresh_token_enc = EXCLUDED.refresh_token_enc,
			expires_at = EXCLUDED.expires_at,
			is_connected = EXCLUDED.is_connected,
			updated_at = NOW()
		RETURNING id, created_at, updated_at`

	err = r.db.QueryRowContext(ctx, query,
		account.UserID, account.Store, account.StoreUserID, account.DisplayName,
		account.AvatarURL, account.AccessToken, account.RefreshToken, account.TokenExpiresAt,
		account.IsConnected, account.LastSyncedAt, account.AutoImport,
	).Scan(&account.ID, &account.CreatedAt, &account.UpdatedAt)

	return account, err
}

func (r *postgresRepository) GetUserStoreAccounts(ctx context.Context, userID int64) ([]*models.UserStoreAccount, error) {
	query := `
		SELECT id, user_id, store, store_user_id, display_name, avatar_url,
			access_token_enc, refresh_token_enc, expires_at, is_connected,
			last_synced_at, auto_import, created_at, updated_at
		FROM user_store_accounts
		WHERE user_id = $1`

	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		log.Printf("GetUserStoreAccounts query error for userID %d: %v", userID, err)
		return nil, err
	}
	defer rows.Close()

	accounts := []*models.UserStoreAccount{}
	for rows.Next() {
		acc := &models.UserStoreAccount{}
		var expiresAt, lastSyncedAt sql.NullTime
		var refreshToken []byte
		err := rows.Scan(
			&acc.ID, &acc.UserID, &acc.Store, &acc.StoreUserID, &acc.DisplayName,
			&acc.AvatarURL, &acc.AccessToken, &refreshToken, &expiresAt,
			&acc.IsConnected, &lastSyncedAt, &acc.AutoImport, &acc.CreatedAt, &acc.UpdatedAt,
		)
		if err != nil {
			log.Printf("GetUserStoreAccounts scan error: %v", err)
			return nil, err
		}
		if expiresAt.Valid {
			acc.TokenExpiresAt = &expiresAt.Time
		}
		if lastSyncedAt.Valid {
			acc.LastSyncedAt = &lastSyncedAt.Time
		}
		if len(refreshToken) > 0 {
			acc.RefreshToken = refreshToken
		}
		accounts = append(accounts, acc)
	}

	log.Printf("GetUserStoreAccounts returning %d accounts for userID %d", len(accounts), userID)
	return accounts, nil
}

func (r *postgresRepository) GetUserStoreAccount(ctx context.Context, userID int64, store string) (*models.UserStoreAccount, error) {
	query := `
		SELECT id, user_id, store, store_user_id, display_name, avatar_url,
			access_token_enc, refresh_token_enc, expires_at, is_connected,
			last_synced_at, auto_import, created_at, updated_at
		FROM user_store_accounts
		WHERE user_id = $1 AND store = $2`

	acc := &models.UserStoreAccount{}
	var expiresAt, lastSyncedAt sql.NullTime
	var refreshToken []byte
	err := r.db.QueryRowContext(ctx, query, userID, store).Scan(
		&acc.ID, &acc.UserID, &acc.Store, &acc.StoreUserID, &acc.DisplayName,
		&acc.AvatarURL, &acc.AccessToken, &refreshToken, &expiresAt,
		&acc.IsConnected, &lastSyncedAt, &acc.AutoImport, &acc.CreatedAt, &acc.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("store account not found")
		}
		return nil, err
	}

	if expiresAt.Valid {
		acc.TokenExpiresAt = &expiresAt.Time
	}
	if lastSyncedAt.Valid {
		acc.LastSyncedAt = &lastSyncedAt.Time
	}
	if len(refreshToken) > 0 {
		acc.RefreshToken = refreshToken
	}

	return acc, nil
}

func (r *postgresRepository) UpdateStoreAccount(ctx context.Context, account *models.UserStoreAccount) error {
	query := `
		UPDATE user_store_accounts
		SET display_name = $1, avatar_url = $2, access_token_enc = $3, refresh_token_enc = $4,
			expires_at = $5, is_connected = $6, last_synced_at = $7, auto_import = $8, updated_at = NOW()
		WHERE id = $9 AND user_id = $10`

	_, err := r.db.ExecContext(ctx, query,
		account.DisplayName, account.AvatarURL, account.AccessToken, account.RefreshToken,
		account.TokenExpiresAt, account.IsConnected, account.LastSyncedAt, account.AutoImport,
		account.ID, account.UserID,
	)

	return err
}

func (r *postgresRepository) DeleteStoreAccount(ctx context.Context, userID int64, store string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM user_store_accounts WHERE user_id = $1 AND store = $2", userID, store)
	return err
}
