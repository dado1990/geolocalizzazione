const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type Tokens = {
  accessToken: string | null;
  refreshToken: string | null;
};

export function getTokens(): Tokens {
  return {
    accessToken: localStorage.getItem('access_token'),
    refreshToken: localStorage.getItem('refresh_token'),
  };
}

export function setTokens(tokens: { accessToken: string; refreshToken?: string }) {
  localStorage.setItem('access_token', tokens.accessToken);
  if (tokens.refreshToken) {
    localStorage.setItem('refresh_token', tokens.refreshToken);
  }
}

export function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

async function refreshAccessToken(refreshToken: string | null): Promise<string | null> {
  if (!refreshToken) return null;
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.access_token) {
    setTokens({ accessToken: data.access_token });
    return data.access_token as string;
  }
  return null;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  auth: boolean = true
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (auth) {
    const { accessToken } = getTokens();
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401 && auth) {
    const tokens = getTokens();
    const newAccess = await refreshAccessToken(tokens.refreshToken);
    if (newAccess) {
      headers.set('Authorization', `Bearer ${newAccess}`);
      const retry = await fetch(`${API_URL}${path}`, { ...options, headers });
      if (!retry.ok) {
        throw await retry.json();
      }
      return retry.json();
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'REQUEST_FAILED' }));
    throw err;
  }
  return res.json();
}

export async function login(email: string, password: string) {
  const data = await apiFetch<{ access_token: string; refresh_token: string; user: any }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
    false
  );
  setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token });
  return data.user;
}
