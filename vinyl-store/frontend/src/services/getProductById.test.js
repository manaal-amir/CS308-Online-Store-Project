// Tests for the product-by-id API call used by the product detail page.
import { afterEach, describe, expect, test, vi } from "vitest";
import { getProductById } from "./api.js";

afterEach(() => vi.unstubAllGlobals());

describe("getProductById", () => {
  test("returns the product on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 3, name: "Satch Plays Fats" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getProductById("3")).resolves.toEqual({ id: 3, name: "Satch Plays Fats" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/products/3");
  });

  test("returns null on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(getProductById("9999")).resolves.toBeNull();
  });

  test("throws on other server errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(getProductById("1")).rejects.toThrow("Product API returned 500");
  });

  test("encodes the id in the URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);
    await getProductById("1/../2");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/products/1%2F..%2F2");
  });
});
