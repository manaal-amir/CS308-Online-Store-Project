import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Cart from "./cart.jsx";
import {
  addToGuestCart,
  getGuestCart,
  mergeGuestCartAfterLogin,
  resetGuestCartForTests,
} from "../utils/guestCart.js";
import { saveAuthSession } from "../utils/authSession.js";

const product = {
  id: 17,
  name: "Test Record",
  quantity: 3,
  price: 100,
  artist: { name: "Test Artist" },
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  resetGuestCartForTests();
  vi.unstubAllGlobals();
});

describe("cart stock controls", () => {
  test("disables increasing a cart quantity at available stock", async () => {
    addToGuestCart(product.id, product.quantity, product.quantity);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [product],
    }));

    render(<Cart />);

    const increase = await screen.findByRole("button", {
      name: "Increase quantity of Test Record",
    });
    await waitFor(() => expect(increase.disabled).toBe(true));
  });

  test("loads authenticated cart details and refreshes after quantity updates and removal", async () => {
    const accountItem = {
      productId: 17,
      name: "Account Record",
      artist: "Account Artist",
      imageUrl: null,
      price: 125.5,
      quantity: 2,
      stock: 5,
      lineTotal: 251,
    };
    saveAuthSession({
      token: "customer-token",
      user: { id: 8, role: "CUSTOMER" },
    });

    // The page and the navbar both read the cart, so answer by request type
    // instead of by call order, and keep the "server" cart up to date.
    let serverItems = [accountItem];
    const fetchMock = vi.fn(async (url, init = {}) => {
      if (init.method === "PATCH") {
        serverItems = [{ ...accountItem, quantity: JSON.parse(init.body).quantity }];
      }
      if (init.method === "DELETE") serverItems = [];
      return {
        ok: true,
        status: 200,
        json: async () => ({ items: serverItems, itemCount: serverItems.length, total: 0 }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const callsFor = (method) =>
      fetchMock.mock.calls.filter(([, init]) => (init?.method || "GET") === method);

    const { unmount } = render(<Cart />);

    expect(await screen.findByRole("heading", { name: "Account Record" })).toBeTruthy();
    expect(screen.getByText("₺125,50")).toBeTruthy();
    expect(screen.getByText("₺251,00")).toBeTruthy();
    expect(callsFor("GET")[0]).toEqual(["/api/cart", expect.objectContaining({
      headers: { Authorization: "Bearer customer-token" },
    })]);

    fireEvent.click(screen.getByRole("button", { name: "Decrease quantity of Account Record" }));
    await waitFor(() => expect(callsFor("PATCH")).toHaveLength(1));
    expect(callsFor("PATCH")[0]).toEqual([
      "/api/cart/items/17",
      expect.objectContaining({ body: JSON.stringify({ quantity: 1 }) }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(callsFor("DELETE")).toHaveLength(1));
    expect(callsFor("DELETE")[0][0]).toBe("/api/cart/items/17");
    expect(await screen.findByText("Your cart is currently empty.")).toBeTruthy();
    expect(localStorage.getItem("vinyl-store-guest-cart")).toBeNull();

    unmount();
  });

  test("refreshing the cart reloads existing authenticated items from the backend", async () => {
    const accountItem = {
      productId: 17,
      name: "Persisted Account Record",
      artist: "Account Artist",
      imageUrl: null,
      price: 99,
      quantity: 1,
      stock: 5,
      lineTotal: 99,
    };
    saveAuthSession({
      token: "customer-token",
      user: { id: 8, role: "CUSTOMER" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [accountItem], itemCount: 1, total: 99 }),
    }));

    const firstRender = render(<Cart />);
    expect(await screen.findByRole("heading", { name: "Persisted Account Record" })).toBeTruthy();
    firstRender.unmount();

    render(<Cart />);
    expect(await screen.findByRole("heading", { name: "Persisted Account Record" })).toBeTruthy();
    expect(screen.getAllByText("₺99,00")).toHaveLength(2);
  });

  test("waits for login cart merging before loading the account cart", async () => {
    addToGuestCart(17, 1, 5);
    saveAuthSession({
      token: "customer-token",
      user: { id: 8, role: "CUSTOMER" },
    });
    const accountItem = {
      productId: 17,
      name: "Merged Account Record",
      artist: "Account Artist",
      imageUrl: null,
      price: 99,
      quantity: 1,
      stock: 5,
      lineTotal: 99,
    };
    let finishMerge;
    const fetchMock = vi.fn((url) => {
      if (url === "/api/cart/merge") {
        return new Promise((resolve) => {
          finishMerge = () => resolve({
            ok: true,
            status: 200,
            json: async () => ({ items: [accountItem], adjustments: [] }),
          });
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ items: [accountItem], itemCount: 1, total: 99 }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const merge = mergeGuestCartAfterLogin("customer-token");

    render(<Cart />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/cart/merge");

    finishMerge();
    await merge;

    expect(await screen.findByRole("heading", { name: "Merged Account Record" })).toBeTruthy();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/cart/merge",
      "/api/cart",
      "/api/cart",
    ]);
    expect(getGuestCart()).toEqual([]);
  });
});
