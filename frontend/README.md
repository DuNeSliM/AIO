# GameDivers Desktop Wrapper

This folder is the dedicated Tauri desktop wrapper.

- Native desktop backend: `frontend/src-tauri/`
- UI source used by the wrapper: `gamedivers-site/`

## Local testing before installer build

1. Install wrapper deps:

```bash
cd frontend
npm install
```

2. Run desktop app in dev mode (hot reload, no installer):

```bash
npm run tauri:dev
```

This automatically starts the web UI from `gamedivers-site` via the `beforeDevCommand`.

## Build installer artifacts

```bash
npm run tauri:build
```

Artifacts are written to:

- `frontend/src-tauri/target/release/bundle/msi/`
- `frontend/src-tauri/target/release/bundle/nsis/`

## CI release flow

- Workflow: `.github/workflows/desktop-release.yml`
- Published release assets use stable names:
  - `GameDivers-Windows-Setup.exe`
  - `GameDivers-Windows.msi`
  - `SHA256SUMS.txt`
