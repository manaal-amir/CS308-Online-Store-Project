// Regression tests for preview cart blocking and normal API-product cart behavior.
import assert from "node:assert/strict";
import { afterEach, describe, test } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CatalogCard, CatalogPreviewNotice } from "./catalogRecords.jsx";
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
  resetGuestCartForTests();
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
});