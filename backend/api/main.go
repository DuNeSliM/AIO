package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"

	"aoi/api/internal/auth"
	"aoi/api/internal/crypto"
	httpHandlers "aoi/api/internal/http"
	"aoi/api/internal/library"
	"aoi/api/internal/stores"
	"aoi/api/internal/users"
)

func generateRandomKey(size int) string {
	key := make([]byte, size)
	if _, err := rand.Read(key); err != nil {
		log.Fatalf("failed to generate random key: %v", err)
	}
	return base64.StdEncoding.EncodeToString(key)
}

func getOrGenerateKey(envKey string, size int) string {
	if v := os.Getenv(envKey); v != "" {
		return v
	}
	key := generateRandomKey(size)
	log.Printf("Auto-generated %s (save this to .env for persistence): %s", envKey, key)
	return key
}

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Basic config
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	jwtSecret := getOrGenerateKey("JWT_SECRET", 32)
	encKeyB64 := getOrGenerateKey("ENCRYPTION_KEY", 32)
	dbURL := os.Getenv("DATABASE_URL")

	// Encryption helper
	encryptor, err := crypto.NewEncryptorFromBase64Key(encKeyB64)
	if err != nil {
		log.Fatalf("invalid ENCRYPTION_KEY: %v", err)
	}
	_ = encryptor // Used in library service

	// Database connection (optional - falls back to in-memory if not set)
	var db *sql.DB
	if dbURL != "" {
		db, err = sql.Open("postgres", dbURL)
		if err != nil {
			log.Fatalf("failed to connect to database: %v", err)
		}
		defer db.Close()

		if err := db.Ping(); err != nil {
			log.Fatalf("failed to ping database: %v", err)
		}
		log.Println("Connected to database")
	} else {
		log.Println("No DATABASE_URL set, using in-memory storage (not recommended for production)")
	}

	// Users: in-memory repo + service for now
	userRepo := users.NewInMemoryRepository()
	userSvc := users.NewService(userRepo)

	// JWT & external providers
	jwtSvc := auth.NewJWTService(jwtSecret)
	externalAuthSvc := auth.NewExternalAuthService(userRepo, encryptor)

	// Store manager for all game store integrations
	storeManager := stores.NewStoreManager()

	// Library service - use in-memory if no DB
	var librarySvc library.Service
	if db != nil {
		libraryRepo := library.NewPostgresRepository(db)
		librarySvc = library.NewService(libraryRepo, storeManager, encryptor)
	} else {
		// Create in-memory library service for testing
		libraryRepo := library.NewInMemoryRepository()
		librarySvc = library.NewService(libraryRepo, storeManager, encryptor)
	}

	// Gin router
	r := gin.Default()

	// Enable CORS for Tauri frontend
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Wire all routes
	httpHandlers.RegisterRoutes(r, jwtSecret, jwtSvc, userSvc, externalAuthSvc, librarySvc, encryptor)

	log.Printf("Server starting on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
