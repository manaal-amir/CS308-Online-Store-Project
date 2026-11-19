// Order detail view (SCRUM-129): items, totals and delivery address for one order.
import { useEffect, useState } from "react";
import NavBar from "../components/layout/navBar.jsx";
import Footer from "../components/layout/footer.jsx";
import { StatusBadge } from "./orders.jsx";
import { getOrder } from "../services/ordersApi.js";
import { clearAuthSession, getAuthSession } from "../utils/authSession.js";
import { formatOrderDate } from "../utils/orderStatus.js";
import { displayValue, formatPrice } from "../utils/productFormat.js";
import "../styles/home.css";
import "../styles/orders.css";

export function OrderDetails({ order }) {
  return (
    <article className="order-detail">
      <header className="order-detail-header">
        <div>
          <h1>Order #{order.id}</h1>
          <p className="order-detail-date">Placed on {formatOrderDate(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} />
      </header>

      <ul className="order-items">
        {order.items.map((item) => (
          <li key={`${item.productId}-${item.unitPrice}`} className="order-item">
            <a href={`/product/${item.productId}`} className="order-item-name">
              {item.name}
            </a>
            {item.artist && <span className="order-item-artist">{item.artist}</span>}
            <span className="order-item-qty">
              {item.quantity} × {formatPrice(item.unitPrice)}
            </span>
            <span className="order-item-total">{formatPrice(item.lineTotal)}</span>
          </li>
        ))}
      </ul>

      <dl className="order-summary">
        <div>
          <dt>Total</dt>
          <dd className="order-summary-total">{formatPrice(order.total)}</dd>
        </div>
        <div>
          <dt>Delivery address</dt>
          <dd>{displayValue(order.deliveryAddress)}</dd>
        </div>
        <div>
          <dt>Paid with card ending</dt>
          <dd>{displayValue(order.cardLast4)}</dd>
        </div>
      </dl>
    </article>
  );
}

export default function OrderDetail({ id }) {
  const [session] = useState(getAuthSession);
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState(session ? "loading" : "guest");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!session) {
      window.location.replace("/sign-in");
      return undefined;
    }

    const controller = new AbortController();

    getOrder(session.token, id, controller.signal)
      .then((found) => {
        setOrder(found);
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        if (error.status === 401) {
          clearAuthSession();
          window.location.replace("/sign-in");
          return;
        }
        if (error.status === 404) {
          setStatus("not-found");
          return;
        }
        setErrorMessage(error.message);
        setStatus("error");
      });

    return () => controller.abort();
  }, [session, id]);

  return (
    <div className="vinyl-site orders-site">
      <NavBar />
      <main className="orders-page">
        <a className="orders-back" href="/orders">← Back to my orders</a>
        {status === "loading" && (
          <p className="orders-state" role="status">Loading order…</p>
        )}
        {status === "not-found" && (
          <p className="orders-state" role="alert">
            We couldn’t find that order. <a href="/orders">See all orders</a>
          </p>
        )}
        {status === "error" && (
          <p className="orders-state" role="alert">{errorMessage}</p>
        )}
        {status === "ready" && <OrderDetails order={order} />}
      </main>
      <Footer />
    </div>
  );
}
