// internal/models/game.go
package models

import "time"

type Game struct {
	ID              int64      `json:"id" db:"id"`
	Name            string     `json:"name" db:"name"`
	Description     string     `json:"description" db:"description"`
	ReleaseDate     *time.Time `json:"release_date,omitempty" db:"release_date"`
	Developer       string     `json:"developer" db:"developer"`
	Publisher       string     `json:"publisher" db:"publisher"`
	CoverImage      string     `json:"cover_image" db:"cover_image"`
	BackgroundImage string     `json:"background_image" db:"background_image"`
	Icon            string     `json:"icon" db:"icon"`
	Genres          []string   `json:"genres"`
	Tags            []string   `json:"tags"`
	Platforms       []string   `json:"platforms"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
}

type GameMetadata struct {
	GameID          int64     `json:"game_id" db:"game_id"`
	MetacriticScore *int      `json:"metacritic_score,omitempty" db:"metacritic_score"`
	UserRating      *float64  `json:"user_rating,omitempty" db:"user_rating"`
	RatingCount     int       `json:"rating_count" db:"rating_count"`
	PlayTime        int       `json:"play_time" db:"play_time"` // average playtime in minutes
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}

type StoreGame struct {
	ID            int64     `json:"id" db:"id"`
	GameID        int64     `json:"game_id" db:"game_id"`
	Store         string    `json:"store" db:"store"` // steam, epic, gog, etc.
	StoreGameID   string    `json:"store_game_id" db:"store_game_id"`
	StoreURL      string    `json:"store_url" db:"store_url"`
	Price         *float64  `json:"price,omitempty" db:"price"`
	DiscountPrice *float64  `json:"discount_price,omitempty" db:"discount_price"`
	Currency      string    `json:"currency" db:"currency"`
	IsAvailable   bool      `json:"is_available" db:"is_available"`
	LastChecked   time.Time `json:"last_checked" db:"last_checked"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

type UserLibrary struct {
	ID               int64      `json:"id" db:"id"`
	UserID           int64      `json:"user_id" db:"user_id"`
	GameID           int64      `json:"game_id" db:"game_id"`
	Store            string     `json:"store" db:"store"`
	StoreGameID      string     `json:"store_game_id" db:"store_game_id"`
	PlayTime         int        `json:"play_time" db:"play_time"` // in minutes
	LastPlayed       *time.Time `json:"last_played,omitempty" db:"last_played"`
	InstallPath      string     `json:"install_path" db:"install_path"`
	IsInstalled      bool       `json:"is_installed" db:"is_installed"`
	IsFavorite       bool       `json:"is_favorite" db:"is_favorite"`
	IsHidden         bool       `json:"is_hidden" db:"is_hidden"`
	CompletionStatus string     `json:"completion_status" db:"completion_status"` // not_played, playing, completed, etc.
	UserRating       *int       `json:"user_rating,omitempty" db:"user_rating"`   // 1-5
	UserNotes        string     `json:"user_notes" db:"user_notes"`
	AddedAt          time.Time  `json:"added_at" db:"added_at"`
	UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`
}

type Wishlist struct {
	ID               int64     `json:"id" db:"id"`
	UserID           int64     `json:"user_id" db:"user_id"`
	GameID           int64     `json:"game_id" db:"game_id"`
	Priority         int       `json:"priority" db:"priority"` // 1-5
	Notes            string    `json:"notes" db:"notes"`
	NotifyOnDiscount bool      `json:"notify_on_discount" db:"notify_on_discount"`
	MaxPrice         *float64  `json:"max_price,omitempty" db:"max_price"`
	AddedAt          time.Time `json:"added_at" db:"added_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
}

type UserStoreAccount struct {
	ID             int64      `json:"id" db:"id"`
	UserID         int64      `json:"user_id" db:"user_id"`
	Store          string     `json:"store" db:"store"`
	StoreUserID    string     `json:"store_user_id" db:"store_user_id"`
	DisplayName    string     `json:"display_name" db:"display_name"`
	AvatarURL      string     `json:"avatar_url" db:"avatar_url"`
	AccessToken    []byte     `json:"-" db:"access_token_enc"`  // encrypted
	RefreshToken   []byte     `json:"-" db:"refresh_token_enc"` // encrypted
	TokenExpiresAt *time.Time `json:"token_expires_at,omitempty" db:"expires_at"`
	IsConnected    bool       `json:"is_connected" db:"is_connected"`
	LastSyncedAt   *time.Time `json:"last_synced_at,omitempty" db:"last_synced_at"`
	AutoImport     bool       `json:"auto_import" db:"auto_import"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
}

// Combined response structures for API
type GameWithStores struct {
	Game
	Stores []StoreGame `json:"stores"`
}

type LibraryGameDetail struct {
	Game
	UserLibrary
	Stores []StoreGame `json:"stores"`
}

type WishlistItem struct {
	Wishlist
	Game
	BestPrice *StoreGame `json:"best_price,omitempty"`
}
