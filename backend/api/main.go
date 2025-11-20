package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"

	"aoi/api/internal/auth"
	"aoi/api/internal/crypto"
	httpHandlers "aoi/api/internal/http"
	"aoi/api/internal/users"
)

func mustGetEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("missing required env var %s", key)
	}
	return v
}

func main() {
	// Basic config
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	jwtSecret := mustGetEnv("JWT_SECRET")
	encKeyB64 := mustGetEnv("ENCRYPTION_KEY")

	// Encryption helper (for provider tokens etc. – not wired yet, but ready)
	_, err := crypto.NewEncryptorFromBase64Key(encKeyB64)
	if err != nil {
		log.Fatalf("invalid ENCRYPTION_KEY: %v", err)
	}

	// Users: in-memory repo + service for now
	userRepo := users.NewInMemoryRepository()
	userSvc := users.NewService(userRepo)

	// JWT & external providers
	jwtSvc := auth.NewJWTService(jwtSecret)
	externalAuthSvc := auth.NewExternalAuthService(userRepo) // dummy; replace later

	// Gin router
	r := gin.Default()

	// Wire all routes
	httpHandlers.RegisterRoutes(r, jwtSecret, jwtSvc, userSvc, externalAuthSvc)

	log.Printf("listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
