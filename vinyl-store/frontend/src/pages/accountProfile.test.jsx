
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Account from "./account.jsx";
import { saveAuthSession } from "../utils/authSession.js";

const profile = {
  id: 8,
  name: "Nora",
  lastname: "Yilmaz",
  email: "nora@example.com",
  homeAddress: "Test Street, Istanbul",
  role: "CUSTOMER",
};

function response(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

function openProfile() {
  window.history.pushState({}, "", "/profile");
  return render(<Account />);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("profile overview API integration", () => {
  test("displays real user information from the backend", async () => {
    saveAuthSession({
      token: "tok",
      user: {
        id: 8,
        email: "member@example.com",
        role: "CUSTOMER",
      },
    });

    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes("/api/users/me")) {
        return response(profile);
      }

      if (String(url).includes("/api/orders")) {
        return response([]);
      }

      return response([]);
    });

    vi.stubGlobal("fetch", fetchMock);
    openProfile();

    expect(await screen.findByText("Test Street, Istanbul")).toBeTruthy();
    expect(screen.getByText("Nora")).toBeTruthy();
    expect(screen.getByText("Yilmaz")).toBeTruthy();
    expect(screen.getByText("nora@example.com")).toBeTruthy();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/users/me"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer tok",
        }),
      })
    );
  });

  test("shows an error when the profile API fails", async () => {
    saveAuthSession({
      token: "tok",
      user: {
        id: 8,
        email: "member@example.com",
        role: "CUSTOMER",
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url).includes("/api/users/me")) {
          return response(
            { error: "Profile unavailable" },
            500
          );
        }

        return response([]);
      })
    );

    openProfile();

    expect(
      await screen.findByText(
        /Could not load your profile: Profile unavailable/
      )
    ).toBeTruthy();

    expect(screen.queryByText("Test Street, Istanbul")).toBeNull();
  });

  test("does not request a profile when signed out", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    openProfile();

    expect(
      screen.getByRole("heading", { name: "Please sign in" })
    ).toBeTruthy();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
