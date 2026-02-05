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
	// Keycloak configuration
	KeycloakURL          string
	KeycloakRealm        string
	KeycloakClientID     string
	KeycloakClientSecret string
}

func Load() Config {
	port := getenv("PORT", "8080")
	itadAPIKey := mustGetenv("ISTHEREANYDEAL_API_KEY")
	steamAPIKey := getenv("STEAM_API_KEY", "")
	steamCallbackURL := getenv("STEAM_CALLBACK_URL", "http://localhost:8080/v1/steam/callback")
	epicClientID := getenv("EPIC_CLIENT_ID", "")
	epicClientSecret := getenv("EPIC_CLIENT_SECRET", "")
	epicCallbackURL := getenv("EPIC_CALLBACK_URL", "http://localhost:8080/v1/epic/callback")

	// Keycloak config
	keycloakURL := mustGetenv("KEYCLOAK_URL")
	keycloakRealm := mustGetenv("KEYCLOAK_REALM")
	keycloakClientID := mustGetenv("KEYCLOAK_CLIENT_ID")
	keycloakClientSecret := mustGetenv("KEYCLOAK_CLIENT_SECRET")

	return Config{
		Port:             port,
		ITADAPIKey:       itadAPIKey,
		SteamAPIKey:      steamAPIKey,
		SteamCallbackURL: steamCallbackURL,
		EpicClientID:     epicClientID,
		EpicClientSecret: epicClientSecret,
		EpicCallbackURL:  epicCallbackURL,
		Port:                 port,
		ITADAPIKey:           itadAPIKey,
		KeycloakURL:          keycloakURL,
		KeycloakRealm:        keycloakRealm,
		KeycloakClientID:     keycloakClientID,
		KeycloakClientSecret: keycloakClientSecret,
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
