import type { AuthUser } from '@/services/api';

const AUTH_TOKEN_KEY = 'dresscode.auth.token';
const AUTH_USER_KEY = 'dresscode.auth.user';

export interface StoredSession {
  token: string;
  user: AuthUser | null;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadStoredSession(): StoredSession | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const token = storage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    return null;
  }

  const rawUser = storage.getItem(AUTH_USER_KEY);
  if (!rawUser) {
    return { token, user: null };
  }

  try {
    const user = JSON.parse(rawUser) as AuthUser;
    return { token, user };
  } catch {
    return { token, user: null };
  }
}

export function saveStoredSession(session: StoredSession) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(AUTH_TOKEN_KEY, session.token);
  if (session.user) {
    storage.setItem(AUTH_USER_KEY, JSON.stringify(session.user));
  } else {
    storage.removeItem(AUTH_USER_KEY);
  }
}

export function clearStoredSession() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(AUTH_TOKEN_KEY);
  storage.removeItem(AUTH_USER_KEY);
}
