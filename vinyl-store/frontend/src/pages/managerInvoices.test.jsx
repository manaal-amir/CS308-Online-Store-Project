// Tests for the product manager invoices page (SCRUM-67 / SCRUM-165).
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ManagerInvoices, {
  InvoiceTable,
  customerName,
  formatIssuedDate,
  sumInvoiceTotals,
  validateRange,
} from "./managerInvoices.jsx";
import StaffPanel from "./staffPanel.jsx";
import { getInvoices } from "../services/invoicesApi.js";
import { getAuthSession, saveAuthSession } from "../utils/authSession.js";
import { formatPrice } from "../utils/productFormat.js";

vi.mock("../services/invoicesApi.js", () => ({ getInvoices: vi.fn() }));
vi.mock("../components/layout/navBar.jsx", () => ({ default: () => <nav /> }));
vi.mock("../components/layout/footer.jsx", () => ({ default: () => <footer /> }));

const manager = { token: "pm-token", user: { id: 3, email: "pm@example.com", role: "PRODUCT_MANAGER" } };
const customer = { token: "cus-token", user: { id: 8, email: "c@example.com", role: "CUSTOMER" } };
const sales = { token: "sm-token", user: { id: 4, email: "sm@example.com", role: "SALES_MANAGER" } };

const invoices = [
  {
    id: 2,
    invoiceNumber: "INV-20261121-00002",
    totalAmount: 2800,
    issuedAt: "2026-11-21T10:00:00.000Z",
    orderId: 5,
    customer: { name: "Ada", lastname: "Lovelace", email: "ada@example.com" },
  },
  {
    id: 1,
    invoiceNumber: "INV-20261119-00001",
    totalAmount: 1450.5,
    issuedAt: "2026-11-19T23:08:00.000Z",
    orderId: 4,
    customer: { name: "Sam", lastname: "Kaya", email: "sam@example.com" },
  },
];

function setDates(from, to) {
  fireEvent.change(screen.getByLabelText("From"), { target: { value: from } });
  fireEvent.change(screen.getByLabelText("To"), { target: { value: to } });
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("helpers", () => {
  test("sumInvoiceTotals adds exactly, without decimal drift", () => {
    expect(sumInvoiceTotals([{ totalAmount: 0.1 }, { totalAmount: 0.2 }])).toBe(0.3);
    // 1.15 * 100 and 0.29 * 100 are not whole numbers in floating point, so a sum without
    // rounding would give 1.4399999999999997 here.
    expect(sumInvoiceTotals([{ totalAmount: 1.15 }, { totalAmount: 0.29 }])).toBe(1.44);
    expect(sumInvoiceTotals(invoices)).toBe(4250.5);
    expect(sumInvoiceTotals([])).toBe(0);
  });

  test("customerName joins first and last name and copes with missing parts", () => {
    expect(customerName({ name: "Ada", lastname: "Lovelace" })).toBe("Ada Lovelace");
    expect(customerName({ name: "Ada" })).toBe("Ada");
    expect(customerName(undefined)).toBe("—");
  });

  test("validateRange rejects an end date before the start date", () => {
    expect(validateRange("2026-12-01", "2026-11-01")).toMatch(/start date must be on or before/);
    expect(validateRange("2026-11-01", "2026-11-01")).toBe("");
    expect(validateRange("2026-11-01", "")).toBe("");
    expect(validateRange("", "")).toBe("");
  });

  test("formatIssuedDate shows the UTC day, the same day the API filters by", () => {
    // 23:08 UTC is already the next day in Istanbul, but the API counts it as 19 Nov.
    expect(formatIssuedDate("2026-11-19T23:08:00.000Z")).toBe("19 Nov 2026");
    expect(formatIssuedDate("not a date")).toBe("—");
  });
});

describe("InvoiceTable", () => {
  test("shows the invoice number, order, customer, email, date and total", () => {
    render(<InvoiceTable invoices={invoices} />);

    for (const heading of ["Invoice number", "Order", "Customer", "Email", "Issued (UTC)", "Total"]) {
      expect(screen.getByRole("columnheader", { name: heading })).toBeTruthy();
    }
    const first = screen.getAllByRole("row")[1];
    expect(first.textContent).toContain("INV-20261121-00002");
    expect(first.textContent).toContain("#5");
    expect(first.textContent).toContain("Ada Lovelace");
    expect(first.textContent).toContain("ada@example.com");
    expect(first.textContent).toContain("21 Nov 2026");
    expect(first.textContent).toContain(formatPrice(2800));
  });
});

describe("ManagerInvoices page", () => {
  test("a product manager sees every invoice and the totals", async () => {
    saveAuthSession(manager);
    getInvoices.mockResolvedValue(invoices);
    render(<ManagerInvoices />);

    expect(await screen.findByText("INV-20261121-00002")).toBeTruthy();
    expect(screen.getByText("INV-20261119-00001")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("2 invoices");
    expect(screen.getByRole("status").textContent).toContain(formatPrice(4250.5));
    expect(getInvoices).toHaveBeenCalledWith("pm-token", expect.objectContaining({ from: "", to: "" }));
  });

  test("uses the singular for one invoice", async () => {
    saveAuthSession(manager);
    getInvoices.mockResolvedValue([invoices[0]]);
    render(<ManagerInvoices />);

    expect(await screen.findByText(/^1 invoice ·/)).toBeTruthy();
    expect(screen.queryByText(/invoices ·/)).toBeNull();
  });

  test("says so when no invoices have been issued", async () => {
    saveAuthSession(manager);
    getInvoices.mockResolvedValue([]);
    render(<ManagerInvoices />);

    expect(await screen.findByText("No invoices have been issued yet.")).toBeTruthy();
  });

  test("shows a loading message while waiting", () => {
    saveAuthSession(manager);
    getInvoices.mockReturnValue(new Promise(() => {}));
    render(<ManagerInvoices />);

    expect(screen.getByText("Loading invoices…")).toBeTruthy();
  });

  test("a customer is told only product managers can see invoices, and nothing is requested", async () => {
    saveAuthSession(customer);
    render(<ManagerInvoices />);

    expect((await screen.findByRole("alert")).textContent).toContain("Only product managers");
    expect(getInvoices).not.toHaveBeenCalled();
  });

  test("a sales manager is not shown the product manager page", async () => {
    saveAuthSession(sales);
    render(<ManagerInvoices />);

    expect((await screen.findByRole("alert")).textContent).toContain("Only product managers");
    expect(getInvoices).not.toHaveBeenCalled();
  });

  test("a guest is sent to sign in and nothing is requested", () => {
    render(<ManagerInvoices />);

    expect(screen.getByText(/Redirecting to/)).toBeTruthy();
    expect(getInvoices).not.toHaveBeenCalled();
  });

  test("a 403 from the API shows the forbidden message", async () => {
    saveAuthSession(manager);
    getInvoices.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    render(<ManagerInvoices />);

    expect((await screen.findByRole("alert")).textContent).toContain("Only product managers");
  });

  test("an expired session (401) is cleared", async () => {
    saveAuthSession(manager);
    getInvoices.mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }));
    render(<ManagerInvoices />);

    await waitFor(() => expect(getAuthSession()).toBeNull());
  });

  test("shows other errors", async () => {
    saveAuthSession(manager);
    getInvoices.mockRejectedValue(new Error("Could not reach the server. Please try again later."));
    render(<ManagerInvoices />);

    expect((await screen.findByRole("alert")).textContent).toContain("Could not reach the server");
  });
});

