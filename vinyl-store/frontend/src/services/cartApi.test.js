import { afterEach, describe, expect, test, vi } from "vitest";
import {
  addAuthenticatedCartItem,
  getAuthenticatedCart,
} from "./cartApi.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authenticated cart API", () => {
  test("rejects a 409 with the backend's actual error message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "Only 3 in stock" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(addAuthenticatedCartItem("customer-token", 17, 1))
      .rejects.toThrow("Only 3 in stock");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cart/items",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer customer-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId: 17, quantity: 1 }),
      }),
    );
  });

  test("does not issue duplicate overlapping adds for the same product", async () => {
    let resolveResponse;
    const fetchMock = vi.fn(() => new Promise((resolve) => {
      resolveResponse = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);

    const first = addAuthenticatedCartItem("customer-token", 17, 1);
    const repeated = addAuthenticatedCartItem("customer-token", 17, 1);

    expect(repeated).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveResponse({
      ok: true,
      status: 200,
      json: async () => ({ items: [{ productId: 17, quantity: 1 }] }),
    });
    await expect(first).resolves.toEqual({
      items: [{ productId: 17, quantity: 1 }],
    });
  });

  test("GET cart requests preserve the backend cart response", async () => {
    const cart = { items: [], itemCount: 0, total: 0 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => cart,
    }));

    await expect(getAuthenticatedCart("customer-token")).resolves.toEqual(cart);
  });
});
