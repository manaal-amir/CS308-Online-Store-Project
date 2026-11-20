
import NavBar from "../components/layout/navBar.jsx";
import Footer from "../components/layout/footer.jsx";

import "../styles/home.css";
import "../styles/invoice.css";

function formatPrice(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function InvoiceLayout({ children }) {
  return (
    <div className="vinyl-site">
      <NavBar />
      {children}
      <Footer />
    </div>
  );
}

export default function Invoice({ order }) {
  if (!order) {
    return (
      <InvoiceLayout>
        <main className="invoice-page">
          <div className="invoice-container">
            <p className="invoice-label">VINYL STORE</p>
            <h1>Order Confirmation</h1>

            <section className="invoice-card">
              <h2>No order information is available.</h2>
              <p>
                Your order details will appear here after
                a successful checkout.
              </p>

              <a href="/shop" className="invoice-shop-button">
                Continue Shopping
              </a>
            </section>
          </div>
        </main>
      </InvoiceLayout>
    );
  }

  return (
    <InvoiceLayout>
      <main className="invoice-page">
        <div className="invoice-container">
          <p className="invoice-label">VINYL STORE</p>

          <h1>Order Confirmation</h1>

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
              <strong>
                {order.invoiceNumber || "Not yet available"}
              </strong>
            </div>

            <div className="invoice-detail">
              <span>Status</span>
              <strong>{order.status || "Not available"}</strong>
            </div>

            <div className="invoice-detail">
              <span>Order Date</span>
              <strong>
                {order.createdAt
                  ? new Date(order.createdAt).toLocaleDateString("tr-TR")
                  : "Not available"}
              </strong>
            </div>
          </section>

          <section className="invoice-card">
            <h2>Purchased Records</h2>

            {Array.isArray(order.items) && order.items.length > 0 ? (
              order.items.map((item, index) => (
                <div
                  className="invoice-item"
                  key={`${item.productId}-${index}`}
                >
                  <div>
                    <strong>{item.name}</strong>
                    <p>
                      {item.quantity} × {formatPrice(item.unitPrice)}
                    </p>
                  </div>

                  <strong>
                    {formatPrice(item.lineTotal)}
                  </strong>
                </div>
              ))
            ) : (
              <p>No product details are available.</p>
            )}

            <div className="invoice-total">
              <span>Total Paid</span>
              <strong>
                {order.totalPrice != null
                  ? formatPrice(order.totalPrice)
                  : "Not available"}
              </strong>
            </div>
          </section>

          <section className="invoice-card">
            <h2>Delivery & Payment</h2>

            <div className="invoice-detail">
              <span>Delivery Address</span>
              <strong>
                {order.deliveryAddress || "Not available"}
              </strong>
            </div>

            <div className="invoice-detail">
              <span>Payment Method</span>
              <strong>
                {order.cardLast4
                  ? `Card ending in ${order.cardLast4}`
                  : "Not available"}
              </strong>
            </div>
          </section>

          <a href="/shop" className="invoice-shop-button">
            Continue Shopping
          </a>
        </div>
      </main>
    </InvoiceLayout>
  );
}
