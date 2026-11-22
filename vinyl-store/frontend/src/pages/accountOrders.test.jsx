// Tests for the profile overview's latest order panel (replaces the hardcoded sample order).
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import Account, { LatestOrderPanel } from "./account.jsx";
import { saveAuthSession } from "../utils/authSession.js";

function response(data, ok = true, status = 200) {
  return { ok, status, json: async () => data };
}

const orders = [
  { id: 12, status: "IN_TRANSIT", createdAt: "2026-11-20T10:00:00.000Z", total: 1450 },
  { id: 9, status: "DELIVERED", createdAt: "2026-10-01T10:00:00.000Z", total: 900 },
];

function openProfile(role = "CUSTOMER") {
  saveAuthSession({
    token: "tok",
    user: { id: 8, email: "member@example.com", role },
  });
  window.history.pushState({}, "", "/profile");
  return render(<Account />);
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LatestOrderPanel", () => {
  test("shows the newest order with its status, total and a details link", () => {
    render(<LatestOrderPanel summary={{ status: "ready", orders }} />);

    expect(screen.getByRole("heading", { name: "Order #12" })).toBeTruthy();
    expect(screen.getByText("In transit")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View details →" }).getAttribute("href")).toBe("/orders/12");
    expect(screen.getByRole("link", { name: "View all orders →" }).getAttribute("href")).toBe("/orders");
  });

  test("never shows the old hardcoded sample order", () => {
    render(<LatestOrderPanel summary={{ status: "ready", orders }} />);

    expect(screen.queryByText(/VN-2048/)).toBeNull();
  });

  test("invites a new customer to browse when there are no orders", () => {
    render(<LatestOrderPanel summary={{ status: "ready", orders: [] }} />);

    expect(screen.getByText(/have not placed any orders yet/)).toBeTruthy();
    expect(screen.queryByText(/Order #/)).toBeNull();
  });

  test("shows loading, error and non-customer states", () => {
    const { rerender } = render(<LatestOrderPanel summary={{ status: "loading", orders: [] }} />);
    expect(screen.getByText("Loading your orders…")).toBeTruthy();

    rerender(<LatestOrderPanel summary={{ status: "error", orders: [] }} />);
    expect(screen.getByRole("alert").textContent).toContain("could not load");

    rerender(<LatestOrderPanel summary={{ status: "unavailable", orders: [] }} />);
    expect(screen.getByText(/only available for customer accounts/)).toBeTruthy();
  });
});

describe("profile overview", () => {
  test("loads the customer's real orders and counts them", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(orders));
    vi.stubGlobal("fetch", fetchMock);
    openProfile();

    expect(await screen.findByRole("heading", { name: "Order #12" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orders",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer tok" }) }),
    );
    expect(screen.getByText("Orders you have placed")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  test("shows an error instead of fake data when loading fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: "boom" }, false, 500)));
    openProfile();

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("could not load"));
    expect(screen.queryByText(/VN-2048/)).toBeNull();
  });

  test("does not request orders for a product manager", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response([]));
    vi.stubGlobal("fetch", fetchMock);
    openProfile("PRODUCT_MANAGER");

    expect(await screen.findByText(/only available for customer accounts/)).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/orders"))).toBe(false);
  });
});
