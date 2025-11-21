# API Documentation

Base URL: `http://localhost:8080`

## Authentication

All API endpoints (except auth endpoints) require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Register New User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "username",
  "password": "password123"
}

Response 201:
{
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "username"
  }
}
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response 200:
{
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "username"
  }
}
```

### Get Current User
```http
GET /api/me
Authorization: Bearer <token>

Response 200:
{
  "id": 1,
  "email": "user@example.com",
  "username": "username"
}
```

## Library Management

### Get User Library
```http
GET /api/library?query=<search>&stores=steam,epic&is_favorite=true&limit=50&offset=0
Authorization: Bearer <token>

Query Parameters:
- query: Search term for game name
- stores: Filter by stores (comma-separated)
- completion_status: Filter by completion status
- is_favorite: Filter favorites (true/false)
- is_installed: Filter installed games (true/false)
- sort_by: name, play_time, last_played, added_at
- sort_order: asc, desc
- limit: Results per page (default: 50)
- offset: Pagination offset

Response 200:
{
  "games": [
    {
      "id": 1,
      "user_id": 1,
      "game_id": 100,
      "store": "steam",
      "store_game_id": "12345",
      "play_time": 7200,
      "last_played": "2024-01-15T10:30:00Z",
      "is_installed": true,
      "is_favorite": true,
      "is_hidden": false,
      "completion_status": "playing",
      "user_rating": 5,
      "user_notes": "Great game!",
      "name": "Game Name",
      "cover_image": "https://...",
      "stores": [
        {
          "store": "steam",
          "price": 59.99,
          "discount_price": 29.99,
          "currency": "USD"
        }
      ]
    }
  ]
}
```

### Update Library Entry
```http
PUT /api/library/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "play_time": 7200,
  "is_favorite": true,
  "completion_status": "completed",
  "user_rating": 5,
  "user_notes": "Amazing experience!"
}

Response 200:
{
  "message": "library entry updated"
}
```

### Remove from Library
```http
DELETE /api/library/:id
Authorization: Bearer <token>

Response 200:
{
  "message": "removed from library"
}
```

## Wishlist

### Get Wishlist
```http
GET /api/wishlist
Authorization: Bearer <token>

Response 200:
{
  "items": [
    {
      "id": 1,
      "user_id": 1,
      "game_id": 200,
      "priority": 5,
      "notes": "Wait for 50% off",
      "notify_on_discount": true,
      "max_price": 30.00,
      "name": "Wishlist Game",
      "cover_image": "https://...",
      "best_price": {
        "store": "epic",
        "price": 59.99,
        "discount_price": 39.99,
        "currency": "USD"
      }
    }
  ]
}
```

### Add to Wishlist
```http
POST /api/wishlist
Authorization: Bearer <token>
Content-Type: application/json

{
  "game_id": 200,
  "priority": 5,
  "notes": "Wait for sale",
  "notify_on_discount": true,
  "max_price": 30.00
}

Response 201:
{
  "id": 1,
  "game_id": 200,
  "priority": 5,
  ...
}
```

### Update Wishlist Item
```http
PUT /api/wishlist/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "priority": 4,
  "notes": "Updated notes",
  "notify_on_discount": true,
  "max_price": 25.00
}

Response 200:
{
  "message": "wishlist item updated"
}
```

### Remove from Wishlist
```http
DELETE /api/wishlist/:id
Authorization: Bearer <token>

Response 200:
{
  "message": "removed from wishlist"
}
```

## Store Accounts

### Get Connected Stores
```http
GET /api/stores/accounts
Authorization: Bearer <token>

Response 200:
{
  "accounts": [
    {
      "id": 1,
      "store": "steam",
      "store_user_id": "76561198...",
      "display_name": "SteamUser",
      "avatar_url": "https://...",
      "is_connected": true,
      "last_synced_at": "2024-01-15T10:00:00Z",
      "auto_import": true
    }
  ]
}
```

### Connect Store Account
```http
POST /api/stores/:store/connect
Authorization: Bearer <token>

Response 200:
{
  "auth_url": "https://steamcommunity.com/openid/login?..."
}

Note: Frontend should redirect user to auth_url for OAuth flow
```

### Store OAuth Callback
```http
POST /api/stores/:store/callback
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "oauth_authorization_code"
}

Response 200:
{
  "message": "store connected successfully"
}

