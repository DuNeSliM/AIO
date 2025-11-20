package main

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Item struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

var items = []Item{
	{ID: 1, Name: "First item"},
	{ID: 2, Name: "Second item"},
}

func main() {
	router := gin.Default()

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	router.GET("/items", func(c *gin.Context) {
		c.JSON(http.StatusOK, items)
	})

	router.GET("/items/:id", func(c *gin.Context) {
		idParam := c.Param("id")
		id, err := strconv.Atoi(idParam)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}

		for _, item := range items {
			if item.ID == id {
				c.JSON(http.StatusOK, item)
				return
			}
		}

		c.JSON(http.StatusNotFound, gin.H{"error": "item not found"})
	})

	router.POST("/items", func(c *gin.Context) {
		var payload struct {
			Name string `json:"name" binding:"required"`
		}

		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		newID := 1
		if len(items) > 0 {
			newID = items[len(items)-1].ID + 1
		}

		item := Item{
			ID:   newID,
			Name: payload.Name,
		}
		items = append(items, item)

		c.JSON(http.StatusCreated, item)
	})

	router.Run(":8080")
}
