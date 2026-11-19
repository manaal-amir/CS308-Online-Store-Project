// Displays catalog records and prevents spreadsheet-preview items from being added to the cart.
import { useEffect, useMemo, useState } from "react";
import { getCatalogProducts } from "../../services/api.js";
import { addCatalogProductToCart } from "../../utils/catalogCart.js";
import { getGuestCart } from "../../utils/guestCart.js";
import CartIcon from "../icons/cartIcon.jsx";
import CartToast from "../feedback/cartToast.jsx";
import useCartToast from "../../hooks/useCartToast.js";

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
              onCartAdded={(name) => {
                const cartItem = getGuestCart().find(
                  (entry) => String(entry.productId) === String(product.id),
                );
                showCartToast(name, cartItem?.quantity);
              }}
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

export function CatalogCard({ product, isPreview = false, onCartAdded }) {
  const [saved, setSaved] = useState(false);
  const [cartError, setCartError] = useState("");

  function handleAddToCart() {
    try {
      if (!addCatalogProductToCart(product, isPreview)) return;
      setCartError("");
      onCartAdded?.(product.name);
    } catch (error) {
      setCartError(error.message);
    }
  }

  const artist = getRelationName(product.artist) || product.distributor || "Various Artists";
  const category = getRelationName(product.category);
  const isVinyl = category?.toLowerCase() === "vinyl";
  const isOutOfStock = Number(product.quantity) <= 0;

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
          onClick={() => setSaved((value) => !value)}
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
        disabled={isPreview || isOutOfStock}
       >
       {!isOutOfStock && <CartIcon />}
       {isOutOfStock ? "Out of Stock" : "Add to Cart"}
       </button>

      {cartError && (
       <p role="alert">{cartError}</p>
      )}

    </article>
  );
}
