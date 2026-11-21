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
import { getLocalWishlistIds } from "../../utils/localWishlist.js";

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
  test("heart state follows saved wishlist changes and survives remounting", () => {
    saveAuthSession({
      token: "customer-token",
      user: { id: 8, role: "CUSTOMER" },
    }, true);

    const cards = React.createElement(
      React.Fragment,
      null,
      React.createElement(CatalogCard, { product }),
      React.createElement(CatalogCard, { product }),
    );
    const { unmount } = render(cards);
    const hearts = screen.getAllByRole("button", {
      name: "Add Test Record to wishlist",
    });

    fireEvent.click(hearts[0]);

    const savedHearts = screen.getAllByRole("button", {
      name: "Remove Test Record from wishlist",
    });
    expect(savedHearts).toHaveLength(2);
    expect(savedHearts.every((heart) => heart.getAttribute("aria-pressed") === "true"))
      .toBe(true);
    expect(getLocalWishlistIds()).toEqual(["17"]);

    unmount();
    render(cards);
    expect(screen.getAllByRole("button", {
      name: "Remove Test Record from wishlist",
    })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", {
      name: "Remove Test Record from wishlist",
    })[0]);
    expect(getLocalWishlistIds()).toEqual([]);
    expect(screen.getAllByRole("button", {
      name: "Add Test Record to wishlist",
    })).toHaveLength(2);
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