const SESSION_KEY = "vinyl-store-auth-session";
const SESSION_CHANGED = "vinyl-store-auth-session-changed";

function tokenExpiry(token) {
  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const { exp } = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

function readSession(storage) {
  const saved = storage.getItem(SESSION_KEY);
  if (!saved) return null;

  try {
    const session = JSON.parse(saved);
    if (typeof session?.token === "string" && session.token && session.user) return session;
  } catch {
    // Discard unreadable session data.
  }
  storage.removeItem(SESSION_KEY);
  return null;
}

function notifySessionChanged(expired = false) {
  window.dispatchEvent(new CustomEvent(SESSION_CHANGED, { detail: { expired } }));
}

export function saveAuthSession(session, remember = false) {
  const serialized = JSON.stringify(session);
  const destination = remember ? localStorage : sessionStorage;
  const otherStorage = remember ? sessionStorage : localStorage;

  otherStorage.removeItem(SESSION_KEY);
  destination.setItem(SESSION_KEY, serialized);
  notifySessionChanged();
}

export function getAuthSession() {
  for (const storage of [sessionStorage, localStorage]) {
    const session = readSession(storage);
    if (!session) continue;
    const expiry = tokenExpiry(session.token);
    if (expiry === null || expiry > Date.now()) return session;
    storage.removeItem(SESSION_KEY);
  }

  return null;
}

export function clearAuthSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  notifySessionChanged();
}

export function expireAuthSession(token) {
  if (!token) return false;
  const storages = [sessionStorage, localStorage];
  const activeSession = readSession(sessionStorage) ?? readSession(localStorage);
  if (activeSession?.token !== token) return false;

  for (const storage of storages) {
    if (readSession(storage)?.token === token) storage.removeItem(SESSION_KEY);
  }
  notifySessionChanged(true);
  return true;
}

export function subscribeToAuthSession(listener) {
  function onStorage(event) {
    if (event.key === SESSION_KEY || event.key === null) listener();
  }

  window.addEventListener(SESSION_CHANGED, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SESSION_CHANGED, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function monitorAuthSession(onExpired) {
  let timer;

  function check() {
    window.clearTimeout(timer);
    const session = readSession(sessionStorage) ?? readSession(localStorage);
    if (!session) return;

    const expiry = tokenExpiry(session.token);
    if (expiry === null) return;

    const remaining = expiry - Date.now();
    if (remaining <= 0) {
      expireAuthSession(session.token);
      return;
    }
    timer = window.setTimeout(check, Math.min(remaining, 2147483647));
  }

  const unsubscribe = subscribeToAuthSession((event) => {
    if (event?.detail?.expired) onExpired();
    check();
  });
  window.addEventListener("focus", check);
  document.addEventListener("visibilitychange", check);
  check();

  return () => {
    unsubscribe();
    window.clearTimeout(timer);
    window.removeEventListener("focus", check);
    document.removeEventListener("visibilitychange", check);
  };
}
