
import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import PendingComments from "./pendingComments.jsx";
import { saveAuthSession } from "../utils/authSession.js";

const comment = {
  id: 12,
  productId: 7,
  productName: "Test Record",
  author: { id: 3, name: "Test Customer" },
  content: "Loving this album!",
  status: "PENDING",
  createdAt: "2026-11-27T10:00:00.000Z",
};

function response(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

function signIn(role = "PRODUCT_MANAGER") {
  saveAuthSession({
    token: "test-token",
    user: { id: 1, role },
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe("pending comments manager page", () => {
  test("blocks users who are not product managers", () => {
    signIn("CUSTOMER");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<PendingComments />);

    expect(
      screen.getByRole("alert").textContent
    ).toContain("Only product managers");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("loads pending comments from the API", async () => {
    signIn();

    const fetchMock = vi.fn().mockResolvedValue(
      response([comment])
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<PendingComments />);

    expect(
      await screen.findByText("Loving this album!")
    ).toBeTruthy();

    expect(screen.getByText("Test Record")).toBeTruthy();
    expect(
      screen.getByText("Customer: Test Customer")
    ).toBeTruthy();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/comments/pending",
      expect.objectContaining({
        method: "GET",
        headers: {
          Authorization: "Bearer test-token",
        },
      })
    );
  });

  test.each([
    ["Approve", "APPROVED"],
    ["Reject", "REJECTED"],
  ])("%s reviews a pending comment", async (button, status) => {
    signIn();

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response([comment]))
      .mockResolvedValueOnce(
        response({ ...comment, status })
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<PendingComments />);

    const action = await screen.findByRole("button", {
      name: button,
    });

    fireEvent.click(action);

    await waitFor(() => {
      expect(
        screen.queryByText("Loving this album!")
      ).toBeNull();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/comments/12",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
    );

    expect(
      screen.getByRole("status").textContent
    ).toMatch(/successfully/i);
  });

  test("shows an error without removing the comment", async () => {
    signIn();

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response([comment]))
      .mockResolvedValueOnce(
        response({ error: "Server error" }, 500)
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<PendingComments />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Approve",
      })
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveProperty("textContent", "Server error");

    expect(
      screen.getByText("Loving this album!")
    ).toBeTruthy();
  });
});
