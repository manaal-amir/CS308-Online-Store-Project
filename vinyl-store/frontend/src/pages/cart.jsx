
import { useEffect, useState } from "react";
import NavBar from "../components/layout/navBar.jsx";
import Footer from "../components/layout/footer.jsx";
import { getCatalogProducts } from "../services/api.js";
import useCart from "../hooks/useCart.js";

import "../styles/home.css";
import "../styles/cart.css";

function formatPrice(value) {
    return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 2,
    }).format(Number(value));
}

export default function Cart() {
    const {
        items: cart,
        loading: cartLoading,
        error: cartError,
        isAuthenticated,
        update,
        remove,
    } = useCart();
    const [products, setProducts] = useState([]);
    const [productError, setProductError] = useState("");
    const [productsLoading, setProductsLoading] = useState(!isAuthenticated);

    useEffect(() => {
        if (isAuthenticated) {
            return undefined;
        }

        const controller = new AbortController();

        async function loadProducts() {
            try {
                const result = await getCatalogProducts(controller.signal);
                setProducts(result.products);
            } catch (err) {
                if (err.name !== "AbortError") {
                    setProductError("Could not load products.");
                }
            } finally {
                if (!controller.signal.aborted) {
                    setProductsLoading(false);
                }
            }
        }

        loadProducts();
        return () => controller.abort();
    }, [isAuthenticated]);

    const cartItems = isAuthenticated
        ? cart.map((item) => ({
            ...item,
            id: item.productId,
            cartQuantity: item.quantity,
            quantity: item.stock,
        }))
        : cart.map((item) => {
            const product = products.find((p) => Number(p.id) === item.productId);

            return product
                ? { ...product, cartQuantity: item.quantity }
                : null;
        }).filter(Boolean);

    const missingItems = isAuthenticated ? [] : cart.filter(
        (item) => !products.some((product) => Number(product.id) === item.productId),
    );

    const subtotal = cartItems.reduce(
        (sum, item) => sum + Number(item.price) * item.cartQuantity,
        0
    );

    async function changeQuantity(product, quantity) {
        try {
            await update(product.id, quantity, Number(product.quantity));
        } catch (err) {
            setProductError(err.message);
        }
    }

    async function removeItem(productId) {
        try {
            await remove(Number(productId));
            setProductError("");
        } catch (err) {
            setProductError(err.message);
        }
    }

    const error = cartError || productError;
    const loading = cartLoading || productsLoading;

    return (
        <div className="vinyl-site">
            <NavBar />

            <main className="cart-page">
                <h1>Your Shopping Cart</h1>

                {error && <p role="alert">{error}</p>}

                {loading ? (
                    <p>Loading cart...</p>
                ) : cart.length === 0 ? (
                    error ? null : (
                        <div className="cart-empty">
                            <p>Your cart is currently empty.</p>
                            <a href="/shop">Continue Shopping</a>
                        </div>
                    )
                ) : (
                    <div className="cart-layout">
                        <div className="cart-items">
                            
{missingItems.map((item) => (
  <article key={item.productId} className="cart-item">
    <div className="cart-item-info">
      <h2>Product unavailable</h2>
      <p>Product ID: {item.productId}</p>
      <p>This product could not be found in the current catalog.</p>
      <p>Saved quantity: {item.quantity}</p>

      <div className="cart-controls">
        <button
          type="button"
          onClick={() => removeItem(item.productId)}
        >
          Remove unavailable item
        </button>
      </div>
    </div>
  </article>
))}

                            {cartItems.map((item) => (
                                <article key={item.id} className="cart-item">
                                    <div className="cart-artwork">
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.name} />
                                        ) : (
                                            <span aria-hidden="true">
                                                {item.name.charAt(0)}
                                            </span>
                                        )}
                                    </div>

                                    <div className="cart-item-info">
                                        <h2>{item.name}</h2>
                                        <p>{item.artist?.name || item.artist || "Various Artists"}</p>
                                        <p>{formatPrice(item.price)}</p>

                                        <div className="cart-controls">
                                            <button
                                                type="button"
                                                aria-label={`Decrease quantity of ${item.name}`}
                                                onClick={() =>
                                                    changeQuantity(item, item.cartQuantity - 1)
                                                }
                                            >
                                                −
                                            </button>

                                            <span>{item.cartQuantity}</span>

                                            <button
                                                type="button"
                                                aria-label={`Increase quantity of ${item.name}`}
                                                disabled={item.cartQuantity >= Number(item.quantity)}
                                                onClick={() =>
                                                    changeQuantity(item, item.cartQuantity + 1)
                                                }
                                            >
                                                +
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => removeItem(item.id)}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>

                        <aside className="cart-summary">
                            <h2>Order Summary</h2>
                            <div className="cart-summary-total">
                                <span>Subtotal</span>
                                <strong>{formatPrice(subtotal)}</strong>
                            </div>
                        </aside>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}