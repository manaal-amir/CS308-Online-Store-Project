
import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Checkout from "./checkout.jsx";
import { getAuthSession } from "../utils/authSession.js";
import { getAuthenticatedCart } from "../services/cartApi.js";

vi.mock("../utils/authSession.js", () => ({
  getAuthSession: vi.fn(),
  clearAuthSession: vi.fn(),
  expireAuthSession: vi.fn(),
  subscribeToAuthSession: vi.fn(() => () => {}),
}));

vi.mock("../services/cartApi.js", () => ({
  getAuthenticatedCart: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

test("checkout displays products from the server cart", async () => {
  getAuthSession.mockReturnValue({ token: "test-token" });

  getAuthenticatedCart.mockResolvedValue({
    items: [
      {
        productId: 17,
        name: "Test Record",
        quantity: 2,
        price: 100,
        lineTotal: 200,
      },
    ],
    itemCount: 2,
    total: 200,
  });

  render(<Checkout />);

  expect(await screen.findByText("Test Record")).toBeTruthy();
  expect(screen.getByText(/2 ×/)).toBeTruthy();
  expect(getAuthenticatedCart).toHaveBeenCalled();
});
