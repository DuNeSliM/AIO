# Getting Your Steam API Key

To fetch your Steam library, you need a Steam Web API Key.

## Steps:

1. **Go to**: https://steamcommunity.com/dev/apikey
2. **Login** with your Steam account
3. **Domain Name**: Enter `localhost` (or any domain)
4. **Agree** to terms and click "Register"
5. **Copy** the API key shown

## Add to .env file:

```
STEAM_API_KEY=your_api_key_here
```

## Restart the backend:

The backend will pick up the new API key and Steam sync will work!

---

**Why is this needed?**

Steam's OpenID login only gives you a Steam ID (for authentication), but to fetch your game library, Steam requires a separate Web API Key. This is free and easy to get from Steam.

**Is it safe?**

Yes! The API key is stored in your `.env` file (not committed to git) and only used to query Steam's public API endpoints.
