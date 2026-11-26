
import { authenticatedFetch } from "./authenticatedFetch.js";
import { API_BASE_URL } from "./api.js";

export async function getUserProfile(token, signal) {
  if (!token) {
    throw new Error("Please sign in to view your profile.");
  }

  let response;

  try {
    response = await authenticatedFetch(
      `${API_BASE_URL}/api/users/me`,
      token,
      {
        method: "GET",
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Could not reach the server. Please try again later.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof data?.error === "string"
        ? data.error
        : data?.error?.message || data?.message;

    const error = new Error(
      message || `Profile request failed (${response.status})`
    );
    error.status = response.status;
    throw error;
  }

  if (!data || data.id == null || typeof data.email !== "string") {
    throw new Error("Invalid profile response.");
  }

  return data;
}
