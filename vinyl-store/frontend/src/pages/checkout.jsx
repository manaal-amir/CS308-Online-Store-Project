
import { useEffect, useState } from "react";
import "../styles/checkout.css";
import { validateCheckout } from "../utils/checkoutValidation.js";
import { createOrder } from "../services/api.js";
import { getAuthSession, clearAuthSession, } from "../utils/authSession.js";
import { getAuthenticatedCart } from "../services/cartApi.js";

function formatPrice(value) {
    return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
    }).format(Number(value));
}

export default function Checkout() {
    const [form, setForm] = useState({

        address: "",
        cardHolder: "",
        cardNumber: "",
        expiryMonth: "",
        expiryYear: "",
        cvv: "",
    });

    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderResult, setOrderResult] = useState(null);
    const [cart, setCart] = useState(null);
    const [cartLoading, setCartLoading] = useState(true);
    const [cartError, setCartError] = useState("");

    useEffect(() => {
        const session = getAuthSession();

        function redirectToSignIn() {
            window.location.replace("/sign-in?returnTo=%2Fcheckout");
        }

        // Guests must sign in before opening checkout.
        if (!session?.token) {
            redirectToSignIn();
            return;
        }

        const controller = new AbortController();

        getAuthenticatedCart(session.token, controller.signal)
            .then((data) => {
                if (!Array.isArray(data?.items)) {
                    throw new Error("Invalid cart response.");
                }

                setCart(data);
                setCartError("");
            })
            .catch((error) => {
                if (controller.signal.aborted || error.name === "AbortError") {
                    return;
                }

                // An expired or invalid token receives HTTP 401.
                if (error.status === 401) {
                    clearAuthSession();
                    redirectToSignIn();
                    return;
                }

                setCartError(
                    error.message || "Could not load your cart."
                );
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setCartLoading(false);
                }
            });

        return () => controller.abort();
    }, []);


    function handleChange(event) {
        const { name, value } = event.target;
        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    }


    async function handleSubmit(event) {
        event.preventDefault();

        if (
            isSubmitting ||
            orderResult ||
            cartLoading ||
            cartError ||
            !cart?.items?.length
        ) return;
        const validationErrors = validateCheckout(form);
        setErrors(validationErrors);

        if (Object.keys(validationErrors).length > 0) {
            return;
        }

        const session = getAuthSession();

        if (!session?.token) {
            setErrors({
                submit: "Please sign in before placing your order.",
            });
            return;
        }

        const orderData = {
            cardHolder: form.cardHolder.trim(),
            cardNumber: form.cardNumber.replace(/\s/g, ""),
            expiryMonth: Number(form.expiryMonth),
            expiryYear: Number(form.expiryYear),
            cvv: form.cvv.trim(),
            deliveryAddress: form.address.trim(),
        };

        setIsSubmitting(true);

        try {
            const order = await createOrder(orderData, session.token);

            setOrderResult(order);
            setErrors({});

            // Clear sensitive card details after successful checkout.
            setForm((previous) => ({
                ...previous,
                cardNumber: "",
                cvv: "",
            }));
        } catch (error) {
            if (error.status === 401) {
                clearAuthSession();
                window.location.replace("/sign-in?returnTo=%2Fcheckout");
                return;
            }

            setErrors({
                submit: error.message || "Checkout failed. Please try again.",
            });
        }finally {
            setIsSubmitting(false);
        }
    }




    return (
        <main className="checkout-page">
            <div className="checkout-container">
                <div className="checkout-heading">
                    <p className="checkout-eyebrow">YOUR ORDER</p>
                    <h1>Checkout</h1>
                    <p>One step closer to your next favorite record.</p>
                </div>

                <form className="checkout-layout" onSubmit={handleSubmit}>
                    <div className="checkout-form-section">
                        <section className="checkout-card">
                            <h2>Delivery Information</h2>
                            <p>Where should we send your records?</p>

                            <div className="checkout-field">
                                <label htmlFor="address">
                                    Delivery Address (Optional)
                                </label>
                                <textarea
                                    id="address"
                                    name="address"
                                    value={form.address}
                                    onChange={handleChange}
                                    placeholder="Street address, city, postal code"
                                    rows={3}
                                />
                            </div>
                        </section>

                        <section className="checkout-card">
                            <h2>Payment Information</h2>
                            <p>Enter your payment details below.</p>

                            <div className="checkout-field">
                                <label htmlFor="cardHolder">Cardholder Name</label>
                                <input
                                    id="cardHolder"
                                    name="cardHolder"
                                    value={form.cardHolder}
                                    onChange={handleChange}
                                    autoComplete="cc-name"
                                    placeholder="Name on card"
                                    required
                                />
                                {errors.cardHolder && (
                                    <span className="checkout-error" role="alert">
                                        {errors.cardHolder}
                                    </span>
                                )}
                            </div>

                            <div className="checkout-field">
                                <label htmlFor="cardNumber">Card Number</label>
                                <input
                                    id="cardNumber"
                                    name="cardNumber"
                                    value={form.cardNumber}
                                    onChange={handleChange}
                                    inputMode="numeric"
                                    autoComplete="cc-number"
                                    placeholder="1234 5678 9012 3456"
                                    maxLength={19}
                                    required
                                />
                                {errors.cardNumber && (
                                    <span className="checkout-error" role="alert">
                                        {errors.cardNumber}
                                    </span>
                                )}
                            </div>

                            <div className="checkout-field-row">
                                <div className="checkout-field">
                                    <label htmlFor="expiryMonth">Month</label>
                                    <input
                                        id="expiryMonth"
                                        name="expiryMonth"
                                        value={form.expiryMonth}
                                        onChange={handleChange}
                                        placeholder="MM"
                                        inputMode="numeric"
                                        maxLength={2}
                                        required
                                    />
                                    {errors.expiryMonth && (
                                        <span className="checkout-error" role="alert">
                                            {errors.expiryMonth}
                                        </span>
                                    )}
                                </div>

                                <div className="checkout-field">
                                    <label htmlFor="expiryYear">Year</label>
                                    <input
                                        id="expiryYear"
                                        name="expiryYear"
                                        value={form.expiryYear}
                                        onChange={handleChange}
                                        placeholder="YYYY"
                                        inputMode="numeric"
                                        maxLength={4}
                                        required
                                    />
                                    {errors.expiryYear && (
                                        <span className="checkout-error" role="alert">
                                            {errors.expiryYear}
                                        </span>
                                    )}
                                </div>

                                <div className="checkout-field">
                                    <label htmlFor="cvv">CVV</label>
                                    <input
                                        id="cvv"
                                        name="cvv"
                                        type="password"
                                        value={form.cvv}
                                        onChange={handleChange}
                                        inputMode="numeric"
                                        autoComplete="cc-csc"
                                        placeholder="123"
                                        maxLength={4}
                                        required
                                    />
                                    {errors.cvv && (
                                        <span className="checkout-error" role="alert">
                                            {errors.cvv}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </section>
                    </div>

                    <aside className="checkout-card checkout-summary">
                        <h2>Order Summary</h2>
                        <p>Your selected records.</p>

                        {cartLoading ? (
                            <p>Loading your order...</p>
                        ) : cartError ? (
                            <p className="checkout-error" role="alert">
                                {cartError}
                            </p>
                        ) : !cart?.items?.length ? (
                            <p>Your cart is empty.</p>
                        ) : (
                            <div className="checkout-summary-items">
                                {cart.items.map((item) => (
                                    <div
                                        className="checkout-summary-line"
                                        key={item.productId}
                                    >
                                        <div>
                                            <strong>{item.name}</strong>
                                            <span>
                                                {item.quantity} × {formatPrice(item.price)}
                                            </span>
                                        </div>

                                        <strong>{formatPrice(item.lineTotal)}</strong>
                                    </div>
                                ))}

                                <div className="checkout-summary-total">
                                    <span>Total</span>
                                    <strong>{formatPrice(cart.total)}</strong>
                                </div>
                            </div>
                        )}


                        {errors.submit && (
                            <p className="checkout-error" role="alert">
                                {errors.submit}
                            </p>
                        )}

                        {orderResult && (
                            <div className="checkout-success" role="status">
                                <h3>Order placed successfully!</h3>
                                <p>Order #{orderResult.id}</p>
                                <p>
                                    Total: {Number(orderResult.totalPrice).toFixed(2)}
                                </p>
                                <p>Status: {orderResult.status}</p>
                                {orderResult.invoiceNumber && (
                                    <p>Invoice: {orderResult.invoiceNumber}</p>
                                )}
                            </div>
                        )}


                        <button
                            className="checkout-submit"
                            type="submit"
                            disabled={
                                isSubmitting ||
                                Boolean(orderResult) ||
                                cartLoading ||
                                Boolean(cartError) ||
                                !cart?.items?.length
                            }
                        >
                            {isSubmitting
                                ? "Processing..."
                                : orderResult
                                    ? "Order Placed"
                                    : "Place Order"}
                        </button>

                        <p className="checkout-note">
                            Demo checkout — use test card details only.
                        </p>
                    </aside>
                </form>
            </div>
        </main>
    );
}
