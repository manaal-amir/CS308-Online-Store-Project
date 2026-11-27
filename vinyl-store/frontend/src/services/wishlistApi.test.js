
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from "./wishlistApi.js";
import { authenticatedFetch } from "./authenticatedFetch.js";

vi.mock("./api.js", () => ({
  API_BASE_URL: "",
}));

vi.mock("./authenticatedFetch.js", () => ({
  authenticatedFetch: vi.fn(),
}));

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

describe("wishlist API", () => {
  test("loads saved products from the backend", async () => {
    const items = [
      {
        productId: 7,
        name: "Test Record",
        artist: "Test Artist",
        price: 100,
      },
    ];

    authenticatedFetch.mockResolvedValue(
      response({ items })
    );

    const result = await getWishlist("test-token");

    expect(result).toEqual(items);

    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/wishlist",
      "test-token",
      expect.objectContaining({
        method: "GET",
        headers: {
          Authorization: "Bearer test-token",
        },
      })
    );
  });

  test("handles an empty wishlist", async () => {
    authenticatedFetch.mockResolvedValue(
      response({ items: [] })
    );

    expect(await getWishlist("test-token")).toEqual([]);
  });

  test("adds a product through POST", async () => {
    authenticatedFetch.mockResolvedValue(
      response({ productId: 7, added: true }, 201)
    );

    const result = await addToWishlist("test-token", 7);

    expect(result.added).toBe(true);

    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/wishlist/7",
      "test-token",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  test("removes a product through DELETE", async () => {
    authenticatedFetch.mockResolvedValue(
      response({ productId: 7, removed: true })
    );

    const result = await removeFromWishlist("test-token", 7);

    expect(result.removed).toBe(true);

    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/wishlist/7",
      "test-token",
      expect.objectContaining({
        method: "DELETE",
      })
    );
  });

  test("requires sign-in", async () => {
    await expect(
      getWishlist(null)
    ).rejects.toThrow("Please sign in");

    expect(authenticatedFetch).not.toHaveBeenCalled();
  });

  test("handles a product that is already saved", async () => {
    authenticatedFetch.mockResolvedValue(
      response({ error: "Product already in wish list" }, 409)
    );

    await expect(
      addToWishlist("test-token", 7)
    ).rejects.toMatchObject({
      status: 409,
      message: "Product already in wish list",
    });
  });

  test("rejects an invalid wishlist response", async () => {
    authenticatedFetch.mockResolvedValue(
      response({})
    );

    await expect(
      getWishlist("test-token")
    ).rejects.toThrow("Invalid wishlist response");
  });
});
