// internal/http/routes.go
package http

import (
	"io"
	nethttp "net/http"

	"github.com/gin-gonic/gin"

	"aoi/api/internal/auth"
	"aoi/api/internal/crypto"
	"aoi/api/internal/library"
	"aoi/api/internal/users"
)

// RegisterRoutes wires all routes into the Gin engine.
func RegisterRoutes(
	r *gin.Engine,
	jwtSecret string,
	jwtSvc auth.JWTService,
	userSvc users.Service,
	externalSvc auth.ExternalAuthService,
	librarySvc library.Service,
	encryptor crypto.Encryptor,
) {
	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(nethttp.StatusOK, gin.H{"status": "ok"})
	})

	// Epic sync instructions page
	r.GET("/epic-instructions", func(c *gin.Context) {
		c.Header("Content-Type", "text/html; charset=utf-8")
		c.File("./internal/http/epic_instructions.html")
	})

	// Epic sync completion page (reads from localStorage)
	r.GET("/epic-sync-complete", func(c *gin.Context) {
		c.Header("Content-Type", "text/html; charset=utf-8")
		c.File("./internal/http/epic_sync_complete.html")
	})

	// Epic order history proxy (to avoid CORS issues)
	r.GET("/epic-order-proxy", func(c *gin.Context) {
		nextPageToken := c.Query("nextPageToken")

		// Forward request to Epic with cookies from the request
		client := &nethttp.Client{
			CheckRedirect: func(req *nethttp.Request, via []*nethttp.Request) error {
				return nethttp.ErrUseLastResponse // Don't follow redirects
			},
		}
		req, _ := nethttp.NewRequest("GET",
			"https://www.epicgames.com/account/v2/payment/ajaxGetOrderHistory?sortDir=DESC&sortBy=DATE&nextPageToken="+nextPageToken+"&locale=en-US",
			nil)

		// Copy cookies from incoming request
		if cookie := c.GetHeader("Cookie"); cookie != "" {
			req.Header.Set("Cookie", cookie)
		}

		// Set headers to match browser request
		if userAgent := c.GetHeader("User-Agent"); userAgent != "" {
			req.Header.Set("User-Agent", userAgent)
		} else {
			req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
		}
		req.Header.Set("Accept", "application/json")
		req.Header.Set("Referer", "https://www.epicgames.com/account/transactions")

		resp, err := client.Do(req)
		if err != nil {
			c.JSON(nethttp.StatusInternalServerError, gin.H{"error": "Failed to fetch from Epic"})
			return
		}
		defer resp.Body.Close()

		// Enable CORS
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Content-Type", "application/json")

		c.Status(resp.StatusCode)
		io.Copy(c.Writer, resp.Body)
	})

	// Epic browser sync (unauth POST for form submission, bypasses CSP)
	if librarySvc != nil {
		libraryHandlers := NewLibraryHandlers(librarySvc)
		r.POST("/api/stores/epic/browser-sync", libraryHandlers.EpicBrowserSync)
	}

	// Auth endpoints (register, login, external login)
	ah := &AuthHandlers{
		Users:     userSvc,
		JWT:       jwtSvc,
		JWTSecret: jwtSecret,
		External:  externalSvc,
		Library:   librarySvc,
		Encryptor: encryptor,
	}
	ah.RegisterRoutes(r)

	// Protected API group
	api := r.Group("/api")
	api.Use(AuthMiddleware(jwtSecret))

	// Current user endpoint
	api.GET("/me", func(c *gin.Context) {
		userIDAny, _ := c.Get("userID")
		userID, ok := userIDAny.(int64)
		if !ok {
			c.JSON(nethttp.StatusInternalServerError, gin.H{"error": "invalid user id in context"})
			return
		}

		u, err := userSvc.GetByID(c.Request.Context(), userID)
		if err != nil {
			c.JSON(nethttp.StatusNotFound, gin.H{"error": "user not found"})
			return
		}

		c.JSON(nethttp.StatusOK, u.ToPublic())
	})

	// Library and shop endpoints
	if librarySvc != nil {
		libraryHandlers := NewLibraryHandlers(librarySvc)
		libraryHandlers.RegisterRoutes(api)
	}
}
