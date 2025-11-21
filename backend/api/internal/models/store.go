// internal/models/store.go
package models

// Store represents supported game stores
type Store string

const (
	StoreSteam     Store = "steam"
	StoreEpic      Store = "epic"
	StoreGOG       Store = "gog"
	StoreAmazon    Store = "amazon"
	StoreXbox      Store = "xbox"
	StoreBattleNet Store = "battlenet"
	StoreUplay     Store = "uplay"
	StoreEAApp     Store = "ea"
	StorePSN       Store = "psn"
)

var ValidStores = []Store{
	StoreSteam,
	StoreEpic,
	StoreGOG,
	StoreAmazon,
	StoreXbox,
	StoreBattleNet,
	StoreUplay,
	StoreEAApp,
	StorePSN,
}

func (s Store) String() string {
	return string(s)
}

func IsValidStore(store string) bool {
	for _, s := range ValidStores {
		if s.String() == store {
			return true
		}
	}
	return false
}

// CompletionStatus represents game completion states
type CompletionStatus string

const (
	StatusNotPlayed  CompletionStatus = "not_played"
	StatusPlaying    CompletionStatus = "playing"
	StatusCompleted  CompletionStatus = "completed"
	StatusAbandoned  CompletionStatus = "abandoned"
	StatusOnHold     CompletionStatus = "on_hold"
	StatusPlatinumed CompletionStatus = "platinumed"
)

// SearchFilter represents search and filter options
type SearchFilter struct {
	Query          string   `json:"query"`
	Stores         []string `json:"stores"`
	Genres         []string `json:"genres"`
	Tags           []string `json:"tags"`
	Platforms      []string `json:"platforms"`
	MinPrice       *float64 `json:"min_price"`
	MaxPrice       *float64 `json:"max_price"`
	OnSale         bool     `json:"on_sale"`
	MinRating      *float64 `json:"min_rating"`
	ReleasedAfter  *string  `json:"released_after"`
	ReleasedBefore *string  `json:"released_before"`
	SortBy         string   `json:"sort_by"`    // name, release_date, price, rating
	SortOrder      string   `json:"sort_order"` // asc, desc
	Limit          int      `json:"limit"`
	Offset         int      `json:"offset"`
}

type LibraryFilter struct {
	Stores           []string `json:"stores"`
	Genres           []string `json:"genres"`
	Tags             []string `json:"tags"`
	Platforms        []string `json:"platforms"`
	CompletionStatus []string `json:"completion_status"`
	IsFavorite       *bool    `json:"is_favorite"`
	IsInstalled      *bool    `json:"is_installed"`
	IsHidden         *bool    `json:"is_hidden"`
	MinPlayTime      *int     `json:"min_play_time"`
	MinRating        *int     `json:"min_rating"`
	Query            string   `json:"query"`
	SortBy           string   `json:"sort_by"`    // name, play_time, last_played, added_at
	SortOrder        string   `json:"sort_order"` // asc, desc
	Limit            int      `json:"limit"`
	Offset           int      `json:"offset"`
}
