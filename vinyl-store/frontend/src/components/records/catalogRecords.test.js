// Regression tests for preview cart blocking and normal API-product cart behavior.
import assert from "node:assert/strict";
import { afterEach, describe, expect, test, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render, waitFor } from "@testing-library/react";
import CatalogRecords, { CatalogCard, CatalogPreviewNotice } from "./catalogRecords.jsx";
import { addCatalogProductToCart } from "../../utils/catalogCart.js";
import { getGuestCart, resetGuestCartForTests } from "../../utils/guestCart.js";

const product = {
  id: 17,
  name: "Test Record",
  category: { name: "Vinyl" },
  genre: { name: "Jazz" },
  artist: { name: "Test Artist" },
  price: 100,
  quantity: 3,
};

afterEach(() => {
  cleanup();
  resetGuestCartForTests();
  vi.unstubAllGlobals();
});

describe("catalogRecords preview cart blocking", () => {
  test("preview records show an explanation and a disabled Add to Cart button", () => {
    const notice = renderToStaticMarkup(React.createElement(CatalogPreviewNotice));
    const card = renderToStaticMarkup(
      React.createElement(CatalogCard, { product, isPreview: true })
    );

    assert.match(
      notice,
      /Take a look around! These preview records are just for browsing and can’t be added to your cart/
    );
    assert.doesNotMatch(notice, /API|unavailable|trouble loading/i);
    assert.match(card, /class="catalog-add-button"[^>]*disabled/);
  });

  test("preview records cannot change the guest cart, even through the cart handler", () => {
    const added = addCatalogProductToCart(product, true);

    assert.equal(added, false);
    assert.deepEqual(getGuestCart(), []);
  });

  test("real API products retain an enabled button and can be added to the guest cart", () => {
    const card = renderToStaticMarkup(
      React.createElement(CatalogCard, { product, isPreview: false })
    );

    assert.match(card, /class="catalog-add-button"(?![^>]*disabled)/);

    const added = addCatalogProductToCart(product, false);

    assert.equal(added, true);
    assert.deepEqual(getGuestCart(), [{ productId: 17, quantity: 1 }]);
  });

  test.each([0, -2])("out-of-stock products cannot be added through the cart handler (quantity %s)", (quantity) => {
    localStorage.clear();
    resetGuestCartForTests();
    assert.throws(
      () => addCatalogProductToCart({ ...product, quantity }, false),
      /Product is out of stock/,
    );
    assert.deepEqual(getGuestCart(), []);
  });
});

describe("catalogRecords stock handling", () => {
  test("keeps a negative-stock search result visible with an out-of-stock label and disabled button", async () => {
    const searchResult = {
      ...product,
      id: 27,
      name: "Searchable Out of Stock Record",
      quantity: -2,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [searchResult],
    }));

    const { container } = render(
      React.createElement(CatalogRecords, {
        search: "searchable",
        stockStatus: "out-of-stock",
      }),
    );

    await waitFor(() => {
      expect(container.querySelector(".catalog-record")).not.toBeNull();
    });

    expect(container.textContent).toContain("Searchable Out of Stock Record");
    expect(container.querySelector(".catalog-stock").textContent).toBe("Out of stock");
    expect(container.querySelector(".catalog-add-button").disabled).toBe(true);
  });
});