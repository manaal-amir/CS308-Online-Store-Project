import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import Account from "./account.jsx";
import { addToGuestCart, getGuestCart, resetGuestCartForTests } from "../utils/guestCart.js";
import { getAuthSession, saveAuthSession } from "../utils/authSession.js";
import { toggleLocalWishlist } from "../utils/localWishlist.js";
import { formatPrice } from "../utils/productFormat.js";

const authenticated = {
  token: "jwt-test-token",
  user: { id: 8, email: "member@example.com", role: "CUSTOMER" },
};

function response(data, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
  };
}

function openSignIn() {
  window.history.pushState({}, "", "/sign-in");
  return render(<Account />);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
  resetGuestCartForTests();
  window.history.pushState({}, "", "/");
});

describe("account sign-in", () => {
  test("authenticates through the API, stores the session, and opens the profile", async () => {
    const fetchMock = vi.fn((url) =>
      Promise.resolve(response(url === "/api/orders" ? [] : authenticated)),
    );
    vi.stubGlobal("fetch", fetchMock);
    openSignIn();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "  member@example.com " },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery" },
    });
    fireEvent.click(screen.getByLabelText("Remember me"));
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await screen.findByRole("heading", { name: "Profile overview" });
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/auth/login"),
    ).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "member@example.com",
        password: "correct horse battery",
      }),
    });
    expect(getAuthSession()).toEqual(authenticated);
    expect(localStorage.getItem("vinyl-store-auth-session")).toBeTruthy();
    expect(sessionStorage.getItem("vinyl-store-auth-session")).toBeNull();
    expect(screen.getAllByText("member@example.com").length).toBeGreaterThan(0);
    expect(window.location.pathname).toBe("/profile");
  });

  test("keeps a failed login on the form and does not create a session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      response({ error: "Invalid credentials" }, false, 401),
    ));
    openSignIn();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "member@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Invalid credentials")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log in" })).toBeTruthy();
    expect(getAuthSession()).toBeNull();
  });

  test("merges the guest cart with the authenticated user account", async () => {
    addToGuestCart(3, 2, 5);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(authenticated))
      .mockResolvedValueOnce(response({ adjustments: [] }));
    vi.stubGlobal("fetch", fetchMock);
    openSignIn();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "member@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]).toEqual([
      "/api/cart/merge",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer jwt-test-token",
        },
        body: JSON.stringify({ items: [{ productId: 3, quantity: 2 }] }),
      },
    ]);
    expect(getGuestCart()).toEqual([]);
  });

  test("logout clears the stored authentication session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(authenticated)));
    openSignIn();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "member@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await screen.findByRole("heading", { name: "Profile overview" });

    fireEvent.click(screen.getByRole("link", { name: /Log Out/ }));

    expect(await screen.findByRole("button", { name: "Log in" })).toBeTruthy();
    expect(getAuthSession()).toBeNull();
    expect(window.location.pathname).toBe("/sign-in");
  });
});

describe("account wishlist", () => {
  const savedProduct = {
    id: 17,
    name: "Test Record",
    artist: { name: "Test Artist" },
    price: 1234.5,
    imageUrl: null,
  };

  test("loads matching product data and current price from a products object response", async () => {
    saveAuthSession(authenticated, true);
    toggleLocalWishlist(savedProduct.id);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      response({ products: [savedProduct] }),
    ));
    window.history.pushState({}, "", "/wishlist");

    render(<Account />);

    expect(await screen.findByRole("heading", { name: "Test Record" })).toBeTruthy();
    expect(screen.getByText("Test Artist")).toBeTruthy();
    expect(screen.getByText(formatPrice(savedProduct.price))).toBeTruthy();
    expect(screen.getByRole("link", { name: "View Product" }).getAttribute("href"))
      .toBe("/product/17");
    expect(document.querySelector(".record-artwork")).toBeTruthy();
  });

  test("shows the empty wishlist for a signed-in user with no saved products", async () => {
    saveAuthSession(authenticated, true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ products: [] })));
    window.history.pushState({}, "", "/wishlist");

    render(<Account />);

    expect(await screen.findByRole("heading", { name: "Your wishlist is waiting." }))
      .toBeTruthy();
  });

  test("reports product API failures instead of showing invented wishlist data", async () => {
    saveAuthSession(authenticated, true);
    toggleLocalWishlist(savedProduct.id);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Catalog unavailable")));
    window.history.pushState({}, "", "/wishlist");

    render(<Account />);

    expect((await screen.findByRole("alert")).textContent)
      .toContain("Could not load your wishlist: Catalog unavailable");
  });
});

describe("account settings profile data", () => {
  test("shows signed-in user information instead of fake profile details", () => {
    saveAuthSession({
      token: "test-token",
      user: {
        id: 8,
        name: "Nora",
        lastname: "Yilmaz",
        email: "nora@example.com",
        homeAddress: "Test Street",
        role: "CUSTOMER",
      },
    });

    window.history.pushState({}, "", "/account-settings");
    render(<Account />);

    expect(screen.getByLabelText("First name").value).toBe("Nora");
    expect(screen.getByLabelText("Last name").value).toBe("Yilmaz");
    expect(screen.getByLabelText("Email address").value).toBe("nora@example.com");
    expect(screen.getByLabelText("Home address").value).toBe("Test Street");

    expect(screen.queryByDisplayValue("Jamie")).toBeNull();
    expect(screen.queryByDisplayValue("Laurent")).toBeNull();
    expect(screen.queryByText("JL")).toBeNull();
  });

  test("does not show account settings when signed out", () => {
    window.history.pushState({}, "", "/account-settings");
    render(<Account />);

    expect(
      screen.getByRole("heading", { name: "Please sign in" })
    ).toBeTruthy();

    expect(screen.queryByLabelText("First name")).toBeNull();
    expect(screen.queryByLabelText("Email address")).toBeNull();
  });
});
