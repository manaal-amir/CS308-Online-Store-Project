// Regression tests for preview cart blocking and normal API-product cart behavior.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
let vite;
let CatalogCard;
let CatalogPreviewNotice;
let addCatalogProductToCart;
let getGuestCart;
let resetGuestCartForTests;

before(async () => {
  vite = await createServer({
    configFile: path.join(root, "vite.config.js"),
    server: { middlewareMode: true },
    appType: "custom",
  });

  ({ CatalogCard, CatalogPreviewNotice } = await vite.ssrLoadModule(
    "/src/components/records/catalogRecords.jsx"
  ));
  ({ addCatalogProductToCart } = await vite.ssrLoadModule(
    "/src/utils/catalogCart.js"
  ));
  ({ getGuestCart, resetGuestCartForTests } = await vite.ssrLoadModule(
    "/src/utils/guestCart.js"
  ));
});

after(async () => {
  await vite?.close();
});

const product = {
  id: 17,
  name: "Test Record",
  category: { name: "Vinyl" },
  genre: { name: "Jazz" },
  artist: { name: "Test Artist" },
  price: 100,
  quantity: 3,
};

test("preview records show an explanation and a disabled Add to Cart button", () => {
  const notice = renderToStaticMarkup(
    React.createElement(CatalogPreviewNotice)
  );
  const card = renderToStaticMarkup(
    React.createElement(CatalogCard, { product, isPreview: true })
  );

  assert.match(notice, /Take a look around! These preview records are just for browsing and can’t be added to your cart/);
  assert.doesNotMatch(notice, /API|unavailable|trouble loading/i);
  assert.match(card, /class="catalog-add-button"[^>]*disabled/);
});

test("preview records cannot change the guest cart, even through the cart handler", () => {
  resetGuestCartForTests();

  const added = addCatalogProductToCart(product, true);

  assert.equal(added, false);
  assert.deepEqual(getGuestCart(), []);
});

test("real API products retain an enabled button and can be added to the guest cart", () => {
  resetGuestCartForTests();
  const card = renderToStaticMarkup(
    React.createElement(CatalogCard, { product, isPreview: false })
  );

  assert.match(card, /class="catalog-add-button"(?![^>]*disabled)/);

  const added = addCatalogProductToCart(product, false);

  assert.equal(added, true);
  assert.deepEqual(getGuestCart(), [{ productId: 17, quantity: 1 }]);
});
