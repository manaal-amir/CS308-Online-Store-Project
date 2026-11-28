
import { authenticatedFetch } from "./authenticatedFetch.js";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/+$/, "");

async function requestComments(path, token, options = {}) {
  const { method = "GET", status, signal } = options;

  if (!token) {
    throw new Error("Please sign in to manage comments.");
  }

  let response;

  try {
    response = await authenticatedFetch(
      `${API_BASE}/api/comments${path}`,
      token,
      {
        method,
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(status ? { "Content-Type": "application/json" } : {}),
        },
        ...(status ? { body: JSON.stringify({ status }) } : {}),
      },
    );
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Could not reach the server. Please try again.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof data?.error === "string"
        ? data.error
        : data?.error?.message || data?.message;

    const error = new Error(
      message || `Comment request failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function getPendingComments(token, signal) {
  const comments = await requestComments("/pending", token, { signal });

  if (!Array.isArray(comments)) {
    throw new Error("Invalid pending comments response.");
  }

  return comments;
}

export function reviewPendingComment(token, commentId, status) {
  if (!["APPROVED", "REJECTED"].includes(status)) {
    throw new Error("Invalid comment decision.");
  }

  return requestComments(`/${encodeURIComponent(commentId)}`, token, {
    method: "PATCH",
    status,
  });
}