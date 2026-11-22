// Tests for the order detail view and the cancel button (SCRUM-129, SCRUM-134).
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import OrderDetail, { CancelOrderButton, OrderDetails } from "./orderDetail.jsx";
import { cancelOrder, getOrder } from "../services/ordersApi.js";
import { getAuthSession, saveAuthSession } from "../utils/authSession.js";
import { formatPrice } from "../utils/productFormat.js";

vi.mock("../services/ordersApi.js", () => ({ getOrder: vi.fn(), cancelOrder: vi.fn() }));
vi.mock("../components/layout/navBar.jsx", () => ({ default: () => <nav /> }));
vi.mock("../components/layout/footer.jsx", () => ({ default: () => <footer /> }));

const customer = { token: "cus-token", user: { id: 8, email: "c@example.com", role: "CUSTOMER" } };

function makeOrder(overrides = {}) {
  return {
    id: 7,
    status: "PROCESSING",
    createdAt: "2026-11-20T12:00:00.000Z",
    deliveryAddress: "Test Street 1, Istanbul",
    cardLast4: "4242",
    total: 2700,
    items: [
      { productId: 1, name: "Kind of Blue", artist: "Miles Davis", unitPrice: 1450, quantity: 1, lineTotal: 1450 },
      { productId: 2, name: "Blue Train", artist: "John Coltrane", unitPrice: 625, quantity: 2, lineTotal: 1250 },
    ],
    ...overrides,
  };
}

const conflict = (message) => Object.assign(new Error(message), { status: 409 });

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("OrderDetails", () => {
  test("shows the items, total, address and card", () => {
    render(<OrderDetails order={makeOrder()} token="t" onCancelled={() => {}} />);

    expect(screen.getByRole("heading", { name: "Order #7" })).toBeTruthy();
    expect(screen.getByText("Placed on 20 Nov 2026")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Kind of Blue" }).getAttribute("href")).toBe("/product/1");
    expect(screen.getByText("Miles Davis")).toBeTruthy();
    expect(screen.getByText(`2 × ${formatPrice(625)}`)).toBeTruthy();
    expect(screen.getByText(formatPrice(2700))).toBeTruthy();
    expect(screen.getByText("Test Street 1, Istanbul")).toBeTruthy();
    expect(screen.getByText("4242")).toBeTruthy();
  });

  test.each(["IN_TRANSIT", "DELIVERED", "CANCELLED"])(
    "has no cancel button for a %s order",
    (status) => {
      render(<OrderDetails order={makeOrder({ status })} token="t" onCancelled={() => {}} />);

      expect(screen.queryByRole("button", { name: "Cancel order" })).toBeNull();
    },
  );

  test("has a cancel button for a processing order", () => {
    render(<OrderDetails order={makeOrder()} token="t" onCancelled={() => {}} />);

    expect(screen.getByRole("button", { name: "Cancel order" })).toBeTruthy();
  });

  test("shows the refund notice with the card after a cancellation", () => {
    render(
      <OrderDetails
        order={makeOrder({ status: "CANCELLED" })}
        token="t"
        refundedAmount={2700}
        onCancelled={() => {}}
      />,
    );

    const notice = screen.getByRole("status");
    expect(notice.textContent).toContain(formatPrice(2700));
    expect(notice.textContent).toContain("ending 4242");
  });

  test("shows the stale-order message from the page", () => {
    render(
      <OrderDetails
        order={makeOrder({ status: "IN_TRANSIT" })}
        token="t"
        cancelNotice="Only orders that are processing can be cancelled"
        onCancelled={() => {}}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("can be cancelled");
  });
});

describe("CancelOrderButton", () => {
  function setup() {
    const onCancelled = vi.fn();
    const onStale = vi.fn();
    render(
      <CancelOrderButton
        order={makeOrder()}
        token="cus-token"
        onCancelled={onCancelled}
        onStale={onStale}
      />,
    );
    return { onCancelled, onStale };
  }

  test("asks for confirmation before cancelling anything", () => {
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));

    expect(screen.getByText("Cancel this order? The payment will be refunded.")).toBeTruthy();
    expect(cancelOrder).not.toHaveBeenCalled();
  });

  test("Keep order goes back without calling the API", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));

    fireEvent.click(screen.getByRole("button", { name: "Keep order" }));

    expect(screen.getByRole("button", { name: "Cancel order" })).toBeTruthy();
    expect(cancelOrder).not.toHaveBeenCalled();
  });

  test("confirming cancels the order and reports the result", async () => {
    const result = { id: 7, status: "CANCELLED", refundedAmount: 2700 };
    cancelOrder.mockResolvedValue(result);
    const { onCancelled } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));

    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel order" }));

    await waitFor(() => expect(onCancelled).toHaveBeenCalledWith(result));
    expect(cancelOrder).toHaveBeenCalledWith("cus-token", 7);
  });

  test("disables both buttons while the request is running", () => {
    cancelOrder.mockReturnValue(new Promise(() => {}));
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));

    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel order" }));

    expect(screen.getByRole("button", { name: "Cancelling…" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Keep order" }).disabled).toBe(true);
  });

  test("a 409 is handed to the page and not shown twice", async () => {
    cancelOrder.mockRejectedValue(conflict("Only orders that are processing can be cancelled"));
    const { onStale, onCancelled } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));

    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel order" }));

    await waitFor(() =>
      expect(onStale).toHaveBeenCalledWith("Only orders that are processing can be cancelled"),
    );
    expect(onCancelled).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("any other failure is shown next to the button", async () => {
    cancelOrder.mockRejectedValue(new Error("Could not reach the server. Please try again later."));
    const { onStale } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));

    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel order" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Could not reach the server");
    expect(onStale).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel order" })).toBeTruthy();
  });
});

