
import React from "react";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Invoice from "./invoice.jsx";

afterEach(() => {
  cleanup();
});

const mockOrder = {
  id: 123,
  invoiceNumber: "INV-123",
  status: "PROCESSING",
  totalPrice: 1450,
  deliveryAddress: "Istanbul, Turkey",
  cardLast4: "4242",
  createdAt: "2026-11-20T12:00:00Z",
  items: [
    {
      productId: 17,
      name: "Test Record",
      quantity: 1,
      unitPrice: 1450,
      lineTotal: 1450,
    },
  ],
};

describe("Invoice page", () => {
  test("shows a message when no order is available", () => {
    render(<Invoice order={null} />);

    expect(
      screen.getByText("No order information is available.")
    ).toBeTruthy();
  });

  test("displays successful order details", () => {
    render(<Invoice order={mockOrder} />);

    expect(screen.getByText("INV-123")).toBeTruthy();
    expect(screen.getByText("#123")).toBeTruthy();
    expect(screen.getByText("PROCESSING")).toBeTruthy();
    expect(screen.getByText("Test Record")).toBeTruthy();
    expect(screen.getByText("Card ending in 4242")).toBeTruthy();
    expect(screen.getByText("Istanbul, Turkey")).toBeTruthy();
  });

  test("does not display full payment card details", () => {
    const { container } = render(<Invoice order={mockOrder} />);

    expect(container.textContent).not.toContain("4242424242424242");
    expect(container.textContent).not.toContain("123456");
  });
});
