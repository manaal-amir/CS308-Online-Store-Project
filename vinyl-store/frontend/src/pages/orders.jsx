// Order history page (SCRUM-129): the signed-in customer's orders and their status.
import { useEffect, useState } from "react";
import NavBar from "../components/layout/navBar.jsx";
import Footer from "../components/layout/footer.jsx";
import { getOrders } from "../services/ordersApi.js";
import { expireAuthSession, getAuthSession } from "../utils/authSession.js";
import { formatOrderDate, statusClass, statusLabel } from "../utils/orderStatus.js";
import { formatPrice } from "../utils/productFormat.js";
import "../styles/home.css";
import "../styles/orders.css";

export function StatusBadge({ status }) {
  return (
    <span className={`order-status order-status-${statusClass(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

export function OrderList({ orders }) {
  return (
    <ul className="order-list">
      {orders.map((order) => (
        <li key={order.id}>
          <a className="order-row" href={`/orders/${order.id}`}>
            <span className="order-row-id">Order #{order.id}</span>
            <span className="order-row-date">{formatOrderDate(order.createdAt)}</span>
            <StatusBadge status={order.status} />
            <span className="order-row-total">{formatPrice(order.total)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function Orders() {
  const [session] = useState(getAuthSession);
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState(session ? "loading" : "guest");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!session) {
      // Guests have to sign in before they can see orders (requirement 4).
      window.location.replace("/sign-in");
      return undefined;
    }

    const controller = new AbortController();

    getOrders(session.token, controller.signal)
      .then((items) => {
        setOrders(items);
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        if (error.status === 401) {
          // The token expired or is invalid, so sign in again.
          if (expireAuthSession(session.token)) window.location.replace("/sign-in");
          return;
        }
        setErrorMessage(
          error.status === 403
            ? "Only customer accounts have an order history."
            : error.message,
        );
        setStatus("error");
      });

    return () => controller.abort();
  }, [session]);

  return (
    <div className="vinyl-site orders-site">
      <NavBar />
      <main className="orders-page">
        <h1>My Orders</h1>
        {status === "loading" && (
          <p className="orders-state" role="status">Loading your orders…</p>
        )}
        {status === "guest" && (
          <p className="orders-state" role="status">
            Redirecting to <a href="/sign-in">sign in</a>…
          </p>
        )}
        {status === "error" && (
          <p className="orders-state" role="alert">{errorMessage}</p>
        )}
        {status === "ready" && orders.length === 0 && (
          <p className="orders-state">
            You haven’t placed any orders yet. <a href="/shop">Browse records</a>
          </p>
        )}
        {status === "ready" && orders.length > 0 && <OrderList orders={orders} />}
      </main>
      <Footer />
    </div>
  );
}
