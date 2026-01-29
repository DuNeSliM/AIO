# Steam Login Integration

## ✅ Was wurde implementiert

### Backend
- **Steam OpenID Authentication** - Sicherer Login über Steam
- **Steam Web API Client** - Lädt deine Spielebibliothek
- **Endpoints:**
  - `GET /v1/steam/login` - Startet Steam-Login
  - `GET /v1/steam/callback` - OAuth-Callback
  - `GET /v1/steam/library?steamid={id}` - Lädt Bibliothek
  - `POST /v1/steam/sync?steamid={id}` - Synct zur DB (TODO)

### Frontend
- **Steam Login Button** in Sidebar
- **Automatisches Laden** der Bibliothek nach Login
- **Session Persistence** via localStorage
- **User Badge** zeigt Steam-Username

## 🚀 Setup

### 1. Steam API Key holen

1. Gehe zu https://steamcommunity.com/dev/apikey
2. Melde dich mit deinem Steam-Account an
3. Erstelle einen API Key (Domain: `localhost`)
4. Kopiere den Key

### 2. Backend konfigurieren

Erstelle `.env` im `backend/api` Ordner:

```env
PORT=8080
ISTHEREANYDEAL_API_KEY=dein_itad_key
STEAM_API_KEY=dein_steam_api_key_hier
STEAM_CALLBACK_URL=http://localhost:8080/v1/steam/callback
```

### 3. Backend starten

```bash
cd backend/api
go run cmd/api/main.go
```

### 4. Frontend starten

```bash
cd frontend
npm run dev
```

## 📖 Nutzung

1. **Öffne Frontend:** http://localhost:3000
2. **Klicke "Steam Login"** in der Sidebar unten
3. **Melde dich bei Steam an**
4. **Wirst weitergeleitet** - deine Spiele werden automatisch geladen!

## 🎮 Features

- ✅ **Echte Steam-Bibliothek** - alle deine Spiele
- ✅ **Cover-Bilder** von Steam
- ✅ **Spielzeit-Anzeige** (playtime_forever)
- ✅ **Direktes Starten** via `steam://rungameid/{appid}`
- ✅ **Logout & Session-Management**

## 🔧 Technische Details

### Steam OpenID Flow

```
1. User klickt "Steam Login"
2. → Backend /v1/steam/login
3. → Redirect zu Steam OpenID
4. User authorisiert
5. → Steam redirect zu /v1/steam/callback
6. Backend verifiziert Callback
7. → Redirect zu Frontend mit ?steamid={id}&username={name}
8. Frontend speichert in localStorage
9. → Lädt Bibliothek via /v1/steam/library?steamid={id}
```

### API Responses

**GET /v1/steam/library?steamid=76561198...**

```json
[
  {
    "id": "1145350",
    "appId": 1145350,
    "name": "Hades II",
    "platform": "steam",
    "image": "https://media.steampowered.com/steamcommunity/public/images/apps/1145350/abc123.jpg",
    "playtime": 450
  }
]
```

## 🔐 Sicherheit

- Steam OpenID ist offizieller OAuth-Standard
- Keine Passwörter im System
- Session nur client-side (localStorage)
- Steam Web API Key sollte **niemals** im Frontend sein

## 📝 TODOs

- [ ] Bibliothek in Datenbank speichern (Tabelle `steam_users`, `steam_games`)
- [ ] Server-side Sessions (statt localStorage)
- [ ] Automatisches Sync alle X Stunden
- [ ] Epic Games & GOG Login analog implementieren

## ⚠️ Troubleshooting

**"Authentication failed"**
- Prüfe ob STEAM_API_KEY richtig gesetzt ist
- Überprüfe Callback-URL in .env

**"Keine Spiele werden geladen"**
- Browser Console öffnen - Fehler checken
- Prüfe ob Backend auf :8080 läuft
- Prüfe Network-Tab für API-Calls

**"Steam Login öffnet sich nicht"**
- CORS-Headers müssen vom Backend gesetzt sein (bereits implementiert)
- Prüfe ob `/v1/steam/login` erreichbar ist
