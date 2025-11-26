// internal/library/service.go
package library

import (
	"context"
	"fmt"
	"log"
	"time"

	"aoi/api/internal/crypto"
	"aoi/api/internal/models"
	"aoi/api/internal/stores"
)

type Service interface {
	// Library operations
	GetUserLibrary(ctx context.Context, userID int64, filter *models.LibraryFilter) ([]*models.LibraryGameDetail, error)
	UpdateLibraryEntry(ctx context.Context, userID int64, entry *models.UserLibrary) error
	RemoveFromLibrary(ctx context.Context, userID, libraryID int64) error

	// Wishlist operations
	GetUserWishlist(ctx context.Context, userID int64) ([]*models.WishlistItem, error)
	AddToWishlist(ctx context.Context, userID int64, wishlist *models.Wishlist) (*models.Wishlist, error)
	UpdateWishlistItem(ctx context.Context, userID int64, wishlist *models.Wishlist) error
	RemoveFromWishlist(ctx context.Context, userID, wishlistID int64) error

	// Store account operations
	ConnectStoreAccount(ctx context.Context, userID int64, store, code string) error
	SaveStoreAccount(ctx context.Context, account *models.UserStoreAccount) error
	GetUserStoreAccounts(ctx context.Context, userID int64) ([]*models.UserStoreAccount, error)
	DisconnectStoreAccount(ctx context.Context, userID int64, store string) error

	// Library sync
	SyncStoreLibrary(ctx context.Context, userID int64, store string) error
	SyncAllLibraries(ctx context.Context, userID int64) error

	// Shop/Search operations
	SearchGames(ctx context.Context, filter *models.SearchFilter) ([]*models.GameWithStores, error)
	SearchAllStores(ctx context.Context, query string, limit int) (map[string][]stores.StoreGameInfo, error)
	GetGameDetails(ctx context.Context, gameID int64) (*models.GameWithStores, error)
}

type service struct {
	repo         Repository
	storeManager *stores.StoreManager
	encryptor    crypto.Encryptor
}

func NewService(repo Repository, storeManager *stores.StoreManager, encryptor crypto.Encryptor) Service {
	return &service{
		repo:         repo,
		storeManager: storeManager,
		encryptor:    encryptor,
	}
}

func (s *service) GetUserLibrary(ctx context.Context, userID int64, filter *models.LibraryFilter) ([]*models.LibraryGameDetail, error) {
	return s.repo.GetUserLibrary(ctx, userID, filter)
}

func (s *service) UpdateLibraryEntry(ctx context.Context, userID int64, entry *models.UserLibrary) error {
	entry.UserID = userID
	return s.repo.UpdateLibraryEntry(ctx, entry)
}

func (s *service) RemoveFromLibrary(ctx context.Context, userID, libraryID int64) error {
	return s.repo.RemoveFromLibrary(ctx, userID, libraryID)
}

func (s *service) GetUserWishlist(ctx context.Context, userID int64) ([]*models.WishlistItem, error) {
	return s.repo.GetUserWishlist(ctx, userID)
}

func (s *service) AddToWishlist(ctx context.Context, userID int64, wishlist *models.Wishlist) (*models.Wishlist, error) {
	wishlist.UserID = userID
	return s.repo.AddToWishlist(ctx, wishlist)
}

func (s *service) UpdateWishlistItem(ctx context.Context, userID int64, wishlist *models.Wishlist) error {
	wishlist.UserID = userID
	return s.repo.UpdateWishlistItem(ctx, wishlist)
}

func (s *service) RemoveFromWishlist(ctx context.Context, userID, wishlistID int64) error {
	return s.repo.RemoveFromWishlist(ctx, userID, wishlistID)
}

