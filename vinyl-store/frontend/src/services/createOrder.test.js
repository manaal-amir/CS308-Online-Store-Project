import { afterEach, expect, test, vi } from "vitest";
import { createOrder } from "./api.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(ok, status, body) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, json: async () => body })
  );
}

test("returns the created order when checkout succeeds", async () => {
  const order = { id: 7, status: "PROCESSING", totalPrice: 450, invoiceNumber: "INV-7" };
  mockFetch(true, 201, order);

  await expect(createOrder({ cardNumber: "4242424242424242" }, "token")).resolves.toEqual(order);
});

test("sends the order to POST /api/orders with the token", async () => {
  mockFetch(true, 201, { id: 1 });

  await createOrder({ cardNumber: "4242424242424242" }, "abc");

  const [url, options] = fetch.mock.calls[0];
  expect(url).toMatch(/\/api\/orders$/);
  expect(options.method).toBe("POST");
  expect(options.headers.Authorization).toBe("Bearer abc");
});

test("rejects with the backend message and status when the card is declined", async () => {
  mockFetch(false, 402, { error: "Card declined" });

  await expect(createOrder({}, "token")).rejects.toMatchObject({
    status: 402,
    message: "Card declined",
  });
});

test("rejects with a clear message when the success response has no body", async () => {
  mockFetch(true, 201, null);

  await expect(createOrder({}, "token")).rejects.toThrow("invalid checkout response");
});
