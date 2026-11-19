// Tests for the product detail page (VS-08/09/10): all fields render and stock is visible.
import { afterEach, describe, expect, test } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  cleanup,
  fireEvent,
  render as renderComponent,
  screen,
} from "@testing-library/react";
import { ProductDetails } from "./productDetail.jsx";
import { displayValue, formatPrice, stockLabel } from "../utils/productFormat.js";
import {
  addToGuestCart,
  getGuestCart,
  resetGuestCartForTests,
} from "../utils/guestCart.js";

afterEach(() => {
  cleanup();
  localStorage.clear();
  resetGuestCartForTests();
});

const product = {
  id: 7,
  name: "L.A. Woman",
  model: "180g reissue",
  serialNumber: "VS-LP-007",
  quantity: 8,
  price: 1650,
  distributor: "Elektra Records",
  description: "The final studio album with Jim Morrison.",
  warrantyStatus: "No warranty",
  imageUrl: null,
  category: { name: "Vinyl" },
  artist: { name: "The Doors" },
  genre: { name: "Rock" },
};

const render = (item) => renderToStaticMarkup(<ProductDetails product={item} />);

describe("ProductDetails", () => {
  test("renders every required product field", () => {
    const html = render(product);
    for (const text of [
      "L.A. Woman",
      "180g reissue",
      "VS-LP-007",
      "Elektra Records",
      "The final studio album with Jim Morrison.",
      "No warranty",
      "The Doors",
      "Rock",
      "Vinyl",
    ]) {
      expect(html).toContain(text);
    }
  });

  test("shows the stock quantity", () => {
    expect(render(product)).toContain("8 in stock");
  });

  test("shows a low-stock warning at five or fewer", () => {
    expect(render({ ...product, quantity: 3 })).toContain("Only 3 left in stock");
  });

  test.each([0, -2])("out-of-stock quantity %s disables the add button", (quantity) => {
    const html = render({ ...product, quantity });
    expect(html).toContain("Out of stock");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Out of Stock/);
  });

  test("in stock keeps the add button enabled", () => {
    expect(render(product)).not.toMatch(/class="product-add-button"[^>]*disabled/);
  });

  test("quantity controls stop at available stock and repeated adds stay within stock", () => {
    renderComponent(<ProductDetails product={{ ...product, quantity: 3 }} />);
    const increase = screen.getByRole("button", { name: "Increase quantity" });
    const addButton = screen.getByRole("button", { name: "Add to Cart" });

    fireEvent.click(increase);
    fireEvent.click(increase);

    expect(screen.getByText("3", { selector: ".product-quantity-control span" })).toBeTruthy();
    expect(increase.disabled).toBe(true);

    fireEvent.click(addButton);

    expect(getGuestCart()).toEqual([{ productId: 7, quantity: 3 }]);
    expect(screen.getByRole("button", { name: "Stock Limit Reached" }).disabled).toBe(true);
  });

  test("existing cart quantity reduces the remaining amount available", () => {
    addToGuestCart(7, 2, 3);
    renderComponent(<ProductDetails product={{ ...product, quantity: 3 }} />);

    const increase = screen.getByRole("button", { name: "Increase quantity" });
    expect(increase.disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Add to Cart" }).disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Add to Cart" }));

    expect(getGuestCart()).toEqual([{ productId: 7, quantity: 3 }]);
  });

  test("repeated Add to Cart clicks cannot exceed stock", () => {
    renderComponent(<ProductDetails product={{ ...product, quantity: 2 }} />);
    const addButton = screen.getByRole("button", { name: "Add to Cart" });

    fireEvent.click(addButton);
    fireEvent.click(screen.getByRole("button", { name: "Add to Cart" }));
    fireEvent.click(screen.getByRole("button", { name: "Stock Limit Reached" }));

    expect(getGuestCart()).toEqual([{ productId: 7, quantity: 2 }]);
  });

  test("out-of-stock products disable quantity controls and cannot be added", () => {
    renderComponent(<ProductDetails product={{ ...product, quantity: 0 }} />);

    expect(screen.getByRole("button", { name: "Increase quantity" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Out of Stock" }).disabled).toBe(true);
    expect(getGuestCart()).toEqual([]);
  });

  test("missing fields render a dash instead of undefined", () => {
    const html = render({ ...product, warrantyStatus: undefined, artist: null });
    expect(html).not.toContain("undefined");
    expect(html).toContain("—");
  });

  test("shows release year only when the API provides it", () => {
    expect(render(product)).not.toContain("Release year");
    expect(render({ ...product, releaseYear: 1971 })).toContain("1971");
  });

  test("shows label and release year together under the artist", () => {
    expect(render({ ...product, releaseYear: 1971 })).toContain("Elektra Records · 1971");
  });

  test("shows only the label when there is no release year", () => {
    const html = render(product);
    expect(html).toContain(">Elektra Records<");
    expect(html).not.toContain("·");
  });

  test("renders the cover image when imageUrl is set", () => {
    const html = render({ ...product, imageUrl: "/cover.png" });
    expect(html).toContain('src="/cover.png"');
    expect(html).not.toContain("placeholder-record-disc");
  });

  test("uses a placeholder when there is no cover image", () => {
    expect(render(product)).toContain("placeholder-record-disc");
  });

  test("shows a cart toast with the updated quantity after a successful add", () => {
    const { container } = renderComponent(<ProductDetails product={product} />);

    fireEvent.click(container.querySelector(".product-add-button"));

    expect(screen.getByText("Added L.A. Woman to your cart.")).toBeTruthy();
    expect(screen.getByText("Cart quantity: 1")).toBeTruthy();
    expect(getGuestCart()).toEqual([{ productId: 7, quantity: 1 }]);
  });

  test("preserves the cart error and shows no success toast when adding fails", () => {
    const invalidProduct = { ...product, id: "invalid" };
    const { container } = renderComponent(<ProductDetails product={invalidProduct} />);

    fireEvent.click(container.querySelector(".product-add-button"));

    expect(container.querySelector('[role="alert"]').textContent).toMatch(/Invalid product or quantity/);
    expect(container.querySelector(".cart-toast")).toBeNull();
    expect(getGuestCart()).toEqual([]);
  });
});

describe("productFormat", () => {
  test("stockLabel", () => {
    expect(stockLabel(0)).toBe("Out of stock");
    expect(stockLabel(undefined)).toBe("Out of stock");
    expect(stockLabel(5)).toBe("Only 5 left in stock");
    expect(stockLabel(6)).toBe("6 in stock");
  });

  test("displayValue", () => {
    expect(displayValue(null)).toBe("—");
    expect(displayValue("")).toBe("—");
    expect(displayValue(0)).toBe("0");
  });

  test("formatPrice uses Turkish lira", () => {
    expect(formatPrice(1650)).toContain("1.650");
  });
});
