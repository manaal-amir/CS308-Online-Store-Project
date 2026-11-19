import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import Cart from "./cart.jsx";
import { addToGuestCart, resetGuestCartForTests } from "../utils/guestCart.js";

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
});
