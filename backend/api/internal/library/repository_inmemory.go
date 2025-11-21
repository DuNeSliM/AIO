package library

import (
	"context"
	"fmt"
	"sync"
	"time"

	"aoi/api/internal/models"
)

type inMemoryRepository struct {
	mu            sync.RWMutex
	games         map[int64]*models.Game
	storeGames    map[int64][]*models.StoreGame
	library       map[int64]map[int64]*models.UserLibrary // userID -> gameID -> entry
	wishlist      map[int64]map[int64]*models.Wishlist
	storeAccounts map[int64]map[string]*models.UserStoreAccount // userID -> store -> account
	nextID        int64
}

func NewInMemoryRepository() Repository {
	return &inMemoryRepository{
		games:         make(map[int64]*models.Game),
		storeGames:    make(map[int64][]*models.StoreGame),
		library:       make(map[int64]map[int64]*models.UserLibrary),
		wishlist:      make(map[int64]map[int64]*models.Wishlist),
		storeAccounts: make(map[int64]map[string]*models.UserStoreAccount),
		nextID:        1,
	}
}

// Game operations
func (r *inMemoryRepository) CreateGame(ctx context.Context, game *models.Game) (*models.Game, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.nextID++
	game.ID = r.nextID
	game.CreatedAt = time.Now()
	game.UpdatedAt = time.Now()
	r.games[game.ID] = game
	return game, nil
}

func (r *inMemoryRepository) GetGameByID(ctx context.Context, id int64) (*models.Game, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	game, ok := r.games[id]
	if !ok {
		return nil, fmt.Errorf("game not found")
	}
	return game, nil
}

func (r *inMemoryRepository) GetGameByStoreID(ctx context.Context, store, storeGameID string) (*models.Game, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	// Search through store games
	for gameID, storeGames := range r.storeGames {
		for _, sg := range storeGames {
			if sg.Store == store && sg.StoreGameID == storeGameID {
				return r.games[gameID], nil
			}
		}
	}
	return nil, fmt.Errorf("game not found")
}

func (r *inMemoryRepository) SearchGames(ctx context.Context, filter *models.SearchFilter) ([]*models.GameWithStores, error) {
	return []*models.GameWithStores{}, nil
}

func (r *inMemoryRepository) UpdateGame(ctx context.Context, game *models.Game) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.games[game.ID]; !ok {
		return fmt.Errorf("game not found")
	}
	game.UpdatedAt = time.Now()
	r.games[game.ID] = game
	return nil
}

// Store game operations
func (r *inMemoryRepository) CreateStoreGame(ctx context.Context, storeGame *models.StoreGame) (*models.StoreGame, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.nextID++
	storeGame.ID = r.nextID
	storeGame.CreatedAt = time.Now()
	storeGame.UpdatedAt = time.Now()
	r.storeGames[storeGame.GameID] = append(r.storeGames[storeGame.GameID], storeGame)
	return storeGame, nil
}

func (r *inMemoryRepository) GetStoreGames(ctx context.Context, gameID int64) ([]*models.StoreGame, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.storeGames[gameID], nil
}

func (r *inMemoryRepository) UpdateStoreGame(ctx context.Context, storeGame *models.StoreGame) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	storeGames := r.storeGames[storeGame.GameID]
	for i, sg := range storeGames {
		if sg.ID == storeGame.ID {
			storeGame.UpdatedAt = time.Now()
			storeGames[i] = storeGame
			return nil
		}
	}
	return fmt.Errorf("store game not found")
}

// User library operations
func (r *inMemoryRepository) AddToLibrary(ctx context.Context, entry *models.UserLibrary) (*models.UserLibrary, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.library[entry.UserID] == nil {
		r.library[entry.UserID] = make(map[int64]*models.UserLibrary)
	}

	r.nextID++
	entry.ID = r.nextID
	entry.AddedAt = time.Now()
	entry.UpdatedAt = time.Now()
	r.library[entry.UserID][entry.GameID] = entry
	return entry, nil
}

func (r *inMemoryRepository) GetUserLibrary(ctx context.Context, userID int64, filter *models.LibraryFilter) ([]*models.LibraryGameDetail, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := []*models.LibraryGameDetail{}
	userLib := r.library[userID]

	for _, entry := range userLib {
		game := r.games[entry.GameID]
		if game != nil {
			detail := &models.LibraryGameDetail{
				Game:        *game,
				UserLibrary: *entry,
				Stores:      []models.StoreGame{},
			}
			result = append(result, detail)
		}
	}

	return result, nil
}

func (r *inMemoryRepository) GetLibraryEntry(ctx context.Context, userID, gameID int64) (*models.UserLibrary, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if r.library[userID] == nil {
		return nil, fmt.Errorf("entry not found")
	}
	entry, ok := r.library[userID][gameID]
	if !ok {
		return nil, fmt.Errorf("entry not found")
	}
	return entry, nil
}

