// Regression tests for preview cart blocking and normal API-product cart behavior.
import assert from "node:assert/strict";
import { afterEach, describe, expect, test, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import CatalogRecords, { CatalogCard, CatalogPreviewNotice } from "./catalogRecords.jsx";
import Shop from "../../pages/shop.jsx";
import { catalogPreview } from "../../data/catalogPreview.js";
import { addCatalogProductToCart } from "../../utils/catalogCart.js";
import { getGuestCart, resetGuestCartForTests } from "../../utils/guestCart.js";
import { saveAuthSession } from "../../utils/authSession.js";


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
  localStorage.clear();
  sessionStorage.clear();
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

  test("product cards display the average rating returned by the API", () => {
    const ratedProduct = {
      ...product,
      averageRating: 4.2,
      ratingCount: 8,
    };

    const card = renderToStaticMarkup(
      React.createElement(CatalogCard, {
        product: ratedProduct,
        isPreview: false,
      })
    );

    assert.match(card, /4\.2 \/ 5 \(8 ratings\)/);
    assert.match(card, /Average rating 4\.2 out of 5, from 8 ratings/);
  });

  test("signed-in catalog additions use the account cart and report its returned quantity", async () => {
    saveAuthSession({
      token: "customer-token",
      user: { id: 8, role: "CUSTOMER" },
    });
    const cartItem = {
      productId: product.id,
      name: product.name,
      artist: "Test Artist",
      imageUrl: null,
      price: product.price,
      quantity: 1,
      stock: product.quantity,
      lineTotal: product.price,
    };

    let itemAdded = false;

    const fetchMock = vi.fn(async (url, options = {}) => {
      const method = options.method || "GET";

      if (url === "/api/wishlist" && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [] }),
        };
      }

      if (url === "/api/cart" && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: itemAdded ? [cartItem] : [],
            itemCount: itemAdded ? 1 : 0,
            total: itemAdded ? product.price : 0,
          }),
        };
      }

      if (url === "/api/cart/items" && method === "POST") {
        itemAdded = true;

        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [cartItem],
            itemCount: 1,
            total: product.price,
          }),
        };
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    const onCartAdded = vi.fn();
    render(React.createElement(CatalogCard, { product, onCartAdded }));

    const addButton = await screen.findByRole("button", { name: "Add to Cart" });
    await waitFor(() => expect(addButton.disabled).toBe(false));
    fireEvent.click(addButton);

    await waitFor(() => expect(onCartAdded).toHaveBeenCalledWith(cartItem));
    expect(
      fetchMock.mock.calls
        .map(([url]) => url)
        .filter((url) => url.startsWith("/api/cart"))
    ).toEqual([
      "/api/cart",
      "/api/cart/items",
      "/api/cart",
      "/api/cart",
    ]);
    expect(getGuestCart()).toEqual([]);
  });

  test("catalog add button disables when the product stock is already in the cart", () => {
    localStorage.clear();
    resetGuestCartForTests();
    addCatalogProductToCart(product, false);
    addCatalogProductToCart(product, false);
    addCatalogProductToCart(product, false);

    const { container } = render(
      React.createElement(CatalogCard, { product, isPreview: false }),
    );

    expect(container.querySelector(".catalog-add-button").disabled).toBe(true);
    expect(container.querySelector(".catalog-add-button").textContent).toBe("Stock Limit Reached");
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


describe("catalog wishlist controls", () => {
  test("adds and removes wishlist items through the API and restores saved state", async () => {
    saveAuthSession({
      token: "customer-token",
      user: { id: 8, role: "CUSTOMER" },
    }, true);

    let isSaved = false;

    const fetchMock = vi.fn(async (url, options = {}) => {
      const method = options.method || "GET";

      if (url.startsWith("/api/products")) {
        return {
          ok: true,
          status: 200,
          json: async () => [product],
        };
      }

      if (url === "/api/cart") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [],
            itemCount: 0,
            total: 0,
          }),
        };
      }

      if (url === "/api/wishlist" && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: isSaved ? [{ productId: 17 }] : [],
          }),
        };
      }

      if (url === "/api/wishlist/17" && method === "POST") {
        isSaved = true;
        return {
          ok: true,
          status: 201,
          json: async () => ({ productId: 17, added: true }),
        };
      }

      if (url === "/api/wishlist/17" && method === "DELETE") {
        isSaved = false;
        return {
          ok: true,
          status: 200,
          json: async () => ({ productId: 17, removed: true }),
        };
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(
      React.createElement(CatalogRecords)
    );

    const addHeart = await screen.findByRole("button", {
      name: "Add Test Record to wishlist",
    });

    await waitFor(() => expect(addHeart.disabled).toBe(false));

    fireEvent.click(addHeart);

    expect(await screen.findByRole("button", {
      name: "Remove Test Record from wishlist",
    })).toBeTruthy();

    expect(fetchMock.mock.calls.some(
      ([url, options]) =>
        url === "/api/wishlist/17" && options.method === "POST"
    )).toBe(true);

    unmount();

    render(React.createElement(CatalogRecords));

    const removeHeart = await screen.findByRole("button", {
      name: "Remove Test Record from wishlist",
    });

    await waitFor(() => expect(removeHeart.disabled).toBe(false));

    fireEvent.click(removeHeart);

    expect(await screen.findByRole("button", {
      name: "Add Test Record to wishlist",
    })).toBeTruthy();

    expect(fetchMock.mock.calls.some(
      ([url, options]) =>
        url === "/api/wishlist/17" && options.method === "DELETE"
    )).toBe(true);

    const wishlistLoads = fetchMock.mock.calls.filter(
      ([url, options]) =>
        url === "/api/wishlist" && (options.method || "GET") === "GET"
    );

    expect(wishlistLoads).toHaveLength(2);
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

describe("catalog popularity sorting", () => {
  const namesIn = (container) =>
    [...container.querySelectorAll(".catalog-record-info p")].map((node) => node.textContent);

  test("shows Popularity enabled and omits the unsupported Featured sort", () => {
    const markup = renderToStaticMarkup(React.createElement(Shop));
    const document = new DOMParser().parseFromString(markup, "text/html");
    const popularityOption = document.querySelector(
      '#record-sort option[value="popularity"]',
    );
    const featuredOption = document.querySelector(
      '#record-sort option[value="featured"]',
    );
    const newestOption = document.querySelector(
      '#record-sort option[value="newest"]',
    );

    assert.ok(popularityOption);
    assert.equal(popularityOption.disabled, false);
    assert.equal(featuredOption, null);
    assert.equal(newestOption.selected, true);
  });

  test("requests backend popularity order and switches to and from local sorting", async () => {
    const backendOrder = [
      { ...product, id: 21, name: "Backend First", price: 200 },
      { ...product, id: 22, name: "Backend Second", price: 100 },
    ];
    const unsortedProducts = [
      { ...product, id: 23, name: "Zeta Record", price: 200 },
      { ...product, id: 24, name: "Alpha Record", price: 100 },
    ];
    const fetchMock = vi.fn((url) => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => (
        new URL(url, window.location.origin).searchParams.get("sort") === "popularity"
          ? backendOrder
          : unsortedProducts
      ),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(React.createElement(Shop));
    const sortSelect = container.querySelector("#record-sort");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(namesIn(container)).toEqual(["Zeta Record", "Alpha Record"]));

    fireEvent.change(sortSelect, { target: { value: "popularity" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(namesIn(container)).toEqual(["Backend First", "Backend Second"]));
    expect(new URL(fetchMock.mock.calls[1][0], window.location.origin).searchParams.get("sort"))
      .toBe("popularity");

    fireEvent.change(sortSelect, { target: { value: "price-low" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(namesIn(container)).toEqual(["Alpha Record", "Zeta Record"]));
    expect(new URL(fetchMock.mock.calls[2][0], window.location.origin).searchParams.has("sort"))
      .toBe(false);

    fireEvent.change(sortSelect, { target: { value: "name" } });
    expect(namesIn(container)).toEqual(["Alpha Record", "Zeta Record"]);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    fireEvent.change(sortSelect, { target: { value: "popularity" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(namesIn(container)).toEqual(["Backend First", "Backend Second"]));
    expect(new URL(fetchMock.mock.calls[3][0], window.location.origin).searchParams.get("sort"))
      .toBe("popularity");
  });

  test("ignores an aborted popularity response after a newer local sort request", async () => {
    const stalePopularityProducts = [
      { ...product, id: 31, name: "Stale First", price: 200 },
      { ...product, id: 32, name: "Stale Second", price: 100 },
    ];
    const latestProducts = [
      { ...product, id: 33, name: "Latest Expensive", price: 200 },
      { ...product, id: 34, name: "Latest Cheap", price: 100 },
    ];
    let resolveStaleRequest;
    const fetchMock = vi.fn((url) => {
      if (new URL(url, window.location.origin).searchParams.has("sort")) {
        return new Promise((resolve) => {
          resolveStaleRequest = resolve;
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => latestProducts,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container, rerender } = render(
      React.createElement(CatalogRecords, { sort: "popularity" }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender(React.createElement(CatalogRecords, { sort: "price-low" }));
    await waitFor(() => expect(namesIn(container)).toEqual(["Latest Cheap", "Latest Expensive"]));

    await act(async () => {
      resolveStaleRequest({
        ok: true,
        status: 200,
        json: async () => stalePopularityProducts,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(namesIn(container)).toEqual(["Latest Cheap", "Latest Expensive"]);
  });

  test("keeps spreadsheet preview order when the popularity request falls back", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("API unavailable")));

    const { container } = render(
      React.createElement(CatalogRecords, { sort: "popularity" }),
    );

    await waitFor(() => {
      expect(container.querySelector(".catalog-preview-note")).not.toBeNull();
    });
    expect(namesIn(container)).toEqual(catalogPreview.map(({ name }) => name));
  });
});