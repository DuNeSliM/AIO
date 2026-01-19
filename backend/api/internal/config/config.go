package config

import (
	"log"
	"os"
)

type Config struct {
	Port string

	// IsThereAnyDeal API key
	ITADAPIKey string

	// ZITADEL issuer URL for JWT validation
	ZitadelIssuer string
}

func Load() Config {
	port := getenv("PORT", "8080")
	itadAPIKey := mustGetenv("ISTHEREANYDEAL_API_KEY")
	zitadelIssuer := getenv("ZITADEL_ISSUER", "https://auth.gamedivers.de")

	return Config{
		Port:          port,
		ITADAPIKey:    itadAPIKey,
		ZitadelIssuer: zitadelIssuer,
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
