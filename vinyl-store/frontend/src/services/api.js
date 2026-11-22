import { catalogPreview } from "../data/catalogPreview.js";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/+$/, "");

export const API_BASE_URL = API_BASE;

export async function getProducts(signal, sort) {
  const sortQuery = sort ? `?sort=${encodeURIComponent(sort)}` : "";
  const response = await fetch(
    `${API_BASE}/api/products${sortQuery}`,
    { signal }
  );

  if (!response.ok) {
    throw new Error(
      `Product API returned ${response.status}`
    );
  }

  const payload = await response.json();

  const products = Array.isArray(payload)
    ? payload
    : payload.products ??
      payload.data?.products ??
      payload.data;

  if (!Array.isArray(products)) {
    throw new Error("Unexpected products API response");
  }

  return products;
}

// Fetches one product. Returns null when the API answers 404.
export async function getProductById(id, signal) {
  const response = await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}`, { signal });

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Product API returned ${response.status}`);
  }

  return response.json();
}

export async function getCatalogProducts(signal, sort) {
  try {
    return {
      products: await getProducts(signal, sort),
      source: "api",
      apiError: "",
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    return {
      products: catalogPreview,
      source: "spreadsheet-preview",
      apiError: error.message,
    };
  }
}


export async function registerUser(userData) {
  let response;

  try {
    response = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });
  } catch {
    throw new Error("Could not reach the server. Please try again later.");
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Could not reach the server. Please try again later."
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error || data?.message || "Registration failed."
    );
  }

  return data;
}

export async function loginUser(credentials) {
  let response;

  try {
    response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });
  } catch {
    throw new Error("Could not reach the server. Please try again later.");
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("The server returned an invalid response. Please try again.");
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || "Sign in failed.");
  }

  if (!data?.token || !data?.user) {
    throw new Error("The server returned an invalid sign-in response.");
  }

  return data;
}

export async function createOrder(orderData, token) {
  if (!token) {
    throw new Error("Please sign in before checking out.");
  }

  let response;

  try {
    response = await fetch(`${API_BASE}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderData),
    });
  } catch {
    throw new Error(
      "Could not reach the checkout server. Please try again."
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const fallbackMessages = {
      400: "Your cart is empty or the checkout information is invalid.",
      401: "Please sign in before checking out.",
      403: "Only customer accounts can place orders.",
      402: "Your card was declined. Please try another test card.",
      409: "Some items are no longer available in the requested quantity.",
    };

    const message =
      data?.error?.message ||
      (typeof data?.error === "string" ? data.error : null) ||
      data?.message ||
      fallbackMessages[response.status] ||
      "Checkout failed. Please try again.";

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (!data) {
    throw new Error("The server returned an invalid checkout response.");
  }

  return data;
}
