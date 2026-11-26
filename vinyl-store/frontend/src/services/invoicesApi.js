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

// GET /api/invoices (product managers and sales managers): every invoice, newest first.
// Optional from / to are YYYY-MM-DD issue dates; the API counts the whole "to" day.
// Each one is { id, invoiceNumber, totalAmount, issuedAt, orderId, customer: { name, lastname, email } }.
export async function getInvoices(token, { from, to, signal } = {}) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString() ? `?${params}` : "";
  let response;

  try {
    response = await authenticatedFetch(`${API_BASE}/api/invoices${query}`, token, {
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
