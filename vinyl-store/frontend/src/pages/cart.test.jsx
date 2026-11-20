import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Cart from "./cart.jsx";
import { addToGuestCart, resetGuestCartForTests } from "../utils/guestCart.js";
import { saveAuthSession } from "../utils/authSession.js";
import { getCheckoutDestination } from "../utils/checkoutNavigation.js";

const product = {
  id: 17,
  name: "Test Record",
  quantity: 3,
  price: 100,
  artist: { name: "Test Artist" },
};

function mockProductsApi() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [product],
    })
  );
}

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
});


describe("checkout navigation", () => {
  test("guest checkout sends the customer to sign-in", async () => {
    addToGuestCart(product.id, 1, product.quantity);
    mockProductsApi();

    render(<Cart />);

    const checkoutButton = await screen.findByRole("button", {
      name: "Proceed to Checkout",
    });

    expect(checkoutButton.disabled).toBe(false);
    expect(getCheckoutDestination()).toBe(
      "/sign-in?returnTo=%2Fcheckout"
    );
  });

  test("logged-in customers can proceed to checkout", async () => {
    saveAuthSession({
      token: "test-token",
      user: { id: 1, role: "CUSTOMER" },
    });

    expect(getCheckoutDestination()).toBe("/checkout");

    addToGuestCart(product.id, 1, product.quantity);
    mockProductsApi();

    render(<Cart />);

    const checkoutButton = await screen.findByRole("button", {
      name: "Proceed to Checkout",
    });

    expect(checkoutButton.disabled).toBe(false);
  });
});

