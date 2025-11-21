# AIO Game Library Backend

A comprehensive Go backend for aggregating game libraries across multiple platforms (Steam, Epic Games, GOG, Xbox, Battle.net, Uplay, Amazon Games, EA App, PSN) with wishlist, search, and shop features.

## Features

### Core Functionality
- **Multi-Store Integration**: Connect accounts from Steam, Epic Games, GOG, Xbox, Battle.net, Uplay, Amazon Games, EA App, and PSN
- **Unified Library**: Automatically import and sync games from all connected stores
- **Wishlist Management**: Track desired games with priority levels and price alerts
- **Cross-Store Search**: Search for games across all supported stores simultaneously
- **Price Tracking**: Monitor game prices and get notified of discounts
- **Game Metadata**: Comprehensive game information including genres, tags, platforms, reviews
- **User Authentication**: JWT-based auth with support for store OAuth connections

### API Endpoints

#### Authentication
- `POST /auth/register` - Create new account
- `POST /auth/login` - Login with email/password
- `GET /auth/:provider/login` - Initiate OAuth login with game store
- `GET /auth/:provider/callback` - OAuth callback handler

#### Library Management
- `GET /api/library` - Get user's game library with filters
- `PUT /api/library/:id` - Update library entry (playtime, rating, notes, etc.)
- `DELETE /api/library/:id` - Remove game from library

#### Wishlist
- `GET /api/wishlist` - Get user's wishlist with best prices
- `POST /api/wishlist` - Add game to wishlist
- `PUT /api/wishlist/:id` - Update wishlist item
- `DELETE /api/wishlist/:id` - Remove from wishlist

#### Store Accounts
- `GET /api/stores/accounts` - Get connected store accounts
- `POST /api/stores/:store/connect` - Get OAuth URL for store connection
- `POST /api/stores/:store/callback` - Complete store connection
- `DELETE /api/stores/:store/disconnect` - Disconnect store account
- `POST /api/stores/:store/sync` - Manually sync library from specific store
- `POST /api/stores/sync-all` - Sync libraries from all connected stores

#### Shop & Search
- `GET /api/shop/search` - Search games in database with filters
- `GET /api/shop/search-all` - Search across all store APIs
- `GET /api/shop/games/:id` - Get game details with all store listings

## Setup

### Prerequisites
- Go 1.23 or higher
- PostgreSQL 14+ (or can use in-memory storage for development)
- API keys for game stores you want to support

### Installation

1. Clone the repository:
```bash
cd backend/api
```

2. Install dependencies:
```bash
go mod download
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Generate encryption key:
```bash
# Generate a 32-byte key and base64 encode it
openssl rand -base64 32
```

5. Set up database:
```bash
# Create database
createdb aio_games

# Run schema
psql aio_games < ../../k8s/schema.sql
```

6. Run the server:
```bash
go run main.go
```

The server will start on `http://localhost:8080`

## Store API Setup

### Steam
1. Get API key from https://steamcommunity.com/dev/apikey
2. Steam uses OpenID, not traditional OAuth
3. Set `STEAM_API_KEY` in `.env`

### Epic Games
1. Create app at https://dev.epicgames.com/
2. Get OAuth credentials
3. Set `EPIC_CLIENT_ID`, `EPIC_CLIENT_SECRET`, and callback URL

### GOG
1. Register at https://www.gog.com/developer
2. Create OAuth application
3. Set `GOG_CLIENT_ID`, `GOG_CLIENT_SECRET`, and callback URL

### Xbox
1. Register at https://developer.microsoft.com/
2. Create app with Xbox Live capabilities
3. Set `XBOX_CLIENT_ID`, `XBOX_CLIENT_SECRET`, and callback URL

### Battle.net
1. Register at https://develop.battle.net/
2. Create OAuth2 client
3. Set `BATTLENET_CLIENT_ID`, `BATTLENET_CLIENT_SECRET`, and callback URL

### Other Stores
Similar process for Uplay, Amazon Games, EA App, and PSN. Check respective developer portals.

## Architecture

### Directory Structure
```
internal/
├── auth/          # Authentication & JWT
├── crypto/        # Encryption utilities
├── http/          # HTTP handlers & routing
├── library/       # Library management service & repository
├── models/        # Data models
├── stores/        # Store client implementations
│   ├── client.go      # Store client interface & manager
│   ├── steam.go       # Steam API integration
│   ├── epic.go        # Epic Games Store integration
│   ├── gog.go         # GOG integration
│   └── ...            # Other store clients
└── users/         # User management
```

### Database Schema
See `k8s/schema.sql` for complete schema including:
- Users and authentication
- Games and metadata
- Store accounts and tokens (encrypted)
- User library with playtime tracking
- Wishlist with price alerts
- Store game listings with prices
- Price history for tracking deals

### Store Client Interface
Each store implements the `StoreClient` interface:
- Authentication (OAuth/OpenID)
- User library fetching
- Game search
- Price information
- Game metadata

## Development

### Adding a New Store

1. Create `internal/stores/storename.go`
2. Implement the `StoreClient` interface
3. Register in `StoreManager` constructor
4. Add environment variables for API credentials
5. Update documentation

### Running Tests
```bash
go test ./...
```

### Building for Production
```bash
go build -o aio-backend main.go
```

## Security

- All OAuth tokens are encrypted using AES-GCM before storage
- JWT tokens for API authentication with configurable expiry
- CORS enabled for Tauri frontend
- PostgreSQL prepared statements prevent SQL injection
- Environment variables for sensitive configuration

## API Response Examples

### Get Library
```json
GET /api/library?stores=steam&is_favorite=true

{
  "games": [
    {
      "id": 1,
      "name": "Game Name",
      "cover_image": "https://...",
      "play_time": 3600,
      "is_favorite": true,
      "completion_status": "playing",
      "stores": [
        {
          "store": "steam",
          "price": 59.99,
          "discount_price": 29.99
        }
      ]
    }
  ]
}
```

### Search All Stores
```json
GET /api/shop/search-all?query=cyberpunk

{
  "results": {
    "steam": [...],
    "epic": [...],
    "gog": [...]
  }
}
```

## License

See LICENSE file for details.

## Contributing

Contributions welcome! Please read CONTRIBUTING.md first.
