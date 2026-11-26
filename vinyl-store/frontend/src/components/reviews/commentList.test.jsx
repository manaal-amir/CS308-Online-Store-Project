// Tests for the approved comments list (SCRUM-60 / SCRUM-164).
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ApprovedComments, { CommentList } from "./commentList.jsx";
import { getApprovedComments } from "../../services/reviewsApi.js";

vi.mock("../../services/reviewsApi.js", () => ({ getApprovedComments: vi.fn() }));

const comments = [
  { id: 2, productId: 7, content: "Warm sound.\nLovely strings.", createdAt: "2026-11-21T12:00:00.000Z", authorName: "Ada L." },
  { id: 1, productId: 7, content: "Worth every lira.", createdAt: "2026-11-20T12:00:00.000Z", authorName: "Sam K." },
];

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("CommentList", () => {
  test("shows each comment with its author, date and text in the order given", () => {
    render(<CommentList comments={comments} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("Ada L.");
    expect(items[0].textContent).toContain("21 Nov 2026");
    expect(items[0].textContent).toContain("Warm sound.");
    expect(items[1].textContent).toContain("Sam K.");
  });

  test("shows comment text as plain text, never as HTML", () => {
    const risky = [{ id: 9, content: "<img src=x onerror=alert(1)> hi", createdAt: "2026-11-20T12:00:00.000Z", authorName: "Eve M." }];
    const { container } = render(<CommentList comments={risky} />);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)> hi")).toBeTruthy();
  });
});

describe("ApprovedComments", () => {
  test("loads the approved comments for the product and shows how many there are", async () => {
    getApprovedComments.mockResolvedValue(comments);
    render(<ApprovedComments productId={7} />);

    expect(await screen.findByText("Ada L.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Comments (2)" })).toBeTruthy();
    expect(getApprovedComments).toHaveBeenCalledWith(7, expect.any(AbortSignal));
  });

  test("shows a loading message while waiting", () => {
    getApprovedComments.mockReturnValue(new Promise(() => {}));
    render(<ApprovedComments productId={7} />);

    expect(screen.getByText("Loading comments…")).toBeTruthy();
  });

  test("says so when there are no approved comments", async () => {
    getApprovedComments.mockResolvedValue([]);
    render(<ApprovedComments productId={7} />);

    expect(await screen.findByText("No comments yet.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Comments" })).toBeTruthy();
  });

  test("shows an error when the comments cannot be loaded", async () => {
    getApprovedComments.mockRejectedValue(new Error("Could not reach the server. Please try again later."));
    render(<ApprovedComments productId={7} />);

    expect((await screen.findByRole("alert")).textContent).toContain("Could not reach the server");
  });

  test("treats an unexpected response as no comments", async () => {
    getApprovedComments.mockResolvedValue({ unexpected: true });
    render(<ApprovedComments productId={7} />);

    expect(await screen.findByText("No comments yet.")).toBeTruthy();
  });

  test("needs no sign-in: the list is requested without any session", async () => {
    getApprovedComments.mockResolvedValue(comments);
    sessionStorage.clear();
    localStorage.clear();
    render(<ApprovedComments productId={7} />);

    await screen.findByText("Ada L.");
    expect(getApprovedComments.mock.calls[0]).toHaveLength(2);
  });
});
