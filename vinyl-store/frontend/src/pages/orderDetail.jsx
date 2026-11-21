// Order detail view (SCRUM-129): items, totals and delivery address for one order.
import { useEffect, useState } from "react";
import NavBar from "../components/layout/navBar.jsx";
import Footer from "../components/layout/footer.jsx";
import { StatusBadge } from "./orders.jsx";
import { cancelOrder, getOrder } from "../services/ordersApi.js";
import { clearAuthSession, getAuthSession } from "../utils/authSession.js";
import { formatOrderDate } from "../utils/orderStatus.js";
import { displayValue, formatPrice } from "../utils/productFormat.js";
import "../styles/home.css";
import "../styles/orders.css";

// Cancel button for a processing order (SCRUM-134). Asks for confirmation first
// because cancelling gives the stock back and refunds the payment.
export function CancelOrderButton({ order, token, onCancelled, onStale }) {
  const [step, setStep] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function confirmCancel() {
    setStep("submitting");
    setErrorMessage("");

    try {
      const result = await cancelOrder(token, order.id);
      onCancelled(result);
    } catch (error) {
      setStep("idle");
      if (error.status === 409) {
        // The order moved on (shipped, delivered, or already cancelled). The page reloads it
        // and hides this button, so the message is shown by the page, not here.
        onStale?.(error.message);
      } else {
        setErrorMessage(error.message);
      }
    }
  }

  return (
    <div className="order-cancel">
      {step === "idle" && (
        <button
          type="button"
          className="order-cancel-button"
          onClick={() => setStep("confirming")}
        >
          Cancel order
        </button>
      )}
      {step !== "idle" && (
        <div className="order-cancel-confirm" role="group" aria-label="Confirm cancellation">
          <p>Cancel this order? The payment will be refunded.</p>
          <button
            type="button"
            className="order-cancel-button"
            onClick={confirmCancel}
            disabled={step === "submitting"}
          >
            {step === "submitting" ? "Cancelling…" : "Yes, cancel order"}
          </button>
          <button
            type="button"
            className="order-keep-button"
            onClick={() => setStep("idle")}
            disabled={step === "submitting"}
          >
            Keep order
          </button>
        </div>
      )}
      {errorMessage && (
        <p className="order-cancel-error" role="alert">{errorMessage}</p>
      )}
    </div>
  );
}

export function OrderDetails({
  order,
  token,
  refundedAmount,
  cancelNotice,
  onCancelled,
  onStale,
}) {
  return (
    <article className="order-detail">
      <header className="order-detail-header">
        <div>
          <h1>Order #{order.id}</h1>
          <p className="order-detail-date">Placed on {formatOrderDate(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} />
      </header>

      {refundedAmount != null && (
        <p className="order-refund-notice" role="status">
          Order cancelled. {formatPrice(refundedAmount)} will be refunded to your card
          {order.cardLast4 ? ` ending ${order.cardLast4}` : ""}.
        </p>
      )}

      {cancelNotice && (
        <p className="order-cancel-error" role="alert">{cancelNotice}</p>
      )}

      {order.status === "PROCESSING" && token && (
        <CancelOrderButton
          order={order}
          token={token}
          onCancelled={onCancelled}
          onStale={onStale}
        />
      )}

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
  const [refundedAmount, setRefundedAmount] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [cancelNotice, setCancelNotice] = useState("");

  function handleStale(message) {
    setCancelNotice(message);
    setReloadKey((key) => key + 1);
  }

  function handleCancelled(result) {
    setOrder((current) => ({ ...current, status: result.status }));
    setRefundedAmount(result.refundedAmount);
  }

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
  }, [session, id, reloadKey]);

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
        {status === "ready" && (
          <OrderDetails
            order={order}
            token={session.token}
            refundedAmount={refundedAmount}
            cancelNotice={cancelNotice}
            onCancelled={handleCancelled}
            onStale={handleStale}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
