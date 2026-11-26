// Tests for the star rating on the product page (SCRUM-57 / SCRUM-162).
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import StarRating from "./starRating.jsx";
import RatingSection, { ratingSummaryText } from "./ratingSection.jsx";
import { getMyReview, rateProduct } from "../../services/reviewsApi.js";
import { saveAuthSession } from "../../utils/authSession.js";

vi.mock("../../services/reviewsApi.js", () => ({
  getMyReview: vi.fn(),
  rateProduct: vi.fn(),
}));

const customer = { token: "cus-token", user: { id: 8, email: "c@example.com", role: "CUSTOMER" } };
const manager = { token: "pm-token", user: { id: 3, email: "pm@example.com", role: "PRODUCT_MANAGER" } };

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("StarRating", () => {
  test("shows five stars as radio buttons with readable labels", () => {
    render(<StarRating value={0} onChange={() => {}} />);

    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("aria-label"))).toEqual([
      "1 star",
      "2 stars",
      "3 stars",
      "4 stars",
      "5 stars",
    ]);
  });

  test("marks the saved rating as checked and fills the stars up to it", () => {
    render(<StarRating value={3} onChange={() => {}} />);

    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("aria-checked"))).toEqual([
      "false", "false", "true", "false", "false",
    ]);
    expect(radios.map((radio) => radio.className.includes("is-filled"))).toEqual([
      true, true, true, false, false,
    ]);
  });

  test("clicking a star reports that number", () => {
    const onChange = vi.fn();
    render(<StarRating value={0} onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: "4 stars" }));

    expect(onChange).toHaveBeenCalledWith(4);
  });

  test("hovering previews the stars without changing the saved value", () => {
    render(<StarRating value={2} onChange={() => {}} />);

    fireEvent.mouseEnter(screen.getByRole("radio", { name: "5 stars" }));
    expect(screen.getAllByRole("radio").filter((r) => r.className.includes("is-filled"))).toHaveLength(5);

    fireEvent.mouseLeave(screen.getByRole("radio", { name: "5 stars" }));
    expect(screen.getAllByRole("radio").filter((r) => r.className.includes("is-filled"))).toHaveLength(2);
  });

  test("cannot be clicked while disabled", () => {
    const onChange = vi.fn();
    render(<StarRating value={0} onChange={onChange} disabled />);

    fireEvent.click(screen.getByRole("radio", { name: "3 stars" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ratingSummaryText", () => {
  test("says there are no ratings when there is no average", () => {
    expect(ratingSummaryText({ averageRating: null, ratingCount: 0 })).toBe("No ratings yet.");
  });

  test("uses singular and plural correctly", () => {
    expect(ratingSummaryText({ averageRating: 4, ratingCount: 1 })).toBe("Average 4 out of 5 from 1 rating.");
    expect(ratingSummaryText({ averageRating: 4.3, ratingCount: 7 })).toBe("Average 4.3 out of 5 from 7 ratings.");
  });
});

describe("RatingSection", () => {
  test("a guest is invited to sign in and nothing is requested", () => {
    render(<RatingSection productId={7} />);

    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in");
    expect(screen.queryByRole("radio")).toBeNull();
    expect(getMyReview).not.toHaveBeenCalled();
  });

  test("staff accounts see no rating section and nothing is requested", () => {
    saveAuthSession(manager);
    const { container } = render(<RatingSection productId={7} />);

    expect(container.textContent).toBe("");
    expect(getMyReview).not.toHaveBeenCalled();
  });

  test("a customer who has not received the record cannot rate it", async () => {
    saveAuthSession(customer);
    getMyReview.mockResolvedValue({ canReview: false, rating: null, hasPendingComment: false });
    render(<RatingSection productId={7} />);

    expect(await screen.findByText(/once it has been delivered to you/)).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(getMyReview).toHaveBeenCalledWith("cus-token", 7, expect.any(AbortSignal));
  });

  test("a customer who received the record sees the stars and their current rating", async () => {
    saveAuthSession(customer);
    getMyReview.mockResolvedValue({ canReview: true, rating: 4, hasPendingComment: false });
    render(<RatingSection productId={7} />);

    expect(await screen.findByText("You rated this 4 out of 5. Click a star to change it.")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "4 stars" }).getAttribute("aria-checked")).toBe("true");
  });

  test("shows the prompt when the customer has not rated yet", async () => {
    saveAuthSession(customer);
    getMyReview.mockResolvedValue({ canReview: true, rating: null, hasPendingComment: false });
    render(<RatingSection productId={7} />);

    expect(await screen.findByText("Click a star to rate this record.")).toBeTruthy();
  });

  test("rating saves immediately and shows the new average", async () => {
    saveAuthSession(customer);
    getMyReview.mockResolvedValue({ canReview: true, rating: null, hasPendingComment: false });
    rateProduct.mockResolvedValue({ productId: 7, value: 5, averageRating: 4.5, ratingCount: 2 });
    render(<RatingSection productId={7} />);
    fireEvent.click(await screen.findByRole("radio", { name: "5 stars" }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Thanks, your rating is saved.");
    expect(status.textContent).toContain("Average 4.5 out of 5 from 2 ratings.");
    expect(rateProduct).toHaveBeenCalledWith("cus-token", 7, 5);
    expect(screen.getByRole("radio", { name: "5 stars" }).getAttribute("aria-checked")).toBe("true");
  });

  test("shows the API message when rating is refused", async () => {
    saveAuthSession(customer);
    getMyReview.mockResolvedValue({ canReview: true, rating: null, hasPendingComment: false });
    rateProduct.mockRejectedValue(
      Object.assign(new Error("You can only rate records that have been delivered to you"), { status: 403 }),
    );
    render(<RatingSection productId={7} />);
    fireEvent.click(await screen.findByRole("radio", { name: "2 stars" }));

    expect((await screen.findByRole("alert")).textContent).toContain("delivered to you");
    expect(screen.getByRole("radio", { name: "2 stars" }).getAttribute("aria-checked")).toBe("false");
  });

  test("shows an error when what the customer can do cannot be loaded", async () => {
    saveAuthSession(customer);
    getMyReview.mockRejectedValue(new Error("Could not reach the server. Please try again later."));
    render(<RatingSection productId={7} />);

    expect((await screen.findByRole("alert")).textContent).toContain("Could not reach the server");
    expect(screen.queryByRole("radio")).toBeNull();
  });

  test("the stars are disabled while a rating is being saved", async () => {
    saveAuthSession(customer);
    getMyReview.mockResolvedValue({ canReview: true, rating: null, hasPendingComment: false });
    rateProduct.mockReturnValue(new Promise(() => {}));
    render(<RatingSection productId={7} />);
    fireEvent.click(await screen.findByRole("radio", { name: "3 stars" }));

    await waitFor(() => expect(screen.getByRole("radio", { name: "3 stars" }).disabled).toBe(true));
  });
});
