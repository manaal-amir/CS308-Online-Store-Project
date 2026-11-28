// Displays catalog records and prevents spreadsheet-preview items from being added to the cart.
import { useEffect, useMemo, useRef, useState } from "react";
import { getCatalogProducts } from "../../services/api.js";
import useCart from "../../hooks/useCart.js";
import { getAuthSession } from "../../utils/authSession.js";
import {
  isInLocalWishlist,
  subscribeToLocalWishlist,
  toggleLocalWishlist,
} from "../../utils/localWishlist.js";
import CartIcon from "../icons/cartIcon.jsx";
import CartToast from "../feedback/cartToast.jsx";
import useCartToast from "../../hooks/useCartToast.js";
import AverageRating from "../reviews/averageRating.jsx";

function getRelationName(value) {
  return typeof value === "object" && value !== null ? value.name : value;
}

function getGenre(product) {
  return getRelationName(product.genre) || "";
}

function formatPrice(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export default function CatalogRecords({
  genres = [],
  categories = [],
  genre,
  sort = "newest",
  stockStatus = "all",
  maxPrice = 14990,
  search = "",
}) {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const { notification, showCartToast, dismissCartToast } = useCartToast();
  const cart = useCart();
  const isPopularitySort = sort === "popularity";

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setErrorMessage("");

    getCatalogProducts(
      controller.signal,
      isPopularitySort ? "popularity" : undefined,
    )
      .then(({ products: items, source, apiError }) => {
        if (controller.signal.aborted) return;

        setProducts(items);
        setIsPreview(source === "spreadsheet-preview");
        setErrorMessage(apiError);
        setStatus("ready");
      })
      .catch((error) => {
        if (!controller.signal.aborted && error.name !== "AbortError") {
          setErrorMessage(error.message);
          setStatus("error");
        }
      });

    return () => controller.abort();
  }, [isPopularitySort]);

  const records = useMemo(() => {
    const selectedGenres = genre ? [genre] : genres;
    const searchTerm = search.trim().toLowerCase();
    const matching = products.filter((product) => {
      const productGenre = getGenre(product).toLowerCase();
      const category = getRelationName(product.category) || "";
      const artist = getRelationName(product.artist) || product.distributor || "";
      const searchableText = [
        product.name,
        product.description,
        artist,
        productGenre,
        category,
        product.serialNumber,
      ].filter(Boolean).join(" ").toLowerCase();
      const searchMatches = !searchTerm || searchableText.includes(searchTerm);
      const genreMatches = !selectedGenres.length || selectedGenres.some((selected) => {
        const normalized = selected.toLowerCase();
        return productGenre === normalized || productGenre.startsWith(`${normalized}/`);
      });
      const categoryMatches = !categories.length || categories.includes(category);
      const stock = Number(product.quantity);
      const stockMatches =
        stockStatus === "all" ||
        (stockStatus === "in-stock" && stock > 0) ||
        (stockStatus === "out-of-stock" && stock <= 0);
      return searchMatches && genreMatches && categoryMatches && stockMatches && Number(product.price) <= maxPrice;
    });

    if (isPopularitySort) return matching;

    return [...matching].sort((first, second) => {
      const firstPrice = Number(first.price);
      const secondPrice = Number(second.price);
      if (sort === "price-low") return firstPrice - secondPrice;
      if (sort === "price-high") return secondPrice - firstPrice;
      if (sort === "name") return first.name.localeCompare(second.name);
      if (sort === "newest") {
        return new Date(second.createdAt ?? 0) - new Date(first.createdAt ?? 0);
      }
      return 0;
    });
  }, [products, genres, categories, genre, sort, isPopularitySort, stockStatus, maxPrice, search]);

  if (status === "loading") {
    return (
      <div className="catalog-results">
        <p className="catalog-state" role="status">Loading records…</p>
        <CartToast notification={notification} onDismiss={dismissCartToast} />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="catalog-results">
        <p className="catalog-state" role="alert">
          Could not load records from the product API. {errorMessage}
        </p>
        <CartToast notification={notification} onDismiss={dismissCartToast} />
      </div>
    );
  }

  return (
    <div className="catalog-results">
      {cart.error && <p className="catalog-state" role="alert">{cart.error}</p>}
      {isPreview && (
        <CatalogPreviewNotice />
      )}
      {records.length === 0 ? (
        <p className="catalog-state">
          {search.trim()
            ? `No records found matching “${search.trim()}”. Try another name or description.`
            : "No records found for these filters."}
        </p>
      ) : (
        <div className="catalog-records">
          {records.map((product) => (
            <CatalogCard
              key={product.id}
              product={product}
              isPreview={isPreview}
              onCartAdded={(cartItem) =>
                showCartToast(product.name, cartItem?.quantity)
              }
              cart={cart}
            />
          ))}
        </div>
      )}
      <CartToast notification={notification} onDismiss={dismissCartToast} />
    </div>
  );
}

