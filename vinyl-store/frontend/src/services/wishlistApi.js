
import { API_BASE_URL } from "./api.js";
import { authenticatedFetch } from "./authenticatedFetch.js";

async function wishlistRequest(
  path,
  token,
  { method = "GET", signal } = {}
) {
  if (!token) {
    throw new Error("Please sign in to use your wishlist.");
  }

  let response;

  try {
    response = await authenticatedFetch(
      `${API_BASE_URL}/api/wishlist${path}`,
      token,
      {
        method,
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (error) {
    if (error.name === "AbortError") throw error;

    throw new Error(
      "Could not reach the server. Please try again later."
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof data?.error === "string"
        ? data.error
        : data?.error?.message || data?.message;

    const error = new Error(
      message || `Wishlist request failed (${response.status})`
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

export async function getWishlist(token, signal) {
  const data = await wishlistRequest("", token, { signal });

  if (!Array.isArray(data?.items)) {
    throw new Error("Invalid wishlist response.");
  }

  return data.items;
}

export function addToWishlist(token, productId) {
  return wishlistRequest(
    `/${encodeURIComponent(productId)}`,
    token,
    { method: "POST" }
  );
}

export function removeFromWishlist(token, productId) {
  return wishlistRequest(
    `/${encodeURIComponent(productId)}`,
    token,
    { method: "DELETE" }
  );
}
