import { useEffect, useState } from "react";
import NavBar from "../components/layout/navBar.jsx";
import Footer from "../components/layout/footer.jsx";
import { getInvoice } from "../services/invoicesApi.js";
import { getOrder } from "../services/ordersApi.js";
import { expireAuthSession, getAuthSession } from "../utils/authSession.js";
import { statusLabel } from "../utils/orderStatus.js";
import { formatPrice } from "../utils/productFormat.js";

import "../styles/home.css";
import "../styles/invoice.css";

function InvoiceLayout({ children }) {
  return (
    <div className="vinyl-site">
      <NavBar />
      <main className="invoice-page">
        <div className="invoice-container">
          <p className="invoice-label">VINYL STORE</p>
          <h1>Order Confirmation</h1>
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function InvoiceMessage({ title, text, role = "status" }) {
  return (
    <section className="invoice-card" role={role}>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      <a href="/orders" className="invoice-shop-button">
        View my orders
      </a>
    </section>
  );
}

export function InvoiceDetails({ invoice, order }) {
  return (
    <>
      <p className="invoice-subtitle">
        Thank you! Your order has been placed successfully.
      </p>

      <section className="invoice-card">
        <h2>Order Details</h2>

        <div className="invoice-detail">
          <span>Order Number</span>
          <strong>#{order.id}</strong>
        </div>

        <div className="invoice-detail">
          <span>Invoice Number</span>
          <strong>{invoice.invoiceNumber}</strong>
        </div>

        <div className="invoice-detail">
          <span>Status</span>
          <strong>{statusLabel(order.status)}</strong>
        </div>

        <div className="invoice-detail">
          <span>Order Date</span>
          <strong>{new Date(order.createdAt).toLocaleDateString("tr-TR")}</strong>
        </div>
      </section>

      <section className="invoice-card">
        <h2>Purchased Records</h2>

        {invoice.items.map((item, index) => (
          <div className="invoice-item" key={`${item.productName}-${index}`}>
            <div>
              <strong>{item.productName}</strong>
              <p>
                {item.quantity} × {formatPrice(item.unitPrice)}
              </p>
            </div>

            <strong>{formatPrice(item.lineTotal)}</strong>
          </div>
        ))}

        <div className="invoice-total">
          <span>Total Paid</span>
          <strong>{formatPrice(invoice.totalAmount)}</strong>
        </div>
      </section>

      <section className="invoice-card">
        <h2>Delivery & Payment</h2>

        <div className="invoice-detail">
          <span>Delivery Address</span>
          <strong>{invoice.deliveryAddress}</strong>
        </div>

        {order.cardLast4 && (
          <div className="invoice-detail">
            <span>Payment Method</span>
            <strong>Card ending in {order.cardLast4}</strong>
          </div>
        )}
      </section>

      <a href="/shop" className="invoice-shop-button">
        Continue Shopping
      </a>
    </>
  );
}

//loads the invoice and the order from the API, so the page also works after a refresh or later on
export default function Invoice({ orderId }) {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    const session = getAuthSession();
    const returnTo = encodeURIComponent(`/invoice/${orderId}`);

    if (!session?.token) {
      window.location.replace(`/sign-in?returnTo=${returnTo}`);
      return undefined;
    }

    const controller = new AbortController();

    Promise.all([
      getInvoice(session.token, orderId, controller.signal),
      getOrder(session.token, orderId, controller.signal),
    ])
      .then(([invoice, order]) => setState({ status: "ready", invoice, order }))
      .catch((error) => {
        if (error.name === "AbortError") return;

        //an expired login gets a 401, so sign in again and come back here
        if (error.status === 401) {
          if (expireAuthSession(session.token)) window.location.replace(`/sign-in?returnTo=${returnTo}`);
          return;
        }

        setState({
          status: error.status === 404 ? "missing" : "error",
          message: error.message,
        });
      });

    return () => controller.abort();
  }, [orderId]);

  return (
    <InvoiceLayout>
      {state.status === "loading" && <p role="status">Loading your invoice…</p>}
      {state.status === "missing" && (
        <InvoiceMessage
          title="Invoice not found."
          text="This order does not exist or does not belong to your account."
        />
      )}
      {state.status === "error" && (
        <InvoiceMessage title="We could not load your invoice." text={state.message} role="alert" />
      )}
      {state.status === "ready" && <InvoiceDetails invoice={state.invoice} order={state.order} />}
    </InvoiceLayout>
  );
}
