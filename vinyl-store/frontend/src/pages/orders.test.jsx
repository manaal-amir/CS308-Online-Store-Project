// Tests for the order history page (SCRUM-129).
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import Orders, { OrderList, StatusBadge } from "./orders.jsx";
import { getOrders } from "../services/ordersApi.js";
import { getAuthSession, saveAuthSession } from "../utils/authSession.js";
import { formatPrice } from "../utils/productFormat.js";

vi.mock("../services/ordersApi.js", () => ({ getOrders: vi.fn() }));
vi.mock("../components/layout/navBar.jsx", () => ({ default: () => <nav /> }));
vi.mock("../components/layout/footer.jsx", () => ({ default: () => <footer /> }));

const customer = { token: "cus-token", user: { id: 8, email: "c@example.com", role: "CUSTOMER" } };

const orders = [
  { id: 12, status: "IN_TRANSIT", createdAt: "2026-11-20T12:00:00.000Z", total: 1450 },
  { id: 9, status: "CANCELLED", createdAt: "2026-10-01T12:00:00.000Z", total: 900 },
];

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("StatusBadge", () => {
  test("shows a readable label and a status class", () => {
    render(<StatusBadge status="IN_TRANSIT" />);

    const badge = screen.getByText("In transit");
    expect(badge.className).toContain("order-status-in-transit");
  });
});

describe("OrderList", () => {
  test("lists each order with date, status and total, linking to its details", () => {
    render(<OrderList orders={orders} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    const first = screen.getByRole("link", { name: /Order #12/ });
    expect(first.getAttribute("href")).toBe("/orders/12");
    expect(first.textContent).toContain("20 Nov 2026");
    expect(first.textContent).toContain("In transit");
    expect(first.textContent).toContain(formatPrice(1450));
    expect(screen.getByText("Cancelled")).toBeTruthy();
  });
});

describe("Orders page", () => {
  test("loads and shows the signed-in customer's orders", async () => {
    saveAuthSession(customer);
    getOrders.mockResolvedValue(orders);
    render(<Orders />);

    expect(screen.getByRole("heading", { name: "My Orders" })).toBeTruthy();
    expect(await screen.findByText("Order #12")).toBeTruthy();
    expect(screen.getByText("Order #9")).toBeTruthy();
    expect(getOrders).toHaveBeenCalledWith("cus-token", expect.any(AbortSignal));
  });

  test("shows a loading message while the request is pending", () => {
    saveAuthSession(customer);
    getOrders.mockReturnValue(new Promise(() => {}));
    render(<Orders />);

    expect(screen.getByText("Loading your orders…")).toBeTruthy();
  });

  test("invites a customer with no orders to browse the shop", async () => {
    saveAuthSession(customer);
    getOrders.mockResolvedValue([]);
    render(<Orders />);

    expect(await screen.findByText(/placed any orders yet/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse records" }).getAttribute("href")).toBe("/shop");
  });

  test("a guest is sent to sign in and no orders are requested", () => {
    render(<Orders />);

    expect(screen.getByText(/Redirecting to/)).toBeTruthy();
    expect(getOrders).not.toHaveBeenCalled();
  });

  test("an expired session (401) is cleared", async () => {
    saveAuthSession(customer);
    getOrders.mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }));
    render(<Orders />);

    await waitFor(() => expect(getAuthSession()).toBeNull());
  });

  test("a non-customer account (403) gets a clear message", async () => {
    saveAuthSession(customer);
    getOrders.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    render(<Orders />);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Only customer accounts have an order history.",
    );
  });

  test("shows the error message for other failures", async () => {
    saveAuthSession(customer);
    getOrders.mockRejectedValue(new Error("Could not reach the server. Please try again later."));
    render(<Orders />);

    expect((await screen.findByRole("alert")).textContent).toContain("Could not reach the server");
  });
});