describe("date range", () => {
  async function openPage(rows = invoices) {
    saveAuthSession(manager);
    getInvoices.mockResolvedValue(rows);
    render(<ManagerInvoices />);
    await screen.findByText(rows[0].invoiceNumber);
  }

  test("applying a range asks the API for just those dates", async () => {
    await openPage();

    setDates("2026-11-20", "2026-11-30");
    fireEvent.click(screen.getByRole("button", { name: "Show invoices" }));

    await waitFor(() =>
      expect(getInvoices).toHaveBeenLastCalledWith(
        "pm-token",
        expect.objectContaining({ from: "2026-11-20", to: "2026-11-30" }),
      ),
    );
  });

  test("an end date before the start date shows a message and sends no request", async () => {
    await openPage();
    const callsBefore = getInvoices.mock.calls.length;

    setDates("2026-12-01", "2026-11-01");
    fireEvent.submit(screen.getByRole("button", { name: "Show invoices" }).closest("form"));

    expect((await screen.findByRole("alert")).textContent).toMatch(/start date must be on or before/);
    expect(getInvoices.mock.calls.length).toBe(callsBefore);
    expect(screen.getByText("INV-20261121-00002")).toBeTruthy();
  });

  test("an empty filtered result says no invoices were issued in that period", async () => {
    await openPage();
    getInvoices.mockResolvedValue([]);

    setDates("2026-01-01", "2026-01-31");
    fireEvent.click(screen.getByRole("button", { name: "Show invoices" }));

    expect(await screen.findByText("No invoices were issued in this period.")).toBeTruthy();
  });

  test("Clear removes the dates and shows every invoice again", async () => {
    await openPage();
    setDates("2026-11-20", "2026-11-30");
    fireEvent.click(screen.getByRole("button", { name: "Show invoices" }));
    await waitFor(() => expect(getInvoices).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() =>
      expect(getInvoices).toHaveBeenLastCalledWith("pm-token", expect.objectContaining({ from: "", to: "" })),
    );
    expect(screen.getByLabelText("From").value).toBe("");
    expect(screen.getByLabelText("To").value).toBe("");
  });
});

describe("staff panel", () => {
  test("a product manager has an Invoices tab and it is the current one", () => {
    saveAuthSession(manager);
    getInvoices.mockReturnValue(new Promise(() => {}));
    render(
      <StaffPanel path="/manager/invoices">
        <ManagerInvoices />
      </StaffPanel>,
    );

    const tab = screen.getByRole("link", { name: "Invoices" });
    expect(tab.getAttribute("href")).toBe("/manager/invoices");
    expect(tab.getAttribute("aria-current")).toBe("page");
  });

  test("a sales manager has no Invoices tab", () => {
    saveAuthSession(sales);
    render(<StaffPanel path="/manager" />);

    expect(screen.queryByRole("link", { name: "Invoices" })).toBeNull();
  });
});
