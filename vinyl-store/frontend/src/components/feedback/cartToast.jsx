import "../../styles/cartToast.css";

export default function CartToast({ notification, onDismiss }) {
  if (!notification) return null;

  const hasQuantity = notification.quantity !== null
    && notification.quantity !== undefined
    && Number.isFinite(Number(notification.quantity));

  return (
    <div
      className={`cart-toast${notification.isExiting ? " is-exiting" : ""}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="cart-toast-check" aria-hidden="true">✓</span>
      <div className="cart-toast-copy">
        <p>Added {notification.productName} to your cart.</p>
        {hasQuantity && (
          <span>Cart quantity: {Number(notification.quantity)}</span>
        )}
      </div>
      <button
        type="button"
        className="cart-toast-dismiss"
        aria-label="Dismiss cart notification"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}
