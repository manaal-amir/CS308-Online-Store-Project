import { authenticatedFetch } from "./authenticatedFetch.js";
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/+$/, "");

// Shared request helper for the rating and comment endpoints of one product
// (/api/products/:id/...). Errors carry the HTTP status so the page can tell
// "you have not received this record" (403) from "already pending" (409).
// `token` is optional because anyone can read approved comments.
async function requestReviews(productId, path, token, { method = "GET", body, signal } = {}) {
  let response;

  try {
    response = await authenticatedFetch(
      `${API_BASE}/api/products/${encodeURIComponent(productId)}${path}`,
      token,
      {
        method,
        signal,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Could not reach the server. Please try again later.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data?.error || data?.message || `Review request failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

// GET /api/products/:id/reviews/me (customers only): what this customer can do
// on the record. Returns { canReview, rating, hasPendingComment }.
// canReview is true only once the record has been delivered to them.
export function getMyReview(token, productId, signal) {
  return requestReviews(productId, "/reviews/me", token, { signal });
}

// POST /api/products/:id/ratings: 1 to 5 whole stars, shown immediately.
// Returns { value, averageRating, ratingCount }. Rating again replaces the old value.
export function rateProduct(token, productId, value) {
  return requestReviews(productId, "/ratings", token, {
    method: "POST",
    body: { value },
  });
}

// GET /api/products/:id/comments: approved comments only, newest first. Public, so
// no token is needed. Each one is { id, content, createdAt, authorName } with the
// author shown as first name and last initial.
export function getApprovedComments(productId, signal) {
  return requestReviews(productId, "/comments", undefined, { signal });
}

// POST /api/products/:id/comments (customers who received the record): the comment
// is saved as pending and stays hidden until a product manager approves it.
// A second comment while one is pending is refused with 409.
export function postComment(token, productId, content) {
  return requestReviews(productId, "/comments", token, {
    method: "POST",
    body: { content },
  });
}
