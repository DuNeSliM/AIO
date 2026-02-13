package config

import (
	"log"
	"os"
	"strconv"
)

type Config struct {
	Port string

	// IsThereAnyDeal API key
	ITADAPIKey string

	// Frontend origin for CORS/callbacks
	FrontendOrigin string

	// Steam Web API key
	SteamAPIKey string

	// Steam OAuth callback URL
	SteamCallbackURL string

	// Epic Games OAuth credentials
	EpicClientID     string
	EpicClientSecret string
	EpicCallbackURL  string
	// Keycloak configuration
	KeycloakURL                  string
	KeycloakRealm                string
	KeycloakClientID             string
	KeycloakClientSecret         string
	KeycloakRequireEmailVerified bool
}

func Load() Config {
	port := getenv("PORT", "8080")
	itadAPIKey := mustGetenv("ISTHEREANYDEAL_API_KEY")
	frontendOrigin := getenv("FRONTEND_ORIGIN", "http://localhost:3000")
	if frontendOrigin == "" {
		frontendOrigin = "http://localhost:3000"
	}
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
	keycloakRequireEmailVerified := getenvBool("KEYCLOAK_REQUIRE_EMAIL_VERIFIED", true)

	return Config{
		Port:                 port,
		ITADAPIKey:           itadAPIKey,
		FrontendOrigin:       frontendOrigin,
		SteamAPIKey:          steamAPIKey,
		SteamCallbackURL:     steamCallbackURL,
		EpicClientID:         epicClientID,
		EpicClientSecret:     epicClientSecret,
		EpicCallbackURL:      epicCallbackURL,
		KeycloakURL:                  keycloakURL,
		KeycloakRealm:                keycloakRealm,
		KeycloakClientID:             keycloakClientID,
		KeycloakClientSecret:         keycloakClientSecret,
		KeycloakRequireEmailVerified: keycloakRequireEmailVerified,
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

func getenvBool(key string, def bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return def
	}

	parsed, err := strconv.ParseBool(v)
	if err != nil {
		log.Printf("invalid boolean value for %s, using default %t", key, def)
		return def
	}

	return parsed
}
