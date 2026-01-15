package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port          string
	DBPath        string
	PriceTTL      time.Duration
	DailyInterval time.Duration
}

func Load() Config {
	port := getenv("PORT", "8080")
	dbPath := getenv("DB_PATH", "data.sqlite")

	ttlHours := getenvInt("PRICE_TTL_HOURS", 12)
	dailyHours := getenvInt("DAILY_UPDATE_HOURS", 24)

	return Config{
		Port:          port,
		DBPath:        dbPath,
		PriceTTL:      time.Duration(ttlHours) * time.Hour,
		DailyInterval: time.Duration(dailyHours) * time.Hour,
	}
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