export function CatalogPreviewNotice() {
  return (
    <p className="catalog-preview-note" role="status">
      Take a look around! These preview records are just for browsing and can’t be added to your cart.
    </p>
  );
}

export function CatalogCard(props) {
  if (props.cart) {
    return <CatalogCardContent {...props} cartState={props.cart} />;
  }
  return <CatalogCardWithCart {...props} />;
}

function CatalogCardWithCart(props) {
  const cartState = useCart();
  return <CatalogCardContent {...props} cartState={cartState} />;
}

function CatalogCardContent({
  product,
  isPreview = false,
  onCartAdded,
  cartState,
}) {
  const [saved, setSaved] = useState(() => isInLocalWishlist(product.id));
  const [cartError, setCartError] = useState("");
  const [wishlistError, setWishlistError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const addInProgress = useRef(false);
  const { items: cart, add, loading: cartLoading, isAuthenticated } = cartState;

  useEffect(() => subscribeToLocalWishlist((ids) => {
    setSaved(ids.includes(String(product.id)));
  }), [product.id]);

  function handleAddToCart() {
    if (addInProgress.current) return;
    addInProgress.current = true;
    setIsAdding(true);
    const finishAdding = () => {
      addInProgress.current = false;
      setIsAdding(false);
    };
    try {
      if (isPreview) return;
      const result = add(Number(product.id), 1, stock);
      if (result && typeof result.then === "function") {
        result
          .then((cartItem) => {
            setCartError("");
            onCartAdded?.(cartItem);
          })
          .catch((error) => setCartError(error.message))
          .finally(finishAdding);
      } else {
        const cartItem = result.find(
          (entry) => Number(entry.productId) === Number(product.id),
        );
        setCartError("");
        onCartAdded?.(cartItem);
        finishAdding();
      }
    } catch (error) {
      setCartError(error.message);
      finishAdding();
    } finally {
      if (isPreview) finishAdding();
    }
  }

  function handleToggleWishlist() {
    const session = getAuthSession();
    if (!session?.token || session.user?.id == null) {
      window.location.href = "/sign-in";
      return;
    }

    try {
      toggleLocalWishlist(product.id);
      setWishlistError("");
    } catch (error) {
      setWishlistError(error.message);
    }
  }

  const artist = getRelationName(product.artist) || product.distributor || "Various Artists";
  const category = getRelationName(product.category);
  const isVinyl = category?.toLowerCase() === "vinyl";
  const stock = Number(product.quantity);
  const isOutOfStock = !Number.isInteger(stock) || stock <= 0;
  const cartQuantity = cart.find((item) =>
    Number(item.productId) === Number(product.id),
  )?.quantity || 0;
  const isAtStockLimit = !isOutOfStock && cartQuantity >= stock;

  return (
    <article className="catalog-record">
      <div className="catalog-cover">
        <a href={`/product/${product.id}`} aria-label={`View ${product.name}`}>
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={`${product.name} album cover`} loading="lazy" />
          ) : (
            <span className={`catalog-cover-placeholder${isVinyl ? " is-vinyl" : ""}`}>
              <span className="placeholder-record-disc" aria-hidden="true" />
              <span className="placeholder-record-initial" aria-hidden="true">
                {product.name.charAt(0)}
              </span>
              <span className="catalog-cover-title">{product.name}</span>
            </span>
          )}
        </a>
        <button
          type="button"
          className={`save-record${saved ? " is-saved" : ""}`}
          aria-label={saved ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          aria-pressed={saved}
          onClick={handleToggleWishlist}
        >
          {saved ? "♥" : "♡"}
        </button>
      </div>
      <a className="catalog-record-info" href={`/product/${product.id}`}>
        <span className="catalog-record-category">
          {isVinyl ? getGenre(product) : category}
        </span>
        <h2>{artist}</h2>
        <p>{product.name}</p>
        <AverageRating
          averageRating={product.averageRating}
          ratingCount={product.ratingCount}
        />
        <span className="catalog-record-price">{formatPrice(product.price)}</span>
        <span
          className={`catalog-stock${isOutOfStock ? " is-out" : ""}`}
          aria-hidden={!isOutOfStock}
        >
          {isOutOfStock ? "Out of stock" : "\u00a0"}
        </span>
      </a>

      <button
        type="button"
        className="catalog-add-button"
        onClick={handleAddToCart}
        disabled={
          isPreview || isOutOfStock || isAtStockLimit || isAdding ||
          (isAuthenticated && cartLoading)
        }
      >
        {!isOutOfStock && <CartIcon />}
        {isOutOfStock
          ? "Out of Stock"
          : isAtStockLimit
            ? "Stock Limit Reached"
            : "Add to Cart"}
      </button>

      {cartError && (
        <p role="alert">{cartError}</p>
      )}

      {wishlistError && (
        <p role="alert">{wishlistError}</p>
      )}

    </article>
  );
}
