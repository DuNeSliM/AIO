package gog

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

// ManifestGame represents a game from GOG Galaxy local manifest
type ManifestGame struct {
	GameID    string `json:"gameId"`
	ProductID string `json:"productId"`
	Title     string `json:"title"`
	Image     string `json:"image,omitempty"`
}

// ManifestData represents the structure of GOG Galaxy manifest
type ManifestData struct {
	Installed []ManifestGame `json:"installed,omitempty"`
	Updated   []ManifestGame `json:"updated,omitempty"`
	Owned     []ManifestGame `json:"owned,omitempty"`
}

// WishlistData represents wishlist data from GOG Galaxy manifest
type WishlistData struct {
	Wishlist []ManifestGame `json:"wishlist,omitempty"`
}

// ManifestReader handles reading GOG Galaxy local manifest
type ManifestReader struct {
	manifestPath string
}

// NewManifestReader creates a new manifest reader
func NewManifestReader() *ManifestReader {
	return &ManifestReader{
		manifestPath: getGOGManifestPath(),
	}
}

// getGOGManifestPath returns the path to GOG Galaxy manifest based on OS
func getGOGManifestPath() string {
	switch runtime.GOOS {
	case "windows":
		programData := os.Getenv("ProgramData")
		if programData == "" {
			programData = "C:\\ProgramData"
		}
		return filepath.Join(programData, "GOG.com", "Galaxy", "storage")
	case "linux":
		home, _ := os.UserHomeDir()
		return filepath.Join(home, ".config", "GOG.com", "Galaxy", "storage")
	case "darwin":
		home, _ := os.UserHomeDir()
		return filepath.Join(home, "Library", "Application Support", "GOG.com", "Galaxy", "storage")
	default:
		return ""
	}
}

// GetLibrary reads installed games from GOG Galaxy manifest
func (mr *ManifestReader) GetLibrary() ([]ManifestGame, error) {
	if mr.manifestPath == "" {
		return nil, fmt.Errorf("GOG Galaxy not found or unsupported OS")
	}

	libraryFile := filepath.Join(mr.manifestPath, "library.json")
	data, err := os.ReadFile(libraryFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read GOG manifest: %w", err)
	}

	var manifest ManifestData
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("failed to parse GOG manifest: %w", err)
	}

	// Return installed games, fallback to updated or owned
	if len(manifest.Installed) > 0 {
		return manifest.Installed, nil
	}
	if len(manifest.Updated) > 0 {
		return manifest.Updated, nil
	}
	return manifest.Owned, nil
}

// GetWishlist reads wishlist from GOG Galaxy manifest
func (mr *ManifestReader) GetWishlist() ([]ManifestGame, error) {
	if mr.manifestPath == "" {
		return nil, fmt.Errorf("GOG Galaxy not found or unsupported OS")
	}

	wishlistFile := filepath.Join(mr.manifestPath, "wishlist.json")
	data, err := os.ReadFile(wishlistFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read GOG wishlist: %w", err)
	}

	var wishlist WishlistData
	if err := json.Unmarshal(data, &wishlist); err != nil {
		return nil, fmt.Errorf("failed to parse GOG wishlist: %w", err)
	}

	return wishlist.Wishlist, nil
}

// IsAvailable checks if GOG Galaxy manifest is available on this system
func (mr *ManifestReader) IsAvailable() bool {
	if mr.manifestPath == "" {
		return false
	}
	_, err := os.Stat(filepath.Join(mr.manifestPath, "library.json"))
	return err == nil
}
