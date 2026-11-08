const STORAGE_AUTH_KEY = 'peerflix_auth_credentials';
const STORAGE_AUTH_ORIGIN_KEY = 'peerflix_auth_origin';
const STORAGE_USER_KEY = 'peerflix_current_user';
const STORAGE_ADMIN_KEY = 'peerflix_is_admin';
const STORAGE_ADMIN_TOKEN_KEY = 'peerflix_admin_token';

let cachedAuthOrigin = '';

// Auto-detect credentials from window.location if available on page load
if (typeof window !== 'undefined' && window.location) {
  try {
    const params = new URLSearchParams(window.location.search);
    const authQuery = params.get('auth');
    if (authQuery && authQuery.includes(':')) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_AUTH_KEY, authQuery.trim());
      }
    }
    if (window.location.username && window.location.password) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_AUTH_KEY, `${window.location.username}:${window.location.password}`);
      }
    }
  } catch {}
}

const ANIMALS = [
  'Renard', 'Panda', 'Faucon', 'Loup', 'Tigre', 'Koala', 'Aigle', 'Lynx',
  'Dauphin', 'Cerf', 'Ours', 'Jaguar', 'Castor', 'Hibou', 'Bison', 'Loutre'
];

const ADJECTIVES = [
  'Malin', 'Zen', 'Bleu', 'Rapide', 'Dore', 'Agile', 'Sage', 'Calme',
  'Veloce', 'Brave', 'Furtif', 'Solaire', 'Fidele', 'Joyeux'
];

export function detectDeviceName(): string | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/iphone/i.test(ua)) return 'iPhone';
  if (/ipad/i.test(ua)) return 'iPad';
  if (/macintosh|mac os x/i.test(ua)) return 'Mac';
  if (/windows/i.test(ua)) return 'PC-Win';
  if (/android/i.test(ua)) {
    if (/samsung|sm-/i.test(ua)) return 'Galaxy';
    if (/pixel/i.test(ua)) return 'Pixel';
    if (/xiaomi|redmi/i.test(ua)) return 'Xiaomi';
    return 'Android';
  }
  if (/linux/i.test(ua)) return 'PC-Linux';
  return null;
}

export function generateMemorablePseudo(): string {
  const device = detectDeviceName();
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];

  if (device) {
    return `${device}-${animal}`;
  }
  return `${animal}${adj}`;
}

export function getSavedAuthCredentials(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(STORAGE_AUTH_KEY) || '';
    }
  } catch {}
  return '';
}

export function saveAuthCredentials(creds: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (creds.trim()) {
        localStorage.setItem(STORAGE_AUTH_KEY, creds.trim());
      } else {
        localStorage.removeItem(STORAGE_AUTH_KEY);
      }
    }
  } catch {}
}

export function getCurrentUser(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_USER_KEY);
      if (stored && stored.trim() && stored !== 'Moi') {
        return stored.trim();
      }
      // Auto-generate a memorable pseudo and save it
      const generated = generateMemorablePseudo();
      localStorage.setItem(STORAGE_USER_KEY, generated);
      return generated;
    }
  } catch {}
  return 'Moi';
}

export function saveCurrentUser(user: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const clean = user.trim() || generateMemorablePseudo();
      localStorage.setItem(STORAGE_USER_KEY, clean);
    }
  } catch {}
}

export function getSavedAdminToken(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(STORAGE_ADMIN_TOKEN_KEY) || '';
    }
  } catch {}
  return '';
}

export function saveAdminToken(token: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (token.trim()) {
        localStorage.setItem(STORAGE_ADMIN_TOKEN_KEY, token.trim());
      } else {
        localStorage.removeItem(STORAGE_ADMIN_TOKEN_KEY);
      }
    }
  } catch {}
}

export function getIsAdmin(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      const hasFlag = localStorage.getItem(STORAGE_ADMIN_KEY) === 'true';
      const hasToken = Boolean(localStorage.getItem(STORAGE_ADMIN_TOKEN_KEY));
      return hasFlag && hasToken;
    }
  } catch {}
  return false;
}

export function saveIsAdmin(isAdmin: boolean, token?: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_ADMIN_KEY, isAdmin ? 'true' : 'false');
      if (token) {
        localStorage.setItem(STORAGE_ADMIN_TOKEN_KEY, token.trim());
      } else if (!isAdmin) {
        localStorage.removeItem(STORAGE_ADMIN_TOKEN_KEY);
      }
    }
  } catch {}
}

export function getSavedAuthOrigin(): string {
  if (cachedAuthOrigin && cachedAuthOrigin.includes('@')) return cachedAuthOrigin;
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_AUTH_ORIGIN_KEY);
      if (stored && stored.includes('@')) {
        cachedAuthOrigin = stored;
        return stored;
      }
    }
  } catch {}
  return '';
}

export function saveAuthOrigin(origin: string): void {
  if (!origin) return;
  cachedAuthOrigin = origin;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_AUTH_ORIGIN_KEY, origin);
    }
  } catch {}
}

/**
 * Returns the fully qualified external base URL including authentication credentials
 * if available (e.g. `https://user:pass@domain.com`).
 */
export function getExternalBaseUrl(systemStatus?: SystemStatusDTO | null): string {
  // 1. If explicit authenticatedOrigin with credentials is provided, cache and use it
  if (systemStatus?.authenticatedOrigin && systemStatus.authenticatedOrigin.includes('@')) {
    saveAuthOrigin(systemStatus.authenticatedOrigin);
    try {
      const atIdx = systemStatus.authenticatedOrigin.indexOf('@');
      const schemeIdx = systemStatus.authenticatedOrigin.indexOf('://');
      if (atIdx !== -1 && schemeIdx !== -1) {
        const credsPart = systemStatus.authenticatedOrigin.slice(schemeIdx + 3, atIdx);
        if (credsPart.includes(':')) {
          const colonIdx = credsPart.indexOf(':');
          const rawUser = credsPart.slice(0, colonIdx);
          const rawPass = credsPart.slice(colonIdx + 1);
          saveAuthCredentials(`${decodeURIComponent(rawUser)}:${decodeURIComponent(rawPass)}`);
        }
      }
    } catch {}
    return systemStatus.authenticatedOrigin;
  }

  // 2. Fall back to cached authenticated origin if available
  const savedOrigin = getSavedAuthOrigin();
  if (savedOrigin && savedOrigin.includes('@')) {
    return savedOrigin;
  }

  // 3. Fall back to saved credentials (localStorage)
  const savedCreds = getSavedAuthCredentials();

  if (typeof window !== 'undefined' && window.location) {
    const proto = window.location.protocol;
    const host = window.location.host;

    if (savedCreds && savedCreds.includes(':')) {
      const colonIdx = savedCreds.indexOf(':');
      const u = encodeURIComponent(savedCreds.slice(0, colonIdx));
      const p = encodeURIComponent(savedCreds.slice(colonIdx + 1));
      const constructed = `${proto}//${u}:${p}@${host}`;
      saveAuthOrigin(constructed);
      return constructed;
    }

    if (systemStatus?.authenticatedOrigin) {
      return systemStatus.authenticatedOrigin;
    }

    return window.location.origin;
  }

  return 'http://localhost:9000';
}
