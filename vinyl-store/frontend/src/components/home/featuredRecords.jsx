import { useEffect, useState } from "react";
import { getCatalogProducts } from "../../services/api.js";
import RecordCard from "../records/recordCard.jsx";

export default function FeaturedRecords() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    getCatalogProducts(controller.signal)
      .then(({ products: items, source, apiError }) => {
        const vinylRecords = items.filter((product) => {
          const category =
            typeof product.category === "object"
              ? product.category?.name
              : product.category;

          return typeof category === "string" &&
            category.trim().toLowerCase() === "vinyl";
        });

        setProducts(vinylRecords.slice(0, 4));
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

  return (
    <section className="featured-section" id="featured">
      <div className="section-inner">
        <span className="eyebrow">
          CURATED FOR YOUR TURNTABLE
        </span>

        <h2>On Repeat</h2>

        <p className="section-subtitle">
          Some records never leave the rotation.
        </p>

        {status === "loading" && (
          <p className="catalog-message">
            Loading records…
          </p>
        )}

        {status === "ready" && (
          <>
            {isPreview && (
              <p className="catalog-preview-note" role="status">
                Showing spreadsheet preview records. Live product API unavailable: {errorMessage}
              </p>
            )}
            {products.length > 0 ? (
              <div className="record-grid">
                {products.map((product) => (
                  <RecordCard
                    key={product.id}
                    product={product}
                  />
                ))}
              </div>
            ) : (
              <p className="catalog-message">
                No vinyl records available yet.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}