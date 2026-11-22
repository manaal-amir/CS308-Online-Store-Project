import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Invoice, { InvoiceDetails } from "./invoice.jsx";
import { saveAuthSession } from "../utils/authSession.js";

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

const invoice = {
  invoiceNumber: "INV-20261122-00123",
  issuedAt: "2026-11-22T12:00:00Z",
  totalAmount: 1450,
  customer: { name: "Test", lastname: "Customer", email: "test@example.com" },
  deliveryAddress: "Istanbul, Turkey",
  items: [{ productName: "Test Record", quantity: 1, unitPrice: 1450, lineTotal: 1450 }],
};

const order = {
  id: 123,
  status: "PROCESSING",
  createdAt: "2026-11-22T12:00:00Z",
  deliveryAddress: "Istanbul, Turkey",
  cardLast4: "4242",
  total: 1450,
  items: [],
};

//answers the invoice and order requests, which the page sends at the same time
function mockApi({ invoiceStatus = 200, orderStatus = 200 } = {}) {
  const fetchMock = vi.fn(async (url) => {
    const isInvoice = url.includes("/api/invoices/");
    const status = isInvoice ? invoiceStatus : orderStatus;
    const body = status === 200 ? (isInvoice ? invoice : order) : { error: "Order not found" };
    return { ok: status === 200, status, json: async () => body };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function signIn() {
  saveAuthSession({ token: "customer-token", user: { id: 8, role: "CUSTOMER" } });
}

describe("Invoice details", () => {
  test("shows the invoice number, records, total, address and masked card", () => {
    render(<InvoiceDetails invoice={invoice} order={order} />);

    expect(screen.getByText("INV-20261122-00123")).toBeTruthy();
    expect(screen.getByText("#123")).toBeTruthy();
    expect(screen.getByText("Test Record")).toBeTruthy();
    expect(screen.getByText("Card ending in 4242")).toBeTruthy();
    expect(screen.getByText("Istanbul, Turkey")).toBeTruthy();
  });

  test("never shows a full card number", () => {
    const { container } = render(<InvoiceDetails invoice={invoice} order={order} />);

    expect(container.textContent).not.toMatch(/\d{13,19}/);
  });
});

describe("Invoice page", () => {
  test("loads the invoice and the order for the order id with the customer's token", async () => {
    signIn();
    const fetchMock = mockApi();

    render(<Invoice orderId="123" />);

    expect(await screen.findByText("INV-20261122-00123")).toBeTruthy();
    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls).toContain("/api/invoices/123");
    expect(urls).toContain("/api/orders/123");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer customer-token");
  });

  test("shows not found when the order is missing or belongs to someone else", async () => {
    signIn();
    mockApi({ invoiceStatus: 404, orderStatus: 404 });

    render(<Invoice orderId="999" />);

    expect(await screen.findByText("Invoice not found.")).toBeTruthy();
  });

  test("sends a guest to sign-in and back to the invoice afterwards", () => {
    const replace = vi.fn();
    vi.stubGlobal("location", { ...window.location, replace });
    const fetchMock = mockApi();

    render(<Invoice orderId="123" />);

    expect(replace).toHaveBeenCalledWith("/sign-in?returnTo=%2Finvoice%2F123");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
