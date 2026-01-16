package config

import (
	"log"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port          string
	DatabaseURL   string
	PriceTTL      time.Duration
	DailyInterval time.Duration
}

func Load() Config {
	port := getenv("PORT", "8080")
	dsn := mustGetenv("DATABASE_URL")

	ttlHours := getenvInt("PRICE_TTL_HOURS", 12)
	dailyHours := getenvInt("DAILY_UPDATE_HOURS", 24)

	return Config{
		Port:          port,
		DatabaseURL:   dsn,
		PriceTTL:      time.Duration(ttlHours) * time.Hour,
		DailyInterval: time.Duration(dailyHours) * time.Hour,
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

func getenvInt(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}
