// Tests for the product manager delivery list and status dropdown (SCRUM-132/133).
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Deliveries, { DeliveryTable, StatusControl } from "./deliveries.jsx";
import { getDeliveries } from "../services/deliveriesApi.js";
import { updateOrderStatus } from "../services/ordersApi.js";
import { saveAuthSession } from "../utils/authSession.js";
import { nextStatus } from "../utils/orderStatus.js";

vi.mock("../services/deliveriesApi.js", () => ({ getDeliveries: vi.fn() }));
vi.mock("../services/ordersApi.js", () => ({ updateOrderStatus: vi.fn() }));
vi.mock("../components/layout/navBar.jsx", () => ({ default: () => <nav /> }));
vi.mock("../components/layout/footer.jsx", () => ({ default: () => <footer /> }));

const manager = { token: "mgr-token", user: { id: 2, email: "pm@example.com", role: "PRODUCT_MANAGER" } };
const customer = { token: "cus-token", user: { id: 8, email: "c@example.com", role: "CUSTOMER" } };

function row(overrides = {}) {
  return {
    deliveryId: 4,
    customerId: 8,
    productId: 1,
    productName: "Kind of Blue",
    quantity: 1,
    totalPrice: 1450,
    deliveryAddress: "Test Street 1, Istanbul",
    status: "PROCESSING",
    completed: false,
    createdAt: "2026-11-19T10:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("nextStatus", () => {
  test("only allows forward moves", () => {
    expect(nextStatus("PROCESSING")).toBe("IN_TRANSIT");
    expect(nextStatus("IN_TRANSIT")).toBe("DELIVERED");
    expect(nextStatus("DELIVERED")).toBeNull();
    expect(nextStatus("CANCELLED")).toBeNull();
  });
});

describe("DeliveryTable", () => {
  test("shows the columns the delivery list needs", () => {
    render(<DeliveryTable deliveries={[row()]} token="t" onChanged={() => {}} />);

    for (const heading of ["Delivery ID", "Customer ID", "Product ID", "Product", "Qty", "Total price", "Delivery address", "Status"]) {
      expect(screen.getByRole("columnheader", { name: heading })).toBeTruthy();
    }
    expect(screen.getByText("#4")).toBeTruthy();
    expect(screen.getByText("Kind of Blue")).toBeTruthy();
    expect(screen.getByText("Test Street 1, Istanbul")).toBeTruthy();
  });

  test("shows each row's product ID in the Product ID column (SCRUM-177)", () => {
    const rows = [
      row({ deliveryId: 4, productId: 37, productName: "Kind of Blue" }),
      row({ deliveryId: 4, productId: 52, productName: "Blue Train" }),
    ];
    render(<DeliveryTable deliveries={rows} token="t" onChanged={() => {}} />);

    const headers = screen.getAllByRole("columnheader").map((cell) => cell.textContent);
    const column = headers.indexOf("Product ID");
    expect(column).toBeGreaterThan(-1);

    const bodyRows = screen.getAllByRole("row").slice(1);
    expect(bodyRows.map((tr) => tr.cells[column].textContent)).toEqual(["37", "52"]);
  });
});

