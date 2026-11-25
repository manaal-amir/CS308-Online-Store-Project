// Product manager invoices page (SCRUM-67 / SCRUM-165): every invoice with its customer,
// total and issue date, with an optional date range.
import { useEffect, useState } from "react";
import { getInvoices } from "../services/invoicesApi.js";
import { expireAuthSession, getAuthSession } from "../utils/authSession.js";
import { formatPrice } from "../utils/productFormat.js";
import "../styles/managerInvoices.css";

// Adds up the totals in whole kuruş so decimals never drift (0.1 + 0.2 problems).
export function sumInvoiceTotals(invoices) {
  const cents = invoices.reduce(
    (sum, invoice) => sum + Math.round(Number(invoice.totalAmount || 0) * 100),
    0,
  );
  return cents / 100;
}

export function customerName(customer) {
  return [customer?.name, customer?.lastname].filter(Boolean).join(" ") || "—";
}

// The API filters by UTC days, so the issue date is shown in UTC too. Otherwise an invoice
// issued late in the evening UTC would show the next day and look outside the chosen range.
export function formatIssuedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

// Returns an error message when the range makes no sense, otherwise "".
export function validateRange(from, to) {
  if (from && to && from > to) return "The start date must be on or before the end date.";
  return "";
}

export function InvoiceTable({ invoices }) {
  return (
    <div className="invoice-table-wrap">
      <table className="invoice-table">
        <thead>
          <tr>
            <th scope="col">Invoice number</th>
            <th scope="col">Order</th>
            <th scope="col">Customer</th>
            <th scope="col">Email</th>
            <th scope="col">Issued (UTC)</th>
            <th scope="col" className="invoice-table-amount">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td>{invoice.invoiceNumber}</td>
              <td>#{invoice.orderId}</td>
              <td>{customerName(invoice.customer)}</td>
              <td>{invoice.customer?.email ?? "—"}</td>
              <td>{formatIssuedDate(invoice.issuedAt)}</td>
              <td className="invoice-table-amount">{formatPrice(invoice.totalAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ManagerInvoices() {
  const [session] = useState(getAuthSession);
  const isManager = session?.user?.role === "PRODUCT_MANAGER";
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [rangeError, setRangeError] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [status, setStatus] = useState(isManager ? "loading" : session ? "forbidden" : "guest");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!session) {
      window.location.replace("/sign-in");
      return undefined;
    }
    if (!isManager) return undefined;

    const controller = new AbortController();

    getInvoices(session.token, { ...range, signal: controller.signal })
      .then((rows) => {
        setInvoices(Array.isArray(rows) ? rows : []);
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        if (error.status === 401) {
          if (expireAuthSession(session.token)) window.location.replace("/sign-in");
          return;
        }
        if (error.status === 403) {
          setStatus("forbidden");
          return;
        }
        setErrorMessage(error.message);
        setStatus("error");
      });

    return () => controller.abort();
  }, [session, isManager, range]);

  function applyRange(event) {
    event.preventDefault();
    const problem = validateRange(fromInput, toInput);
    setRangeError(problem);
    if (problem) return;
    setStatus("loading");
    setRange({ from: fromInput, to: toInput });
  }

  function clearRange() {
    setFromInput("");
    setToInput("");
    setRangeError("");
    setStatus("loading");
    setRange({ from: "", to: "" });
  }

  const filtered = Boolean(range.from || range.to);

  return (
    <section className="manager-invoices">
      <h1>Invoices</h1>

      {status === "forbidden" && (
        <p className="orders-state" role="alert">Only product managers can see the invoices.</p>
      )}
      {status === "guest" && (
        <p className="orders-state" role="status">
          Redirecting to <a href="/sign-in">sign in</a>…
        </p>
      )}

      {isManager && (
        <form className="invoice-filter" onSubmit={applyRange}>
          <label>
            From
            <input
              type="date"
              value={fromInput}
              onChange={(event) => setFromInput(event.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={toInput}
              onChange={(event) => setToInput(event.target.value)}
            />
          </label>
          <button type="submit" className="invoice-filter-apply">Show invoices</button>
          <button
            type="button"
            className="invoice-filter-clear"
            onClick={clearRange}
            disabled={!fromInput && !toInput && !filtered}
          >
            Clear
          </button>
        </form>
      )}
      {rangeError && <p className="orders-state invoice-range-error" role="alert">{rangeError}</p>}

      {status === "loading" && <p className="orders-state" role="status">Loading invoices…</p>}
      {status === "error" && <p className="orders-state" role="alert">{errorMessage}</p>}
      {status === "ready" && invoices.length === 0 && (
        <p className="orders-state">
          {filtered ? "No invoices were issued in this period." : "No invoices have been issued yet."}
        </p>
      )}
      {status === "ready" && invoices.length > 0 && (
        <>
          <p className="invoice-summary" role="status">
            {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"} · total{" "}
            {formatPrice(sumInvoiceTotals(invoices))}
          </p>
          <InvoiceTable invoices={invoices} />
        </>
      )}
    </section>
  );
}
