# Deep Link Setup for OAuth

The app now uses `aio://` deep links to receive OAuth callbacks directly in the desktop app instead of the browser.

## One-Time Setup (Windows)

After building/running the app for the first time, register the protocol:

### Option 1: Automatic (Run as Administrator)
```powershell
cd frontend
.\register-protocol.ps1
```

### Option 2: Manual Registry
1. Open Registry Editor (regedit)
2. Navigate to: `HKEY_CURRENT_USER\Software\Classes`
3. Create a new key named `aio`
4. Set default value to: `URL:AIO Protocol`
5. Create a string value `URL Protocol` (leave empty)
6. Create subkeys: `aio\shell\open\command`
7. Set command default value to: `"C:\path\to\aio-game-library.exe" "%1"`

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
