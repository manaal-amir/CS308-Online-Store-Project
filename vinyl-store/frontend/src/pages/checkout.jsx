
import { useState } from "react";
import "../styles/checkout.css";
import { validateCheckout } from "../utils/checkoutValidation.js";


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

    function handleChange(event) {
        const { name, value } = event.target;
        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    function handleSubmit(event) {
        event.preventDefault();

        const validationErrors = validateCheckout(form);
        setErrors(validationErrors);

        if (Object.keys(validationErrors).length > 0) {
            return;
        }
        setErrors({
            submit: "Form validated. Payment integration is not available yet.",
        });
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

                        <div className="checkout-summary-placeholder">
                            Order items and totals will appear here
                            after cart integration.
                        </div>
                        
                        {errors.submit && (
                            <p className="checkout-error" role="alert">
                                {errors.submit}
                            </p>
                        )}

                        <button className="checkout-submit" type="submit">
                            Place Order
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