describe("StatusControl", () => {
  test("offers only the next allowed status", () => {
    render(<StatusControl delivery={row()} token="t" onChanged={() => {}} />);

    const select = screen.getByLabelText("Update status of order 4");
    const labels = [...select.options].map((option) => option.textContent);
    expect(labels).toEqual(["Update status…", "Mark as In transit"]);
  });

  test("offers Delivered for an in-transit order", () => {
    render(<StatusControl delivery={row({ status: "IN_TRANSIT" })} token="t" onChanged={() => {}} />);

    const select = screen.getByLabelText("Update status of order 4");
    expect([...select.options].map((option) => option.value)).toEqual(["", "DELIVERED"]);
  });

  test.each(["DELIVERED", "CANCELLED"])("has no dropdown for a %s order", (status) => {
    render(<StatusControl delivery={row({ status })} token="t" onChanged={() => {}} />);

    expect(screen.queryByLabelText("Update status of order 4")).toBeNull();
  });

  test("sends the new status and reports the result", async () => {
    updateOrderStatus.mockResolvedValue({ id: 4, status: "IN_TRANSIT" });
    const onChanged = vi.fn();
    render(<StatusControl delivery={row()} token="mgr-token" onChanged={onChanged} />);

    fireEvent.change(screen.getByLabelText("Update status of order 4"), {
      target: { value: "IN_TRANSIT" },
    });

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(4, "IN_TRANSIT"));
    expect(updateOrderStatus).toHaveBeenCalledWith("mgr-token", 4, "IN_TRANSIT");
  });

  test("shows the API message and asks for a reload on a 409", async () => {
    const conflict = Object.assign(new Error("Cannot move order from DELIVERED to DELIVERED."), { status: 409 });
    updateOrderStatus.mockRejectedValue(conflict);
    const onChanged = vi.fn();
    const onStale = vi.fn();
    render(<StatusControl delivery={row({ status: "IN_TRANSIT" })} token="t" onChanged={onChanged} onStale={onStale} />);

    fireEvent.change(screen.getByLabelText("Update status of order 4"), {
      target: { value: "DELIVERED" },
    });

    expect((await screen.findByRole("alert")).textContent).toContain("Cannot move order");
    expect(onStale).toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe("Deliveries page", () => {
  test("a customer is told only product managers can see it", async () => {
    saveAuthSession(customer);
    render(<Deliveries />);

    expect((await screen.findByRole("alert")).textContent).toContain("Only product managers");
    expect(getDeliveries).not.toHaveBeenCalled();
  });

  test("a manager sees the loaded rows", async () => {
    saveAuthSession(manager);
    getDeliveries.mockResolvedValue([row(), row({ deliveryId: 5, productName: "Satch Plays Fats" })]);
    render(<Deliveries />);

    expect(await screen.findByText("Kind of Blue")).toBeTruthy();
    expect(screen.getByText("Satch Plays Fats")).toBeTruthy();
    expect(getDeliveries).toHaveBeenCalledWith("mgr-token", expect.objectContaining({ completed: undefined }));
  });

  test("the Waiting filter asks the API for undelivered orders only", async () => {
    saveAuthSession(manager);
    getDeliveries.mockResolvedValue([row()]);
    render(<Deliveries />);
    await screen.findByText("Kind of Blue");

    fireEvent.click(screen.getByRole("button", { name: "Waiting" }));

    await waitFor(() =>
      expect(getDeliveries).toHaveBeenLastCalledWith("mgr-token", expect.objectContaining({ completed: false })),
    );
  });

  test("shows an empty message when nothing matches", async () => {
    saveAuthSession(manager);
    getDeliveries.mockResolvedValue([]);
    render(<Deliveries />);

    expect(await screen.findByText("No deliveries match this filter.")).toBeTruthy();
  });

  test("a row marked Delivered leaves the Waiting list", async () => {
    saveAuthSession(manager);
    getDeliveries.mockResolvedValue([row({ status: "IN_TRANSIT" })]);
    updateOrderStatus.mockResolvedValue({ id: 4, status: "DELIVERED" });
    render(<Deliveries />);
    await screen.findByText("Kind of Blue");
    fireEvent.click(screen.getByRole("button", { name: "Waiting" }));
    await waitFor(() => expect(getDeliveries).toHaveBeenCalledTimes(2));
    await screen.findByText("Kind of Blue");

    fireEvent.change(screen.getByLabelText("Update status of order 4"), {
      target: { value: "DELIVERED" },
    });

    await waitFor(() => expect(screen.queryByText("Kind of Blue")).toBeNull());
    expect(screen.getByText("No deliveries match this filter.")).toBeTruthy();
  });

  test("under All, every row of the order updates and stays listed", async () => {
    saveAuthSession(manager);
    getDeliveries.mockResolvedValue([
      row({ productId: 1, productName: "Kind of Blue" }),
      row({ productId: 2, productName: "Blue Train" }),
    ]);
    updateOrderStatus.mockResolvedValue({ id: 4, status: "IN_TRANSIT" });
    render(<Deliveries />);
    await screen.findByText("Kind of Blue");

    fireEvent.change(screen.getAllByLabelText("Update status of order 4")[0], {
      target: { value: "IN_TRANSIT" },
    });

    await waitFor(() => expect(screen.getAllByText("In transit")).toHaveLength(2));
    expect(screen.getByText("Blue Train")).toBeTruthy();
  });
});
