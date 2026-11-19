const SESSION_KEY = "vinyl-store-auth-session";

export function saveAuthSession(session, remember = false) {
  const serialized = JSON.stringify(session);
  const destination = remember ? localStorage : sessionStorage;
  const otherStorage = remember ? sessionStorage : localStorage;

  otherStorage.removeItem(SESSION_KEY);
  destination.setItem(SESSION_KEY, serialized);
}

export function getAuthSession() {
  for (const storage of [sessionStorage, localStorage]) {
    const saved = storage.getItem(SESSION_KEY);
    if (!saved) continue;

    try {
      const session = JSON.parse(saved);
      if (session?.token && session?.user) return session;
    } catch {
      storage.removeItem(SESSION_KEY);
    }
  }

  return null;
}

export function clearAuthSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}
