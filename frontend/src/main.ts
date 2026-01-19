// Auth configuration
const ZITADEL_ISSUER = 'https://auth.gamedivers.de';
const CLIENT_ID = 'YOUR_ZITADEL_CLIENT_ID'; // Replace with your ZITADEL client ID
const REDIRECT_URI = 'http://localhost:1420/callback'; // For dev; use custom scheme in prod
const SCOPES = 'openid profile email offline_access';
const API_BASE = 'http://localhost:8080'; // Your Go backend

interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface User {
  id: string;
  email: string;
  email_verified: boolean;
  name: string;
  username?: string;
}

// Storage helpers
function getTokens(): Tokens | null {
  const data = localStorage.getItem('tokens');
  return data ? JSON.parse(data) : null;
}

function setTokens(tokens: Tokens): void {
  localStorage.setItem('tokens', JSON.stringify(tokens));
}

function clearTokens(): void {
  localStorage.removeItem('tokens');
  localStorage.removeItem('pkce_verifier');
}

// PKCE helpers
function base64UrlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = base64UrlEncode(array);

  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const challenge = base64UrlEncode(new Uint8Array(hash));

  return { verifier, challenge };
}

// Auth functions
async function login(): Promise<void> {
  const { verifier, challenge } = await generatePKCE();
  localStorage.setItem('pkce_verifier', verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `${ZITADEL_ISSUER}/oauth/v2/authorize?${params}`;
}

async function register(): Promise<void> {
  const { verifier, challenge } = await generatePKCE();
  localStorage.setItem('pkce_verifier', verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'create',
  });

  window.location.href = `${ZITADEL_ISSUER}/oauth/v2/authorize?${params}`;
}

async function handleCallback(code: string): Promise<void> {
  const verifier = localStorage.getItem('pkce_verifier');
  if (!verifier) {
    throw new Error('PKCE verifier not found');
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });

  const response = await fetch(`${ZITADEL_ISSUER}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();

  const tokens: Tokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  setTokens(tokens);
  localStorage.removeItem('pkce_verifier');
}

async function getAccessToken(): Promise<string | null> {
  const tokens = getTokens();
  if (!tokens) return null;

  // Refresh if expired (with 60s buffer)
  if (Date.now() > tokens.expires_at - 60000) {
    try {
      await refreshTokens();
      const newTokens = getTokens();
      return newTokens?.access_token ?? null;
    } catch {
      clearTokens();
      return null;
    }
  }

  return tokens.access_token;
}

async function refreshTokens(): Promise<void> {
  const tokens = getTokens();
  if (!tokens?.refresh_token) {
    throw new Error('No refresh token');
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
  });

  const response = await fetch(`${ZITADEL_ISSUER}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!response.ok) {
    clearTokens();
    throw new Error('Session expired');
  }

  const data = await response.json();

  const newTokens: Tokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  setTokens(newTokens);
}

async function logout(): Promise<void> {
  const tokens = getTokens();

  if (tokens?.refresh_token) {
    try {
      await fetch(`${ZITADEL_ISSUER}/oauth/v2/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          token: tokens.refresh_token,
        }),
      });
    } catch {
      // Ignore revoke errors
    }
  }

  clearTokens();
}

async function getCurrentUser(): Promise<User | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const response = await fetch(`${API_BASE}/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) return null;
  return response.json();
}

function isLoggedIn(): boolean {
  return getTokens() !== null;
}

// UI rendering
async function render(): Promise<void> {
  const app = document.getElementById('app')!;

  // Check for OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (code) {
    app.innerHTML = '<p>Processing login...</p>';
    try {
      await handleCallback(code);
      window.history.replaceState({}, '', '/');
    } catch (error) {
      app.innerHTML = `<p style="color: red;">Login failed: ${error}</p>`;
      return;
    }
  }

  if (isLoggedIn()) {
    const user = await getCurrentUser();
    if (user) {
      app.innerHTML = `
        <div class="container">
          <h1>Welcome, ${user.name || user.email}!</h1>
          <div class="user-info">
            <p><strong>ID:</strong> ${user.id}</p>
            <p><strong>Email:</strong> ${user.email} ${user.email_verified ? '✓' : '(unverified)'}</p>
            <p><strong>Name:</strong> ${user.name || 'Not set'}</p>
            <p><strong>Username:</strong> ${user.username || 'Not set'}</p>
          </div>
          <div class="actions">
            <button id="accountBtn">Account Settings</button>
            <button id="logoutBtn">Logout</button>
          </div>
          <div class="token-info">
            <h3>Token Info</h3>
            <p><strong>Access Token:</strong> <code>${getTokens()?.access_token?.substring(0, 50)}...</code></p>
            <p><strong>Expires:</strong> ${new Date(getTokens()?.expires_at || 0).toLocaleString()}</p>
          </div>
        </div>
      `;

      document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await logout();
        render();
      });

      document.getElementById('accountBtn')?.addEventListener('click', () => {
        window.open(`${ZITADEL_ISSUER}/ui/console/users/me`, '_blank');
      });
    } else {
      clearTokens();
      render();
    }
  } else {
    app.innerHTML = `
      <div class="container">
        <h1>GameDivers Auth Test</h1>
        <p>Test authentication with ZITADEL</p>
        <div class="actions">
          <button id="loginBtn">Login</button>
          <button id="registerBtn">Register</button>
        </div>
        <div class="config">
          <h3>Configuration</h3>
          <p><strong>ZITADEL:</strong> ${ZITADEL_ISSUER}</p>
          <p><strong>Client ID:</strong> ${CLIENT_ID}</p>
          <p><strong>API:</strong> ${API_BASE}</p>
        </div>
      </div>
    `;

    document.getElementById('loginBtn')?.addEventListener('click', login);
    document.getElementById('registerBtn')?.addEventListener('click', register);
  }
}

// Start app
render();