func (s *service) ConnectStoreAccount(ctx context.Context, userID int64, store, code string) error {
	client, ok := s.storeManager.GetClient(store)
	if !ok {
		return fmt.Errorf("unsupported store: %s", store)
	}

	// Exchange code for tokens
	tokens, err := client.ExchangeCode(ctx, code)
	if err != nil {
		return fmt.Errorf("failed to exchange code: %w", err)
	}

	// Get user info from store
	userInfo, err := client.GetUserInfo(ctx, tokens.AccessToken)
	if err != nil {
		return fmt.Errorf("failed to get user info: %w", err)
	}

	// Encrypt tokens
	accessTokenEnc, err := s.encryptor.Encrypt([]byte(tokens.AccessToken))
	if err != nil {
		return fmt.Errorf("failed to encrypt access token: %w", err)
	}

	var refreshTokenEnc []byte
	if tokens.RefreshToken != "" {
		refreshTokenEnc, err = s.encryptor.Encrypt([]byte(tokens.RefreshToken))
		if err != nil {
			return fmt.Errorf("failed to encrypt refresh token: %w", err)
		}
	}

	// Save store account
	account := &models.UserStoreAccount{
		UserID:         userID,
		Store:          store,
		StoreUserID:    userInfo.StoreUserID,
		DisplayName:    userInfo.DisplayName,
		AvatarURL:      userInfo.AvatarURL,
		AccessToken:    accessTokenEnc,
		RefreshToken:   refreshTokenEnc,
		TokenExpiresAt: &tokens.ExpiresAt,
		IsConnected:    true,
		AutoImport:     true,
	}

	_, err = s.repo.CreateStoreAccount(ctx, account)
	if err != nil {
		return fmt.Errorf("failed to save store account: %w", err)
	}

	// Automatically sync library after connecting
	go func() {
		syncCtx := context.Background()
		if err := s.SyncStoreLibrary(syncCtx, userID, store); err != nil {
			log.Printf("failed to sync library for %s: %v", store, err)
		}
	}()

	return nil
}

// SaveStoreAccount directly saves an already-authenticated store account
func (s *service) SaveStoreAccount(ctx context.Context, account *models.UserStoreAccount) error {
	_, err := s.repo.CreateStoreAccount(ctx, account)
	if err != nil {
		return fmt.Errorf("failed to save store account: %w", err)
	}
	return nil
}

