// internal/http/routes.go
package http

import (
	nethttp "net/http"

	"github.com/gin-gonic/gin"

	"aoi/api/internal/auth"
	"aoi/api/internal/users"
)

// RegisterRoutes wires all routes into the Gin engine.
func RegisterRoutes(
	r *gin.Engine,
	jwtSecret string,
	jwtSvc auth.JWTService,
	userSvc users.Service,
	externalSvc auth.ExternalAuthService,
) {
	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(nethttp.StatusOK, gin.H{"status": "ok"})
	})

	// Auth endpoints (register, login, external login)
	ah := &AuthHandlers{
		Users:    userSvc,
		JWT:      jwtSvc,
		External: externalSvc,
	}
	ah.RegisterRoutes(r)

	// Protected API group
	api := r.Group("/api")
	api.Use(AuthMiddleware(jwtSecret))

	// Example: current user endpoint
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
}
