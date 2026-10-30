import { catalogPreview } from "../data/catalogPreview.js";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/+$/, "");

export async function getProducts(signal) {
  const response = await fetch(
    `${API_BASE}/api/products`,
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

export async function getCatalogProducts(signal) {
  try {
    return {
      products: await getProducts(signal),
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
