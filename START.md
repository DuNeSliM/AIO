# 🚀 AIO Game Library - Quick Start

## Prerequisites

- **Node.js** (v16+)
- **Go** (v1.21+)
- **Rust** (for Tauri): `winget install --id Rustlang.Rustup`

## Start the App

### 1. Start Backend
```powershell
cd backend\api
go run main.go
```
Backend runs on `http://localhost:8080`

### 2. Start Frontend
```powershell
cd frontend
npm install  # First time only
npm run tauri dev
```

Or use the quick launcher:
```powershell
cd frontend
.\start.bat
```

## Build for Production

### Backend
```powershell
cd backend\api
go build -o aio-backend.exe
.\aio-backend.exe
```

### Frontend
```powershell
cd frontend
npm run tauri build
```
Executable will be in `frontend\src-tauri\target\release\`

## Test the App

1. **Login**: Click any store button → OAuth opens in browser → paste JWT token
2. **Search**: Go to Store tab → search for games → see ownership badges
3. **Library**: Go to Library tab → click Play (launches game) or Install (opens store)

## Next Steps

See `BACKEND_INTEGRATION_TODO.md` for wiring backend routes and database integration.
