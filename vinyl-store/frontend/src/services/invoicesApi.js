import { authenticatedFetch } from "./authenticatedFetch.js";
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/+$/, "");

//GET /api/invoices/:orderId, customers only get their own invoices (404 otherwise)
export async function getInvoice(token, orderId, signal) {
  let response;

  try {
    response = await authenticatedFetch(`${API_BASE}/api/invoices/${encodeURIComponent(orderId)}`, token, {
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
      data?.error || data?.message || `Invoice request failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }

  return data;
}
