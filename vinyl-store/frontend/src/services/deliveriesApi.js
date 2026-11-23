import { authenticatedFetch } from "./authenticatedFetch.js";
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/+$/, "");

// GET /api/deliveries (product managers only). `completed` is optional:
// true = delivered orders, false = still waiting, undefined = all but cancelled.
// One row per product in an order; deliveryId is the order id.
export async function getDeliveries(token, { completed, signal } = {}) {
  const query = completed === undefined ? "" : `?completed=${completed}`;
  let response;

  try {
    response = await authenticatedFetch(`${API_BASE}/api/deliveries${query}`, token, {
      signal,
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Could not reach the server. Please try again later.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data?.error || data?.message || `Delivery request failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }

  return data;
}
