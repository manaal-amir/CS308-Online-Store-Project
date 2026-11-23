import { authenticatedFetch } from "./authenticatedFetch.js";
import { API_BASE_URL } from "./api.js";

async function requestProducts(path, token, { method = "GET", body, signal } = {}) {
  const response = await authenticatedFetch(`${API_BASE_URL}/api/products${path}`, token, {
    method,
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body && { "Content-Type": "application/json" }),
    },
    body: body && JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || data?.message ||
      (typeof data?.error === "string" ? data.error : null);
    throw new Error(message || `Catalogue request failed (${response.status}).`);
  }
  return data;
}

// Expected to return { categories, artists, genres }, each an array of { id, name }.
export async function getProductOptions(token, signal) {
  const data = await requestProducts("/options", token, { signal });
  if (!Array.isArray(data?.categories) || !Array.isArray(data.artists) ||
      !Array.isArray(data.genres)) {
    throw new Error("The server returned invalid catalogue options.");
  }
  return data;
}

export function addProduct(token, body) {
  return requestProducts("", token, { method: "POST", body });
}

export function removeProduct(token, id) {
  return requestProducts(`/${encodeURIComponent(id)}`, token, { method: "DELETE" });
}

export function updateProductStock(token, id, quantity) {
  return requestProducts(`/${encodeURIComponent(id)}/stock`, token, {
    method: "PATCH",
    body: { quantity },
  });
}
