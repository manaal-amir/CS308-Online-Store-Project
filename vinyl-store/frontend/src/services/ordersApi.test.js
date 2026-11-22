// Tests for the order API helpers (SCRUM-129, SCRUM-134).
import { afterEach, describe, expect, test, vi } from "vitest";
import { cancelOrder, getOrder, getOrders } from "./ordersApi.js";

function response(data, ok = true, status = 200) {
  return { ok, status, json: async () => data };
}

function stubFetch(result) {
  const fetchMock = vi.fn().mockResolvedValue(result);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getOrders", () => {
  test("requests the order list with the bearer token", async () => {
    const orders = [{ id: 2, status: "PROCESSING", total: 900 }];
    const fetchMock = stubFetch(response(orders));

    await expect(getOrders("tok")).resolves.toEqual(orders);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/orders");
    expect(options.method).toBe("GET");
    expect(options.headers.Authorization).toBe("Bearer tok");
    expect(options.body).toBeUndefined();
  });

  test("passes the abort signal to fetch", async () => {
    const fetchMock = stubFetch(response([]));
    const controller = new AbortController();

    await getOrders("tok", controller.signal);

    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });
});

describe("getOrder", () => {
  test("requests one order by id", async () => {
    const fetchMock = stubFetch(response({ id: 7, items: [] }));

    await expect(getOrder("tok", 7)).resolves.toEqual({ id: 7, items: [] });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/orders/7");
  });

  test("encodes the id so it cannot change the path", async () => {
    const fetchMock = stubFetch(response({}));

    await getOrder("tok", "7/cancel");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/orders/7%2Fcancel");
  });
});

describe("cancelOrder", () => {
  test("sends a POST to the cancel endpoint", async () => {
    const result = { id: 7, status: "CANCELLED", refundedAmount: 1450 };
    const fetchMock = stubFetch(response(result));

    await expect(cancelOrder("tok", 7)).resolves.toEqual(result);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/orders/7/cancel");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer tok");
  });
});

describe("error handling", () => {
  test("uses the API message and keeps the HTTP status", async () => {
    stubFetch(response({ error: "Only orders that are processing can be cancelled" }, false, 409));

    await expect(cancelOrder("tok", 7)).rejects.toMatchObject({
      message: "Only orders that are processing can be cancelled",
      status: 409,
    });
  });

  test("falls back to a generic message when the body is empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOrders("tok")).rejects.toMatchObject({
      message: "Order request failed (500)",
      status: 500,
    });
  });

  test("reports an unreachable server in plain words", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(getOrders("tok")).rejects.toThrow("Could not reach the server. Please try again later.");
  });

  test("lets an abort through unchanged so pages can ignore it", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));

    await expect(getOrders("tok")).rejects.toMatchObject({ name: "AbortError" });
  });
});
