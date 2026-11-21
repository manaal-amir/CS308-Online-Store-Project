
import { getAuthSession } from "./authSession.js";

const WISHLIST_EVENT = "vinyl-wishlist-changed";

function storageKey() {
  const userId = getAuthSession()?.user?.id;
  return userId == null ? null : `vinyl-wishlist-${userId}`;
}

export function getLocalWishlistIds() {
  const key = storageKey();
  if (!key) return [];

  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");

    return Array.isArray(value)
      ? [...new Set(value.map(String))]
      : [];
  } catch {
    return [];
  }
}

export function isInLocalWishlist(productId) {
  return getLocalWishlistIds().includes(String(productId));
}

export function toggleLocalWishlist(productId) {
  const key = storageKey();

  if (!key) {
    throw new Error("Please sign in to use your wishlist.");
  }

  const id = String(productId);
  const current = getLocalWishlistIds();
  const isSaved = current.includes(id);

  const updated = isSaved
    ? current.filter((item) => item !== id)
    : [id, ...current];

  localStorage.setItem(key, JSON.stringify(updated));
  window.dispatchEvent(new Event(WISHLIST_EVENT));

  return !isSaved;
}

export function subscribeToLocalWishlist(callback) {
  const notify = () => callback(getLocalWishlistIds());

  window.addEventListener(WISHLIST_EVENT, notify);
  window.addEventListener("storage", notify);

  return () => {
    window.removeEventListener(WISHLIST_EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}
