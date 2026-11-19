import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import CatalogRecords from "../records/catalogRecords.jsx";
import {
  addToGuestCart,
  getGuestCart,
  resetGuestCartForTests,
} from "../../utils/guestCart.js";

const product = {
  id: 17,
  name: "Test Record",
  category: { name: "Vinyl" },
  genre: { name: "Jazz" },
  artist: { name: "Test Artist" },
  price: 100,
  quantity: 5,
};

function mockCatalog(quantity = product.quantity) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => [{ ...product, quantity }],
  }));
}

async function renderCatalog(quantity) {
  mockCatalog(quantity);
  const result = render(<CatalogRecords />);
  await screen.findByRole("button", { name: "Add to Cart" });
  return result;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
  resetGuestCartForTests();
});

describe("cart toast feedback", () => {
  test("shows the product and updated quantity, then dismisses after 2500 ms", async () => {
    await renderCatalog();
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "Add to Cart" }));

    expect(screen.getByText("Added Test Record to your cart.")).toBeTruthy();
    expect(screen.getByText("Cart quantity: 1")).toBeTruthy();
    expect(getGuestCart()).toEqual([{ productId: 17, quantity: 1 }]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2499);
    });
    expect(screen.getByText("Added Test Record to your cart.")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(document.querySelector(".cart-toast")).toBeNull();
  });

  test("repeated successful additions refresh the message and dismissal timer", async () => {
    await renderCatalog();
    vi.useFakeTimers();

    const addButton = screen.getByRole("button", { name: "Add to Cart" });
    fireEvent.click(addButton);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    fireEvent.click(addButton);
    expect(screen.getByText("Cart quantity: 2")).toBeTruthy();
    expect(getGuestCart()).toEqual([{ productId: 17, quantity: 2 }]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2499);
    });
    expect(screen.getByText("Added Test Record to your cart.")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(document.querySelector(".cart-toast")).toBeNull();
  });

  test("does not show success feedback when a cart update fails", async () => {
    addToGuestCart(17, 1, 1);
    const { container } = await renderCatalog(1);

    fireEvent.click(screen.getByRole("button", { name: "Add to Cart" }));

    expect(container.querySelector('[role="alert"]').textContent).toMatch(/Only 1 in stock/);
    expect(container.querySelector(".cart-toast")).toBeNull();
    expect(getGuestCart()).toEqual([{ productId: 17, quantity: 1 }]);
  });

  test("the dismiss control closes the notification", async () => {
    await renderCatalog();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Add to Cart" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss cart notification" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(180);
    });

    expect(document.querySelector(".cart-toast")).toBeNull();
  });
});
