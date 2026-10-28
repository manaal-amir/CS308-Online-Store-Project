export default function RecordCard({ product }) {
  const artist =
    typeof product.artist === "object"
      ? product.artist?.name
      : product.artist;

  const genre =
    typeof product.genre === "object"
      ? product.genre?.name
      : product.genre;

  return (
    <a
      className="record-card"
      href={`/product/${product.id}`}
    >
      <div className="record-cover">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={`${product.name} album cover`}
            loading="lazy"
          />
        ) : (
          <div className="missing-cover is-vinyl">
            <span className="placeholder-record-disc" aria-hidden="true" />
            <span className="placeholder-record-initial" aria-hidden="true">
              {product.name.charAt(0)}
            </span>
            <span className="catalog-cover-title">{product.name}</span>
          </div>
        )}
      </div>

      <span className="record-genre">
        {genre || "VINYL"}
      </span>

      <h3>{artist || "Various Artists"}</h3>
      <p>{product.name}</p>
    </a>
  );
}