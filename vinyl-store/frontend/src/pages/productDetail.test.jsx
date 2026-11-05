// Tests for the product detail page (VS-08/09/10): all fields render and stock is visible.
import { describe, expect, test } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductDetails } from "./productDetail.jsx";
import { displayValue, formatPrice, stockLabel } from "../utils/productFormat.js";

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

  test("out of stock disables the add button", () => {
    const html = render({ ...product, quantity: 0 });
    expect(html).toContain("Out of stock");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Out of Stock/);
  });

  test("in stock keeps the add button enabled", () => {
    expect(render(product)).not.toMatch(/<button[^>]*disabled/);
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
