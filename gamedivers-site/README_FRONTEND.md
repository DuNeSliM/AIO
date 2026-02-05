# Frontend (Tauri) - Game Library

## Struktur

```
frontend/
├── src/
│   ├── main.tsx              # React Einstiegspunkt
│   ├── App.tsx               # Haupt-App-Komponente
│   ├── components/
│   │   ├── Sidebar.tsx       # Linke Sidebar mit Dummy-Icons
│   │   ├── GameList.tsx      # Liste der Spiele
│   │   └── GameCard.tsx      # Einzelnes Spiel mit Start-Button
│   ├── pages/
│   │   └── GameLibrary.tsx   # Haupt-Bibliothek-Seite
│   ├── hooks/
│   │   └── useGames.ts       # Hook für Spiel-State & API-Calls
│   ├── services/
│   │   └── api.ts            # Backend API Integration
│   └── styles/
│       └── theme.css         # Orange/Schwarz Theme (Cupra-Style)
├── src-tauri/
│   └── src/
│       └── main.rs           # Tauri Backend mit launch_game Command
└── index.html
```

## Features

✅ **Backend-Integration**
- Verbindet sich mit `/v1/games/installed` für Spieleliste
- Nutzt `/v1/games/{platform}/{id}/start` für Spiel-Launches
- Unterstützt Steam, Epic Games, GOG

✅ **Tauri Native Launch**
- Rust Command `launch_game` für native URI-Handler
- Windows: `steam://`, `com.epicgames.launcher://`, `goggalaxy://`
- Fallback auf Backend HTTP wenn Tauri nicht verfügbar

✅ **UI/UX**
- Orange/Schwarz Design (Cupra-inspiriert)
- Sidebar mit erweiterbaren Dummy-Icons
- Loading States, Error Handling
- Sync-Buttons für Steam/Epic/GOG

## Setup

### 1. Dependencies installieren

```bash
cd frontend
npm install
```

### 2. Backend starten

Stelle sicher, dass dein Go Backend läuft:

```bash
cd ../backend/api
go run cmd/api/main.go
```

Das Backend sollte auf `http://localhost:8080` laufen.

### 3a. Web-Version (Entwicklung)

```bash
npm run dev
```

Öffne `http://localhost:3000`

### 3b. Tauri Desktop App

```bash
npm run tauri:dev
```

## Backend API Endpoints

Das Frontend nutzt folgende Endpoints:

- `GET /v1/games/installed` - Liste aller installierten Spiele
- `POST /v1/games/steam/:appid/start` - Steam Spiel starten
- `POST /v1/games/epic/:appname/start` - Epic Spiel starten
- `POST /v1/games/gog/:gamename/start` - GOG Spiel starten
- `GET /v1/games/{platform}/library` - Library vom Store syncen

## Environment Variables

Erstelle eine `.env` Datei (siehe `.env.example`):

```env
VITE_API_BASE=http://localhost:8080
```

## Erweiterungen

### Neue Sidebar-Icons
Bearbeite [src/components/Sidebar.tsx](src/components/Sidebar.tsx) und füge neue `<DummyIcon>` hinzu.

### Neue Seiten
1. Erstelle neue Komponente in `src/pages/`
2. Füge Routing hinzu (z.B. mit `react-router-dom`)
3. Verlinke von Sidebar

### Weitere Platforms
1. Erweitere `launchGame()` in [src/services/api.ts](src/services/api.ts)
2. Füge Case in [src-tauri/src/main.rs](src-tauri/src/main.rs) hinzu
3. Backend Endpoint implementieren

## Troubleshooting

**Spiele starten nicht:**
- Überprüfe ob Steam/Epic/GOG installiert ist
- Windows: URI-Handler müssen registriert sein
- Check Browser/Tauri Console für Fehler

**Backend nicht erreichbar:**
- Prüfe `VITE_API_BASE` in `.env`
- CORS-Headers müssen vom Backend gesetzt sein (bereits implementiert)

**Tauri Build Fehler:**
- `npm install @tauri-apps/cli @tauri-apps/api` erneut ausführen
- Rust muss installiert sein: https://rustup.rs/