describe("OrderDetail page", () => {
  test("loads the order for the signed-in customer", async () => {
    saveAuthSession(customer);
    getOrder.mockResolvedValue(makeOrder());
    render(<OrderDetail id="7" />);

    expect(await screen.findByRole("heading", { name: "Order #7" })).toBeTruthy();
    expect(getOrder).toHaveBeenCalledWith("cus-token", "7", expect.any(AbortSignal));
    expect(screen.getByRole("link", { name: "← Back to my orders" }).getAttribute("href")).toBe("/orders");
  });

  test("an unknown or someone else's order shows a not-found message", async () => {
    saveAuthSession(customer);
    getOrder.mockRejectedValue(Object.assign(new Error("Order not found"), { status: 404 }));
    render(<OrderDetail id="99" />);

    expect((await screen.findByRole("alert")).textContent).toContain("find that order");
  });

  test("a guest is sent to sign in and nothing is requested", () => {
    render(<OrderDetail id="7" />);

    expect(getOrder).not.toHaveBeenCalled();
  });

  test("an expired session (401) is cleared", async () => {
    saveAuthSession(customer);
    getOrder.mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }));
    render(<OrderDetail id="7" />);

    await waitFor(() => expect(getAuthSession()).toBeNull());
  });

  test("shows other errors", async () => {
    saveAuthSession(customer);
    getOrder.mockRejectedValue(new Error("Order request failed (500)"));
    render(<OrderDetail id="7" />);

    expect((await screen.findByRole("alert")).textContent).toBe("Order request failed (500)");
  });

  test("cancelling updates the status and shows the refund without a reload", async () => {
    saveAuthSession(customer);
    getOrder.mockResolvedValue(makeOrder());
    cancelOrder.mockResolvedValue({ id: 7, status: "CANCELLED", refundedAmount: 2700 });
    render(<OrderDetail id="7" />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel order" }));

    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel order" }));

    expect((await screen.findByRole("status")).textContent).toContain("Order cancelled.");
    expect(screen.getByText("Cancelled")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel order" })).toBeNull();
    expect(getOrder).toHaveBeenCalledTimes(1);
  });

  test("a stale cancel reloads the order, hides the button and keeps the message", async () => {
    saveAuthSession(customer);
    getOrder
      .mockResolvedValueOnce(makeOrder())
      .mockResolvedValueOnce(makeOrder({ status: "IN_TRANSIT" }));
    cancelOrder.mockRejectedValue(
      conflict("Only orders that are processing can be cancelled, this order is IN_TRANSIT"),
    );
    render(<OrderDetail id="7" />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel order" }));

    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel order" }));

    await waitFor(() => expect(getOrder).toHaveBeenCalledTimes(2));
    expect((await screen.findByRole("alert")).textContent).toContain("this order is IN_TRANSIT");
    await waitFor(() => expect(screen.getByText("In transit")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Cancel order" })).toBeNull();
  });
});