func (s *service) GetUserStoreAccounts(ctx context.Context, userID int64) ([]*models.UserStoreAccount, error) {
	accounts, err := s.repo.GetUserStoreAccounts(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Don't expose encrypted tokens
	for _, acc := range accounts {
		acc.AccessToken = nil
		acc.RefreshToken = nil
	}

	return accounts, nil
}

func (s *service) DisconnectStoreAccount(ctx context.Context, userID int64, store string) error {
	return s.repo.DeleteStoreAccount(ctx, userID, store)
}

func (s *service) SyncStoreLibrary(ctx context.Context, userID int64, store string) error {
	// Get store account
	account, err := s.repo.GetUserStoreAccount(ctx, userID, store)
	if err != nil {
		return fmt.Errorf("store account not found: %w", err)
	}

	if !account.IsConnected {
		return fmt.Errorf("store account is not connected")
	}

	// Decrypt access token
	accessToken, err := s.encryptor.Decrypt(account.AccessToken)
	if err != nil {
		return fmt.Errorf("failed to decrypt access token: %w", err)
	}

	// Get store client
	client, ok := s.storeManager.GetClient(store)
	if !ok {
		return fmt.Errorf("unsupported store: %s", store)
	}

	// Fetch user's games from store
	log.Printf("Fetching games from %s for user %d", store, userID)
	storeGames, err := client.GetUserGames(ctx, string(accessToken))
	if err != nil {
		return fmt.Errorf("failed to fetch games from %s: %w", store, err)
	}

	log.Printf("Fetched %d games from %s", len(storeGames), store)

	// Process each game
	for _, storeGame := range storeGames {
		if err := s.importGameFromStore(ctx, userID, store, &storeGame); err != nil {
			log.Printf("failed to import game %s: %v", storeGame.Name, err)
			continue
		}
	}

	// Update last synced time
	now := time.Now()
	account.LastSyncedAt = &now
	if err := s.repo.UpdateStoreAccount(ctx, account); err != nil {
		log.Printf("failed to update last synced time: %v", err)
	}

	return nil
}

func (s *service) SyncAllLibraries(ctx context.Context, userID int64) error {
	accounts, err := s.repo.GetUserStoreAccounts(ctx, userID)
	if err != nil {
		return err
	}

	log.Printf("SyncAllLibraries: Found %d store accounts for user %d", len(accounts), userID)

	for _, account := range accounts {
		log.Printf("Processing account: store=%s, connected=%v, auto_import=%v", account.Store, account.IsConnected, account.AutoImport)

		if !account.IsConnected || !account.AutoImport {
			log.Printf("Skipping %s: connected=%v, auto_import=%v", account.Store, account.IsConnected, account.AutoImport)
			continue
		}

		if err := s.SyncStoreLibrary(ctx, userID, account.Store); err != nil {
			log.Printf("failed to sync %s: %v", account.Store, err)
		}
	}

	return nil
}

func (s *service) importGameFromStore(ctx context.Context, userID int64, store string, storeGame *stores.StoreGameInfo) error {
	// Check if game exists in our database by store ID
	game, err := s.repo.GetGameByStoreID(ctx, store, storeGame.StoreGameID)

	if err != nil {
		// Game doesn't exist, create it
		game = &models.Game{
			Name:            storeGame.Name,
			Description:     storeGame.Description,
			Developer:       storeGame.Developer,
			Publisher:       storeGame.Publisher,
			ReleaseDate:     storeGame.ReleaseDate,
			CoverImage:      storeGame.CoverImage,
			BackgroundImage: storeGame.BackgroundImage,
			Icon:            storeGame.Icon,
			Genres:          storeGame.Genres,
			Tags:            storeGame.Tags,
			Platforms:       storeGame.Platforms,
		}

		game, err = s.repo.CreateGame(ctx, game)
		if err != nil {
			return fmt.Errorf("failed to create game: %w", err)
		}
	}

	// Create or update store game entry
	storeGameEntry := &models.StoreGame{
		GameID:        game.ID,
		Store:         store,
		StoreGameID:   storeGame.StoreGameID,
		StoreURL:      storeGame.StoreURL,
		Price:         storeGame.Price,
		DiscountPrice: storeGame.DiscountPrice,
		Currency:      storeGame.Currency,
		IsAvailable:   true,
		LastChecked:   time.Now(),
	}

	_, err = s.repo.CreateStoreGame(ctx, storeGameEntry)
	if err != nil {
		log.Printf("failed to create store game: %v", err)
	}

	// Add to user's library
	libraryEntry := &models.UserLibrary{
		UserID:           userID,
		GameID:           game.ID,
		Store:            store,
		StoreGameID:      storeGame.StoreGameID,
		PlayTime:         storeGame.PlayTime,
		LastPlayed:       storeGame.LastPlayed,
		CompletionStatus: string(models.StatusNotPlayed),
	}

	_, err = s.repo.AddToLibrary(ctx, libraryEntry)
	if err != nil {
		return fmt.Errorf("failed to add to library: %w", err)
	}

	return nil
}

func (s *service) SearchGames(ctx context.Context, filter *models.SearchFilter) ([]*models.GameWithStores, error) {
	return s.repo.SearchGames(ctx, filter)
}

func (s *service) SearchAllStores(ctx context.Context, query string, limit int) (map[string][]stores.StoreGameInfo, error) {
	return s.storeManager.SearchAllStores(ctx, query, limit)
}

func (s *service) GetGameDetails(ctx context.Context, gameID int64) (*models.GameWithStores, error) {
	game, err := s.repo.GetGameByID(ctx, gameID)
	if err != nil {
		return nil, err
	}

	storeGames, err := s.repo.GetStoreGames(ctx, gameID)
	if err != nil {
		return nil, err
	}

	result := &models.GameWithStores{
		Game:   *game,
		Stores: make([]models.StoreGame, len(storeGames)),
	}

	for i, sg := range storeGames {
		result.Stores[i] = *sg
	}

	return result, nil
}
