// Tests for the comment form and its "waiting for approval" message (SCRUM-58 / SCRUM-163).
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CommentForm, { MAX_COMMENT_LENGTH, WAITING_MESSAGE } from "./commentForm.jsx";
import { getMyReview, postComment } from "../../services/reviewsApi.js";
import { saveAuthSession } from "../../utils/authSession.js";

vi.mock("../../services/reviewsApi.js", () => ({
  getMyReview: vi.fn(),
  postComment: vi.fn(),
}));

const customer = { token: "cus-token", user: { id: 8, email: "c@example.com", role: "CUSTOMER" } };
const manager = { token: "pm-token", user: { id: 3, email: "pm@example.com", role: "PRODUCT_MANAGER" } };

const canComment = { canReview: true, rating: null, hasPendingComment: false };

function type(text) {
  fireEvent.change(screen.getByLabelText("Your comment"), { target: { value: text } });
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("who sees the form", () => {
  test("a guest is invited to sign in and nothing is requested", () => {
    render(<CommentForm productId={7} />);

    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in");
    expect(screen.queryByLabelText("Your comment")).toBeNull();
    expect(getMyReview).not.toHaveBeenCalled();
  });

  test("staff accounts see nothing and nothing is requested", () => {
    saveAuthSession(manager);
    const { container } = render(<CommentForm productId={7} />);

    expect(container.textContent).toBe("");
    expect(getMyReview).not.toHaveBeenCalled();
  });

  test("a customer who has not received the record cannot comment", async () => {
    saveAuthSession(customer);
    getMyReview.mockResolvedValue({ canReview: false, rating: null, hasPendingComment: false });
    render(<CommentForm productId={7} />);

    expect(await screen.findByText(/once it has been delivered to you/)).toBeTruthy();
    expect(screen.queryByLabelText("Your comment")).toBeNull();
  });

  test("a customer who received the record sees the form", async () => {
    saveAuthSession(customer);
    getMyReview.mockResolvedValue(canComment);
    render(<CommentForm productId={7} />);

    expect(await screen.findByLabelText("Your comment")).toBeTruthy();
    expect(getMyReview).toHaveBeenCalledWith("cus-token", 7, expect.any(AbortSignal));
  });

  test("shows an error when the customer's state cannot be loaded", async () => {
    saveAuthSession(customer);
    getMyReview.mockRejectedValue(new Error("Could not reach the server. Please try again later."));
    render(<CommentForm productId={7} />);

    expect((await screen.findByRole("alert")).textContent).toContain("Could not reach the server");
  });
});

describe("waiting for approval", () => {
  test("a customer with a pending comment sees the waiting message and no form", async () => {
    saveAuthSession(customer);
    getMyReview.mockResolvedValue({ ...canComment, hasPendingComment: true });
    render(<CommentForm productId={7} />);

    expect(await screen.findByText(WAITING_MESSAGE)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(WAITING_MESSAGE);
    expect(screen.queryByLabelText("Your comment")).toBeNull();
  });

  test("sending a comment replaces the form with the waiting message", async () => {
    saveAuthSession(customer);
    getMyReview.mockResolvedValue(canComment);
    postComment.mockResolvedValue({ id: 5, status: "PENDING" });
    render(<CommentForm productId={7} />);
    await screen.findByLabelText("Your comment");

    type("  Lovely record  ");
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }));

    expect((await screen.findByRole("status")).textContent).toBe(WAITING_MESSAGE);
    expect(postComment).toHaveBeenCalledWith("cus-token", 7, "Lovely record");
    expect(screen.queryByLabelText("Your comment")).toBeNull();
  });

  test("a 409 means one is already waiting, so the waiting message is shown", async () => {
    saveAuthSession(customer);
    getMyReview.mockResolvedValue(canComment);
    postComment.mockRejectedValue(
      Object.assign(new Error("You already have a comment waiting for approval on this record"), { status: 409 }),
    );
    render(<CommentForm productId={7} />);
    await screen.findByLabelText("Your comment");

    type("Second try");
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }));

    expect((await screen.findByRole("status")).textContent).toBe(WAITING_MESSAGE);
  });
});

describe("the form", () => {
  async function openForm() {
    saveAuthSession(customer);
    getMyReview.mockResolvedValue(canComment);
    render(<CommentForm productId={7} />);
    await screen.findByLabelText("Your comment");
  }

  test("cannot be sent while empty or only spaces", async () => {
    await openForm();
    const button = screen.getByRole("button", { name: "Post comment" });
    expect(button.disabled).toBe(true);

    type("    ");
    expect(button.disabled).toBe(true);

    type("Nice");
    expect(button.disabled).toBe(false);
  });

  test("shows a character count and limits the length to what the API accepts", async () => {
    await openForm();

    type("Hello");

    expect(screen.getByText(`5 / ${MAX_COMMENT_LENGTH}`)).toBeTruthy();
    expect(screen.getByLabelText("Your comment").getAttribute("maxlength")).toBe(String(MAX_COMMENT_LENGTH));
  });

  test("shows the API message when the comment is refused", async () => {
    await openForm();
    postComment.mockRejectedValue(
      Object.assign(new Error("You can only comment on records that have been delivered to you"), { status: 403 }),
    );

    type("Hello");
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }));

    expect((await screen.findByRole("alert")).textContent).toContain("delivered to you");
    expect(screen.getByLabelText("Your comment").value).toBe("Hello");
  });

  test("is disabled while the comment is being sent, so it cannot be sent twice", async () => {
    await openForm();
    postComment.mockReturnValue(new Promise(() => {}));

    type("Hello");
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Sending…" }).disabled).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Sending…" }));
    expect(postComment).toHaveBeenCalledTimes(1);
  });
});
