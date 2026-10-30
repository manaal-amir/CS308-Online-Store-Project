import { useEffect, useMemo, useState } from "react";
import { getCatalogProducts } from "../../services/api.js";

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
  sort = "featured",
  stockStatus = "all",
  maxPrice = 14990,
  search = "",
}) {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    getCatalogProducts(controller.signal)
      .then(({ products: items, source, apiError }) => {
        setProducts(items);
        setIsPreview(source === "spreadsheet-preview");
        setErrorMessage(apiError);
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setErrorMessage(error.message);
          setStatus("error");
        }
      });

    return () => controller.abort();
  }, []);

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
      const stockMatches =
        stockStatus === "all" ||
        (stockStatus === "in-stock" && product.quantity > 0) ||
        (stockStatus === "out-of-stock" && product.quantity === 0);
      return searchMatches && genreMatches && categoryMatches && stockMatches && Number(product.price) <= maxPrice;
    });

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
  }, [products, genres, categories, genre, sort, stockStatus, maxPrice, search]);

  if (status === "loading") {
    return (
      <div className="catalog-results">
        <p className="catalog-state" role="status">Loading records…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="catalog-results">
        <p className="catalog-state" role="alert">
          Could not load records from the product API. {errorMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="catalog-results">
      {isPreview && (
        <p className="catalog-preview-note" role="status">
          Showing spreadsheet preview data. Live product API unavailable: {errorMessage}
        </p>
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
            <CatalogCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

function CatalogCard({ product }) {
  const [saved, setSaved] = useState(false);
  const artist = getRelationName(product.artist) || product.distributor || "Various Artists";
  const category = getRelationName(product.category);
  const isVinyl = category?.toLowerCase() === "vinyl";

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
        {product.quantity === 0 && <span className="catalog-stock">Out of stock</span>}
      </a>
      <a className="catalog-add-button" href="/cart">Add to Cart</a>
    </article>
  );
}
