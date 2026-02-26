const ACCESS_TOKEN_KEY = "ambebe_access_token";
const REFRESH_TOKEN_KEY = "ambebe_refresh_token";
const PENDING_CART_INTENT_KEY = "ambebe_pending_cart_intent";

export type JwtPayload = {
  sub?: string;
  role?: string;
  exp?: number;
  iat?: number;
};

export type PendingCartIntent = {
  productId: string;
  returnTo: string;
  createdAt: number;
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function getAccessToken() {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function decodeJwt(token: string): JwtPayload | null {
  if (!isBrowser()) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = window.atob(padded);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function getRoleFromToken(token: string | null) {
  if (!token) return null;
  const payload = decodeJwt(token);
  const role = payload?.role;
  if (!role) return null;
  const normalized = role.toLowerCase();
  return normalized === "gestor" ? "manager" : normalized;
}

export function setPendingCartIntent(intent: PendingCartIntent) {
  if (!isBrowser()) return;
  window.localStorage.setItem(PENDING_CART_INTENT_KEY, JSON.stringify(intent));
}

export function getPendingCartIntent(): PendingCartIntent | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(PENDING_CART_INTENT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingCartIntent;
    if (!parsed?.productId || !parsed?.returnTo) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingCartIntent() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(PENDING_CART_INTENT_KEY);
}