func (r *inMemoryRepository) UpdateLibraryEntry(ctx context.Context, entry *models.UserLibrary) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.library[entry.UserID] == nil {
		return fmt.Errorf("entry not found")
	}
	if _, ok := r.library[entry.UserID][entry.GameID]; !ok {
		return fmt.Errorf("entry not found")
	}
	entry.UpdatedAt = time.Now()
	r.library[entry.UserID][entry.GameID] = entry
	return nil
}

func (r *inMemoryRepository) RemoveFromLibrary(ctx context.Context, userID, libraryID int64) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.library[userID] == nil {
		return fmt.Errorf("entry not found")
	}
	for gameID, entry := range r.library[userID] {
		if entry.ID == libraryID {
			delete(r.library[userID], gameID)
			return nil
		}
	}
	return fmt.Errorf("entry not found")
}

// Wishlist operations
func (r *inMemoryRepository) AddToWishlist(ctx context.Context, wishlist *models.Wishlist) (*models.Wishlist, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.wishlist[wishlist.UserID] == nil {
		r.wishlist[wishlist.UserID] = make(map[int64]*models.Wishlist)
	}

	r.nextID++
	wishlist.ID = r.nextID
	wishlist.AddedAt = time.Now()
	r.wishlist[wishlist.UserID][wishlist.GameID] = wishlist
	return wishlist, nil
}

func (r *inMemoryRepository) GetUserWishlist(ctx context.Context, userID int64) ([]*models.WishlistItem, error) {
	return []*models.WishlistItem{}, nil
}

func (r *inMemoryRepository) GetWishlistItem(ctx context.Context, userID, gameID int64) (*models.Wishlist, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if r.wishlist[userID] == nil {
		return nil, fmt.Errorf("item not found")
	}
	item, ok := r.wishlist[userID][gameID]
	if !ok {
		return nil, fmt.Errorf("item not found")
	}
	return item, nil
}

func (r *inMemoryRepository) UpdateWishlistItem(ctx context.Context, wishlist *models.Wishlist) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.wishlist[wishlist.UserID] == nil {
		return fmt.Errorf("item not found")
	}
	if _, ok := r.wishlist[wishlist.UserID][wishlist.GameID]; !ok {
		return fmt.Errorf("item not found")
	}
	r.wishlist[wishlist.UserID][wishlist.GameID] = wishlist
	return nil
}

func (r *inMemoryRepository) RemoveFromWishlist(ctx context.Context, userID, wishlistID int64) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.wishlist[userID] == nil {
		return fmt.Errorf("item not found")
	}
	for gameID, item := range r.wishlist[userID] {
		if item.ID == wishlistID {
			delete(r.wishlist[userID], gameID)
			return nil
		}
	}
	return fmt.Errorf("item not found")
}

// Store account operations
func (r *inMemoryRepository) CreateStoreAccount(ctx context.Context, account *models.UserStoreAccount) (*models.UserStoreAccount, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.storeAccounts[account.UserID] == nil {
		r.storeAccounts[account.UserID] = make(map[string]*models.UserStoreAccount)
	}

	r.nextID++
	account.ID = r.nextID
	account.CreatedAt = time.Now()
	account.UpdatedAt = time.Now()
	r.storeAccounts[account.UserID][account.Store] = account
	return account, nil
}

func (r *inMemoryRepository) GetUserStoreAccounts(ctx context.Context, userID int64) ([]*models.UserStoreAccount, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := []*models.UserStoreAccount{}
	for _, account := range r.storeAccounts[userID] {
		result = append(result, account)
	}
	return result, nil
}

func (r *inMemoryRepository) GetUserStoreAccount(ctx context.Context, userID int64, store string) (*models.UserStoreAccount, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if r.storeAccounts[userID] == nil {
		return nil, fmt.Errorf("account not found")
	}
	account, ok := r.storeAccounts[userID][store]
	if !ok {
		return nil, fmt.Errorf("account not found")
	}
	return account, nil
}

func (r *inMemoryRepository) UpdateStoreAccount(ctx context.Context, account *models.UserStoreAccount) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.storeAccounts[account.UserID] == nil {
		return fmt.Errorf("account not found")
	}
	if _, ok := r.storeAccounts[account.UserID][account.Store]; !ok {
		return fmt.Errorf("account not found")
	}
	account.UpdatedAt = time.Now()
	r.storeAccounts[account.UserID][account.Store] = account
	return nil
}

func (r *inMemoryRepository) DeleteStoreAccount(ctx context.Context, userID int64, store string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.storeAccounts[userID] == nil {
		return fmt.Errorf("account not found")
	}
	if _, ok := r.storeAccounts[userID][store]; !ok {
		return fmt.Errorf("account not found")
	}
	delete(r.storeAccounts[userID], store)
	return nil
}
