// Tests for the invoice list helper used by the product manager page (SCRUM-67 / SCRUM-165).
import { afterEach, describe, expect, test, vi } from "vitest";
import { getInvoices } from "./invoicesApi.js";

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

describe("getInvoices", () => {
  test("requests every invoice with the bearer token when there is no range", async () => {
    const invoices = [{ id: 1, invoiceNumber: "INV-1", totalAmount: 1450, orderId: 4 }];
    const fetchMock = stubFetch(response(invoices));

    await expect(getInvoices("tok")).resolves.toEqual(invoices);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/invoices");
    expect(options.headers.Authorization).toBe("Bearer tok");
  });

  test("sends only the dates that were chosen", async () => {
    const fetchMock = stubFetch(response([]));

    await getInvoices("tok", { from: "2026-11-01" });
    await getInvoices("tok", { to: "2026-11-30" });
    await getInvoices("tok", { from: "2026-11-01", to: "2026-11-30" });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/invoices?from=2026-11-01",
      "/api/invoices?to=2026-11-30",
      "/api/invoices?from=2026-11-01&to=2026-11-30",
    ]);
  });

  test("treats empty dates as no filter", async () => {
    const fetchMock = stubFetch(response([]));

    await getInvoices("tok", { from: "", to: "" });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/invoices");
  });

  test("passes the abort signal to fetch", async () => {
    const fetchMock = stubFetch(response([]));
    const controller = new AbortController();

    await getInvoices("tok", { signal: controller.signal });

    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });

  test("keeps the API message and status for a refused role", async () => {
    stubFetch(response({ error: "Forbidden" }, false, 403));

    await expect(getInvoices("tok")).rejects.toMatchObject({ message: "Forbidden", status: 403 });
  });

  test("shows the API's date message for a bad range", async () => {
    stubFetch(response({ error: "from must be a valid date (YYYY-MM-DD)" }, false, 400));

    await expect(getInvoices("tok", { from: "nope" })).rejects.toMatchObject({
      message: "from must be a valid date (YYYY-MM-DD)",
      status: 400,
    });
  });

  test("falls back to a generic message when the body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("not json");
        },
      }),
    );

    await expect(getInvoices("tok")).rejects.toMatchObject({
      message: "Invoice request failed (500)",
      status: 500,
    });
  });

  test("reports an unreachable server in plain words", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(getInvoices("tok")).rejects.toThrow("Could not reach the server. Please try again later.");
  });

  test("lets an abort through unchanged", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));

    await expect(getInvoices("tok")).rejects.toMatchObject({ name: "AbortError" });
  });
});
