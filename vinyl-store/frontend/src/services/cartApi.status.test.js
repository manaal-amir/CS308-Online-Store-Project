
import { afterEach, expect, test, vi } from "vitest";
import { getAuthenticatedCart } from "./cartApi.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("cart API preserves HTTP 401 status", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Token expired" }),
    })
  );

  await expect(
    getAuthenticatedCart("expired-token")
  ).rejects.toMatchObject({
    status: 401,
    message: "Token expired",
  });
});
