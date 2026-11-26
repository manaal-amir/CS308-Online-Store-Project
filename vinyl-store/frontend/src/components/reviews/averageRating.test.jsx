
import React from "react";
import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import AverageRating from "./averageRating.jsx";

describe("AverageRating", () => {
  test("shows the average rating and count", () => {
    render(
      <AverageRating averageRating={4.5} ratingCount={12} />
    );

    expect(screen.getByText(/4.5 \/ 5/)).toBeTruthy();
    expect(screen.getByText(/12 ratings/)).toBeTruthy();
  });

  test("shows no ratings when count is zero", () => {
    render(
      <AverageRating averageRating={0} ratingCount={0} />
    );

    expect(screen.getByText("No ratings yet")).toBeTruthy();
  });

  test("does not invent ratings when API fields are missing", () => {
    const { container } = render(<AverageRating />);

    expect(container.textContent).toBe("");
  });
});
