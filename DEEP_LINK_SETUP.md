# Deep Link Setup for OAuth

The app now uses `aio://` deep links to receive OAuth callbacks directly in the desktop app instead of the browser.

## Setup (Windows)

### Production Build (Recommended)
**When you build and install the app using the installer, the `aio://` protocol is automatically registered!**

Simply run:
```powershell
cd frontend
npm run tauri build
```

Then install the generated `.msi` or `.exe` from `frontend/src-tauri/target/release/bundle/`. The installer will automatically register the protocol.

### Development Mode (Manual Registration Required)
If you're running in dev mode (`npm run tauri dev`), you need to manually register the protocol:

#### Option 1: PowerShell Script (Run as Administrator)
```powershell
cd frontend
.\register-protocol.ps1 -Dev
```

#### Option 2: Manual Registry
1. Open Registry Editor (regedit)
2. Navigate to: `HKEY_CURRENT_USER\Software\Classes`
3. Create a new key named `aio`
4. Set default value to: `URL:AIO Protocol`
5. Create a string value `URL Protocol` (leave empty)
6. Create subkeys: `aio\shell\open\command`
7. Set command default value to: `"C:\path\to\frontend\src-tauri\target\debug\AIO Game Library.exe" "%1"`

### Test It
After registration, test with:
```powershell
start aio://auth-callback?token=test123&store=steam
```

This should open/focus your AIO app and log you in!

## How It Works

1. Click "Sign in with Steam" → Opens browser
2. Complete Steam OAuth
3. Backend redirects to `aio://auth-callback?token=xxx&store=steam`
4. Windows opens your AIO app with the URL as a parameter
5. App extracts token and logs you in automatically! 🎉

## Development Mode

In dev mode (`npm run tauri dev`), the protocol still works but you need to register it pointing to:
```
"C:\Users\migue\Desktop\AIO\frontend\src-tauri\target\debug\aio-game-library.exe" "%1"
```
