const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/+$/, "");

// Shared request helper for the order endpoints. Errors carry the HTTP status
// so pages can tell "please sign in" (401) from "no longer allowed" (409).
async function requestOrders(path, token, { method = "GET", body, signal } = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE}/api/orders${path}`, {
      method,
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Could not reach the server. Please try again later.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data?.error || data?.message || `Order request failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

// GET /api/orders/:id: one order with its items, totals and address.
export function getOrder(token, orderId, signal) {
  return requestOrders(`/${encodeURIComponent(orderId)}`, token, { signal });
}

// GET /api/orders: the signed-in customer's orders, newest first.
export function getOrders(token, signal) {
  return requestOrders("", token, { signal });
}
