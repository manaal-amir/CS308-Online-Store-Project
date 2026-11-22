import { afterEach, describe, expect, test } from "vitest";
import { clearAuthSession, saveAuthSession } from "./authSession.js";
import {
  getLocalWishlistIds,
  isInLocalWishlist,
  subscribeToLocalWishlist,
  toggleLocalWishlist,
} from "./localWishlist.js";

const firstUser = {
  token: "first-user-token",
  user: { id: 8, role: "CUSTOMER" },
};
const secondUser = {
  token: "second-user-token",
  user: { id: 9, role: "CUSTOMER" },
};

afterEach(() => {
  clearAuthSession();
  localStorage.clear();
  sessionStorage.clear();
});

describe("local wishlist", () => {
  test("adds and removes product IDs and persists them for that user", () => {
    saveAuthSession(firstUser, true);

    expect(toggleLocalWishlist(17)).toBe(true);
    expect(isInLocalWishlist("17")).toBe(true);
    expect(localStorage.getItem("vinyl-wishlist-8")).toBe('["17"]');

    expect(toggleLocalWishlist(17)).toBe(false);
    expect(getLocalWishlistIds()).toEqual([]);
  });

  test("keeps wishlist IDs separate when users switch", () => {
    saveAuthSession(firstUser, true);
    toggleLocalWishlist(17);

    saveAuthSession(secondUser, true);
    expect(getLocalWishlistIds()).toEqual([]);
    toggleLocalWishlist(22);

    saveAuthSession(firstUser, true);
    expect(getLocalWishlistIds()).toEqual(["17"]);
    expect(isInLocalWishlist(22)).toBe(false);

    saveAuthSession(secondUser, true);
    expect(getLocalWishlistIds()).toEqual(["22"]);
    expect(isInLocalWishlist(17)).toBe(false);
  });

  test("notifies same-tab subscribers when the wishlist changes", () => {
    saveAuthSession(firstUser, true);
    const updates = [];
    const unsubscribe = subscribeToLocalWishlist((ids) => updates.push(ids));

    toggleLocalWishlist(17);
    toggleLocalWishlist(22);

    expect(updates).toEqual([["17"], ["22", "17"]]);
    unsubscribe();
  });

  test("does not expose wishlist data without a signed-in user", () => {
    saveAuthSession(firstUser, true);
    toggleLocalWishlist(17);
    clearAuthSession();

    expect(getLocalWishlistIds()).toEqual([]);
    expect(() => toggleLocalWishlist(22)).toThrow("Please sign in");
  });
});
