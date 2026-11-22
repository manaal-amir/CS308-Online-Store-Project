const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/+$/, "");

const pendingAdds = new Map();

async function requestCart(path, token, { method = "GET", body, signal } = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE}/api/cart${path}`, {
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
    //the backend sends { error: "..." }, older handlers may send { error: { message } }
    const message =
      data?.error?.message ||
      (typeof data?.error === "string" ? data.error : null) ||
      data?.message ||
      `Cart request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

export function getAuthenticatedCart(token, signal) {
  return requestCart("", token, { signal });
}

export function addAuthenticatedCartItem(token, productId, quantity = 1) {
  const requestKey = `${token}:${productId}`;
  const pendingRequest = pendingAdds.get(requestKey);
  if (pendingRequest) return pendingRequest;

  const request = requestCart("/items", token, {
    method: "POST",
    body: { productId, quantity },
  }).finally(() => {
    pendingAdds.delete(requestKey);
  });

  pendingAdds.set(requestKey, request);
  return request;
}

export function updateAuthenticatedCartItem(token, productId, quantity) {
  return requestCart(`/items/${encodeURIComponent(productId)}`, token, {
    method: "PATCH",
    body: { quantity },
  });
}

export function removeAuthenticatedCartItem(token, productId) {
  return requestCart(`/items/${encodeURIComponent(productId)}`, token, {
    method: "DELETE",
  });
}
