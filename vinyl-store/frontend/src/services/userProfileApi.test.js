
import { afterEach, describe, expect, test, vi } from "vitest";
import { getUserProfile } from "./userProfileApi.js";
import { authenticatedFetch } from "./authenticatedFetch.js";

vi.mock("./api.js", () => ({
  API_BASE_URL: "",
}));

vi.mock("./authenticatedFetch.js", () => ({
  authenticatedFetch: vi.fn(),
}));

const profile = {
  id: 5,
  name: "Test",
  lastname: "Customer",
  email: "test@example.com",
  homeAddress: "Test Street",
  role: "CUSTOMER",
};

function response(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getUserProfile", () => {
  test("fetches the signed-in user's real profile", async () => {
    authenticatedFetch.mockResolvedValue(response(profile));

    const result = await getUserProfile("test-token");

    expect(result).toEqual(profile);

    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/users/me",
      "test-token",
      expect.objectContaining({
        method: "GET",
        headers: {
          Authorization: "Bearer test-token",
        },
      })
    );
  });

  test("requires an authentication token", async () => {
    await expect(getUserProfile(null)).rejects.toThrow(
      "Please sign in"
    );

    expect(authenticatedFetch).not.toHaveBeenCalled();
  });

  test("handles API errors", async () => {
    authenticatedFetch.mockResolvedValue(
      response({ error: "Unauthorized" }, 401)
    );

    await expect(
      getUserProfile("expired-token")
    ).rejects.toThrow("Unauthorized");
  });

  test("rejects invalid profile data", async () => {
    authenticatedFetch.mockResolvedValue(response({}));

    await expect(
      getUserProfile("test-token")
    ).rejects.toThrow("Invalid profile response");
  });

  test("handles network failures", async () => {
    authenticatedFetch.mockRejectedValue(
      new Error("Network failure")
    );

    await expect(
      getUserProfile("test-token")
    ).rejects.toThrow("Could not reach the server");
  });
});
