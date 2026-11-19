// Product manager delivery list (SCRUM-132): products to be delivered and where to.
import { useEffect, useState } from "react";
import NavBar from "../components/layout/navBar.jsx";
import Footer from "../components/layout/footer.jsx";
import { StatusBadge } from "./orders.jsx";
import { getDeliveries } from "../services/deliveriesApi.js";
import { updateOrderStatus } from "../services/ordersApi.js";
import { nextStatus, statusLabel } from "../utils/orderStatus.js";
import { clearAuthSession, getAuthSession } from "../utils/authSession.js";
import { formatPrice } from "../utils/productFormat.js";
import "../styles/home.css";
import "../styles/orders.css";

const FILTERS = [
  { value: "all", label: "All", completed: undefined },
  { value: "pending", label: "Waiting", completed: false },
  { value: "delivered", label: "Delivered", completed: true },
];

// Badge plus a dropdown with the one allowed next status (SCRUM-133).
// Orders cannot go backwards, so delivered/cancelled rows only show the badge.
export function StatusControl({ delivery, token, onChanged, onStale }) {
  const next = nextStatus(delivery.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(event) {
    const value = event.target.value;
    if (!value) return;
    setSaving(true);
    setError("");
    try {
      const result = await updateOrderStatus(token, delivery.deliveryId, value);
      onChanged(delivery.deliveryId, result.status);
    } catch (err) {
      if (err.status === 409) {
        // The order changed elsewhere: show why and reload the list.
        onStale?.(err.message);
      }
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="delivery-status-cell">
      <StatusBadge status={delivery.status} />
      {next && token && (
        <select
          className="delivery-status-select"
          aria-label={`Update status of order ${delivery.deliveryId}`}
          value=""
          disabled={saving}
          onChange={handleChange}
        >
          <option value="">Update status…</option>
          <option value={next}>Mark as {statusLabel(next)}</option>
        </select>
      )}
      {error && (
        <p className="delivery-status-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function DeliveryTable({ deliveries, token, onChanged, onStale }) {
  return (
    <div className="delivery-table-wrap">
      <table className="delivery-table">
        <thead>
          <tr>
            <th scope="col">Delivery ID</th>
            <th scope="col">Customer ID</th>
            <th scope="col">Product</th>
            <th scope="col">Qty</th>
            <th scope="col">Total price</th>
            <th scope="col">Delivery address</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((row) => (
            <tr key={`${row.deliveryId}-${row.productId}`}>
              <td>#{row.deliveryId}</td>
              <td>{row.customerId}</td>
              <td>{row.productName}</td>
              <td>{row.quantity}</td>
              <td>{formatPrice(row.totalPrice)}</td>
              <td>{row.deliveryAddress}</td>
              <td>
                <StatusControl
                  delivery={row}
                  token={token}
                  onChanged={onChanged}
                  onStale={onStale}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Deliveries() {
  const [session] = useState(getAuthSession);
  const isManager = session?.user?.role === "PRODUCT_MANAGER";
  const [filter, setFilter] = useState("all");
  const [deliveries, setDeliveries] = useState([]);
  const [status, setStatus] = useState(isManager ? "loading" : session ? "forbidden" : "guest");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // One order can have several rows (one per product): update them all.
  function handleChanged(orderId, newStatus) {
    setDeliveries((rows) =>
      rows.map((row) =>
        row.deliveryId === orderId
          ? { ...row, status: newStatus, completed: newStatus === "DELIVERED" }
          : row,
      ),
    );
  }

  useEffect(() => {
    if (!session) {
      window.location.replace("/sign-in");
      return undefined;
    }
    if (!isManager) return undefined;

    const controller = new AbortController();
    const { completed } = FILTERS.find((item) => item.value === filter);

    getDeliveries(session.token, { completed, signal: controller.signal })
      .then((rows) => {
        setDeliveries(rows);
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        if (error.status === 401) {
          clearAuthSession();
          window.location.replace("/sign-in");
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
  }, [session, isManager, filter, reloadKey]);

  return (
    <div className="vinyl-site orders-site">
      <NavBar />
      <main className="orders-page orders-page-wide">
        <h1>Delivery list</h1>
        {status === "forbidden" && (
          <p className="orders-state" role="alert">
            Only product managers can see the delivery list.
          </p>
        )}
        {status === "guest" && (
          <p className="orders-state" role="status">
            Redirecting to <a href="/sign-in">sign in</a>…
          </p>
        )}
        {(status === "loading" || status === "ready" || status === "error") && (
          <div className="delivery-filters" role="group" aria-label="Filter deliveries">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={filter === item.value ? "is-active" : ""}
                aria-pressed={filter === item.value}
                onClick={() => {
                  setStatus("loading");
                  setFilter(item.value);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        {status === "loading" && (
          <p className="orders-state" role="status">Loading deliveries…</p>
        )}
        {status === "error" && (
          <p className="orders-state" role="alert">{errorMessage}</p>
        )}
        {status === "ready" && deliveries.length === 0 && (
          <p className="orders-state">No deliveries match this filter.</p>
        )}
        {status === "ready" && deliveries.length > 0 && (
          <DeliveryTable
            deliveries={deliveries}
            token={session.token}
            onChanged={handleChanged}
            onStale={() => setReloadKey((key) => key + 1)}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