Note: Library sync starts automatically in background
```

### Disconnect Store
```http
DELETE /api/stores/:store/disconnect
Authorization: Bearer <token>

Response 200:
{
  "message": "store disconnected"
}
```

### Sync Store Library
```http
POST /api/stores/:store/sync
Authorization: Bearer <token>

Response 200:
{
  "message": "library synced"
}
```

### Sync All Libraries
```http
POST /api/stores/sync-all
Authorization: Bearer <token>

Response 200:
{
  "message": "all libraries synced"
}
```

## Shop & Search

### Search Games in Database
```http
GET /api/shop/search?query=<term>&stores=steam&genres=action&on_sale=true&limit=20
Authorization: Bearer <token>

Query Parameters:
- query: Search term
- stores: Filter by stores
- genres: Filter by genres
- tags: Filter by tags
- platforms: Filter by platforms
- min_price: Minimum price
- max_price: Maximum price
- on_sale: Show only discounted games
- min_rating: Minimum user rating
- sort_by: name, release_date, price, rating
- sort_order: asc, desc
- limit: Results per page
- offset: Pagination offset

Response 200:
{
  "games": [
    {
      "id": 100,
      "name": "Game Name",
      "description": "Game description",
      "release_date": "2023-01-15",
      "developer": "Studio Name",
      "publisher": "Publisher Name",
      "cover_image": "https://...",
      "genres": ["Action", "RPG"],
      "tags": ["Singleplayer", "Multiplayer"],
      "platforms": ["Windows", "Mac"],
      "stores": [
        {
          "store": "steam",
          "price": 59.99,
          "discount_price": 29.99,
          "currency": "USD",
          "store_url": "https://store.steampowered.com/app/12345"
        }
      ]
    }
  ]
}
```

### Search All Stores Live
```http
GET /api/shop/search-all?query=<term>&limit=10
Authorization: Bearer <token>

Note: This queries all store APIs directly (slower but gets latest data)

Response 200:
{
  "results": {
    "steam": [
      {
        "store_game_id": "12345",
        "name": "Game Name",
        "cover_image": "https://...",
        "store_url": "https://..."
      }
    ],
    "epic": [...],
    "gog": [...]
  }
}
```

### Get Game Details
```http
GET /api/shop/games/:id
Authorization: Bearer <token>

Response 200:
{
  "id": 100,
  "name": "Game Name",
  "description": "Full description",
  "release_date": "2023-01-15",
  "developer": "Studio Name",
  "publisher": "Publisher Name",
  "cover_image": "https://...",
  "background_image": "https://...",
  "genres": ["Action", "RPG"],
  "tags": ["Singleplayer", "Story Rich"],
  "platforms": ["Windows", "Mac", "Linux"],
  "stores": [
    {
      "store": "steam",
      "store_game_id": "12345",
      "store_url": "https://store.steampowered.com/app/12345",
      "price": 59.99,
      "discount_price": 29.99,
      "currency": "USD",
      "is_available": true,
      "last_checked": "2024-01-15T10:00:00Z"
    },
    {
      "store": "epic",
      ...
    }
  ]
}
```

## Health Check

### Check Server Status
```http
GET /health

Response 200:
{
  "status": "ok"
}
```

## Error Responses

All endpoints may return error responses:

```json
400 Bad Request:
{
  "error": "invalid request parameters"
}

401 Unauthorized:
{
  "error": "missing or invalid Authorization header"
}

404 Not Found:
{
  "error": "resource not found"
}

500 Internal Server Error:
{
  "error": "internal server error"
}
```

## Rate Limiting

Currently no rate limiting is implemented. Consider adding rate limiting for production use.

## Webhooks

Not implemented yet. Future versions may support webhooks for:
- Price drop notifications
- New game releases
- Library updates

## Supported Stores

1. **Steam** - Fully implemented with OpenID auth
2. **Epic Games** - OAuth stub (needs full implementation)
3. **GOG** - OAuth stub (needs full implementation)
4. **Xbox** - OAuth stub (needs full implementation)
5. **Battle.net** - OAuth stub (needs full implementation)
6. **Ubisoft Connect (Uplay)** - OAuth stub (needs full implementation)
7. **Amazon Games** - OAuth stub (needs full implementation)
8. **EA App** - OAuth stub (needs full implementation)
9. **PSN** - OAuth stub (needs full implementation)

Note: Steam client is fully functional. Other stores have stub implementations that need to be completed with actual API integrations.
