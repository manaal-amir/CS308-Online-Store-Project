// Product detail page (VS-08/09/10): shows every product field and the stock quantity.
import { useEffect, useState } from "react";
import NavBar from "../components/layout/navBar.jsx";
import Footer from "../components/layout/footer.jsx";
import { getProductById } from "../services/api.js";
import {
  addToGuestCart,
  getGuestCart,
  subscribeToGuestCart,
} from "../utils/guestCart.js";
import {
  displayValue,
  formatPrice,
  relationName,
  stockLabel,
} from "../utils/productFormat.js";
import "../styles/home.css";
import "../styles/catalog.css";
import "../styles/product.css";

export function ProductDetails({ product }) {
  const [cartMessage, setCartMessage] = useState("");
  const [cartError, setCartError] = useState("");
  const [cart, setCart] = useState(getGuestCart);
  const [quantity, setQuantity] = useState(1);

  const artist = relationName(product.artist);
  const genre = relationName(product.genre);
  const category = relationName(product.category);
  const stock = Number(product.quantity);
  const inStock = Number.isInteger(stock) && stock > 0;
  const cartQuantity = cart.find((item) => item.productId === Number(product.id))?.quantity || 0;
  const available = inStock ? Math.max(0, stock - cartQuantity) : 0;
  const selectedQuantity = available > 0 ? Math.min(quantity, available) : 1;

  useEffect(() => subscribeToGuestCart(setCart), []);

  // The API does not return a release year yet, so it only shows once it does.
  const specs = [
    ["Product ID", product.id],
    ["Model / edition", product.model],
    ["Serial number", product.serialNumber],
    ["Artist", artist],
    ["Label / distributor", product.distributor],
    ["Genre", genre],
    ["Category", category],
    ["Release year", product.releaseYear],
    ["Warranty", product.warrantyStatus],
    ["Quantity in stock", Number.isFinite(stock) ? stock : null],
  ];

  function handleAddToCart() {
    try {
      addToGuestCart(Number(product.id), selectedQuantity, stock);
      setCartMessage("Added to cart!");
      setCartError("");
    } catch (error) {
      setCartError(error.message);
      setCartMessage("");
    }
  }

  return (
    <article className="product-detail">
      <div className="product-cover">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={`${product.name} album cover`} />
        ) : (
          <span className="catalog-cover-placeholder is-vinyl">
            <span className="placeholder-record-disc" aria-hidden="true" />
            <span className="placeholder-record-initial" aria-hidden="true">
              {product.name.charAt(0)}
            </span>
            <span className="catalog-cover-title">{product.name}</span>
          </span>
        )}
      </div>

      <div className="product-info">
        <p className="product-eyebrow">{genre || category || "Vinyl"}</p>
        <h1>{product.name}</h1>
        {artist && <p className="product-artist">{artist}</p>}
        {(product.distributor || product.releaseYear) && (
          <p className="product-meta">
            {[product.distributor, product.releaseYear].filter(Boolean).join(" · ")}
          </p>
        )}

        <p className="product-price">{formatPrice(product.price)}</p>
        <p className={`product-stock${inStock ? "" : " is-out"}`} role="status">
          {available === 0 && inStock ? "Stock limit reached" : stockLabel(product.quantity)}
        </p>

        <div className="product-quantity-control" aria-label="Quantity">
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={available === 0 || selectedQuantity <= 1}
            onClick={() => setQuantity(Math.max(1, selectedQuantity - 1))}
          >
            −
          </button>
          <span aria-live="polite">{available === 0 ? 0 : selectedQuantity}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={available === 0 || selectedQuantity >= available}
            onClick={() => setQuantity(Math.min(available, selectedQuantity + 1))}
          >
            +
          </button>
        </div>
        <button
          type="button"
          className="product-add-button"
          onClick={handleAddToCart}
          disabled={!inStock || available === 0}
        >
          {!inStock ? "Out of Stock" : available === 0 ? "Stock Limit Reached" : "Add to Cart"}
        </button>
        {cartMessage && (
          <p className="product-feedback" role="status">
            {cartMessage} <a href="/cart">View cart</a>
          </p>
        )}
        {cartError && (
          <p className="product-feedback is-error" role="alert">{cartError}</p>
        )}

        <h2>Description</h2>
        <p className="product-description">{displayValue(product.description)}</p>

        <h2>Details</h2>
        <dl className="product-specs">
          {specs
            .filter(([label, value]) => label !== "Release year" || value)
            .map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{displayValue(value)}</dd>
              </div>
            ))}
        </dl>
      </div>
    </article>
  );
}

export default function ProductDetail({ id }) {
  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    getProductById(id, controller.signal)
      .then((found) => {
        setProduct(found);
        setStatus(found ? "ready" : "not-found");
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setErrorMessage(error.message);
          setStatus("error");
        }
      });

    return () => controller.abort();
  }, [id]);

  return (
    <div className="vinyl-site catalog-site">
      <NavBar />
      <main className="product-page">
        <a className="product-back" href="/shop">← Back to all records</a>
        {status === "loading" && (
          <p className="catalog-state" role="status">Loading record…</p>
        )}
        {status === "not-found" && (
          <p className="catalog-state" role="alert">
            We couldn’t find that record. <a href="/shop">Browse all records</a>
          </p>
        )}
        {status === "error" && (
          <p className="catalog-state" role="alert">
            Could not load this record. {errorMessage}
          </p>
        )}
        {status === "ready" && <ProductDetails product={product} />}
      </main>
      <Footer />
    </div>
  );
}
