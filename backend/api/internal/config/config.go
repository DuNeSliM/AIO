package config

import (
	"log"
	"os"
)

type Config struct {
	Port string

	// IsThereAnyDeal API key
	ITADAPIKey string

	// Steam Web API key
	SteamAPIKey string

	// Steam OAuth callback URL
	SteamCallbackURL string

	// Epic Games OAuth credentials
	EpicClientID     string
	EpicClientSecret string
	EpicCallbackURL  string
}

func Load() Config {
	port := getenv("PORT", "8080")
	itadAPIKey := mustGetenv("ISTHEREANYDEAL_API_KEY")
	steamAPIKey := getenv("STEAM_API_KEY", "")
	steamCallbackURL := getenv("STEAM_CALLBACK_URL", "http://localhost:8080/v1/steam/callback")
	epicClientID := getenv("EPIC_CLIENT_ID", "")
	epicClientSecret := getenv("EPIC_CLIENT_SECRET", "")
	epicCallbackURL := getenv("EPIC_CALLBACK_URL", "http://localhost:8080/v1/epic/callback")

	return Config{
		Port:             port,
		ITADAPIKey:       itadAPIKey,
		SteamAPIKey:      steamAPIKey,
		SteamCallbackURL: steamCallbackURL,
		EpicClientID:     epicClientID,
		EpicClientSecret: epicClientSecret,
		EpicCallbackURL:  epicCallbackURL,
	}
}

func mustGetenv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("%s is required", key)
	}
	return v
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
