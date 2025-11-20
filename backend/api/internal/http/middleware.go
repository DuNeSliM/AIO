// internal/http/middleware.go
package http

import (
	"fmt"
	nethttp "net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// AuthMiddleware verifies a JWT in the Authorization header
// and puts the user ID into the Gin context as "userID".
func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	secretBytes := []byte(jwtSecret)

	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(nethttp.StatusUnauthorized, gin.H{
				"error": "missing or invalid Authorization header",
			})
			return
		}

		tokenStr := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return secretBytes, nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(nethttp.StatusUnauthorized, gin.H{
				"error": "invalid token",
			})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(nethttp.StatusUnauthorized, gin.H{
				"error": "invalid token claims",
			})
			return
		}

		sub, ok := claims["sub"]
		if !ok {
			c.AbortWithStatusJSON(nethttp.StatusUnauthorized, gin.H{
				"error": "missing subject in token",
			})
			return
		}

		var userID int64

		switch v := sub.(type) {
		case float64:
			userID = int64(v)
		case int64:
			userID = v
		case string:
			parsed, err := strconv.ParseInt(v, 10, 64)
			if err != nil {
				c.AbortWithStatusJSON(nethttp.StatusUnauthorized, gin.H{
					"error": "invalid subject in token",
				})
				return
			}
			userID = parsed
		default:
			c.AbortWithStatusJSON(nethttp.StatusUnauthorized, gin.H{
				"error": "invalid subject type in token",
			})
			return
		}

		c.Set("userID", userID)
		c.Next()
	}
}
