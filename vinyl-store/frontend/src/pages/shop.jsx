import { useState } from "react";
import NavBar from "../components/layout/navBar.jsx";
import Footer from "../components/layout/footer.jsx";
import CatalogRecords from "../components/records/catalogRecords.jsx";
import "../styles/home.css";
import "../styles/catalog.css";

const genres = [
  "Jazz",
  "Pop",
  "Rock",
  "Classical",
  "Hip-Hop/Rap",
  "Electronic",
];

const categories = ["Vinyl", "Record Player", "Accessory"];

export default function Shop() {
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [stockStatus, setStockStatus] = useState("all");
  const [maxPrice, setMaxPrice] = useState(14990);
  const [searchQuery, setSearchQuery] = useState(
    () => new URLSearchParams(window.location.search).get("search") || "",
  );
  const [sort, setSort] = useState(() =>
    new URLSearchParams(window.location.search).get("sort") === "newest"
      ? "newest"
      : "featured",
  );
  const [expanded, setExpanded] = useState({
    genre: true,
    format: true,
    condition: true,
    price: true,
  });

  function clearSearch() {
    if (!searchQuery) return;

    setSearchQuery("");
    const url = new URL(window.location.href);
    url.searchParams.delete("search");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    window.dispatchEvent(new Event("catalog:search-cleared"));
  }

  function toggleGenre(genre) {
    clearSearch();
    setSelectedGenres((current) =>
      current.includes(genre)
        ? current.filter((item) => item !== genre)
        : [...current, genre],
    );
  }

  function toggleSection(name) {
    setExpanded((current) => ({ ...current, [name]: !current[name] }));
  }

  function clearFilters() {
    clearSearch();
    setSelectedGenres([]);
    setSelectedCategories([]);
    setStockStatus("all");
    setMaxPrice(14990);
  }

  function toggleCategory(category) {
    clearSearch();
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  }

  return (
    <div className="vinyl-site catalog-site">
      <NavBar />
      <main className="shop-page">
        <div className="catalog-heading">
          <div>
            <h1>{searchQuery ? "Search Results" : "All Records"}</h1>
            {searchQuery && (
              <p className="catalog-search-summary">
                Results for “{searchQuery}”
              </p>
            )}
          </div>
          <div className="catalog-tools">
            <label htmlFor="record-sort">Sort by</label>
            <select
              id="record-sort"
              value={sort}
              onChange={(event) => {
                clearSearch();
                setSort(event.target.value);
              }}
            >
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        <div className="catalog-layout">
          <aside className="catalog-sidebar is-open" aria-label="Record filters">
            <FilterGroup
              title="Genre"
              open={expanded.genre}
              onToggle={() => toggleSection("genre")}
            >
              <div className="genre-filter-list">
                {genres.map((genre) => (
                  <label key={genre}>
                    <input
                      type="checkbox"
                      checked={selectedGenres.includes(genre)}
                      onChange={() => toggleGenre(genre)}
                    />
                    {genre}
                  </label>
                ))}
              </div>
            </FilterGroup>
            <FilterGroup
              title="Format"
              open={expanded.format}
              onToggle={() => toggleSection("format")}
            >
              <div className="genre-filter-list">
                {categories.map((category) => (
                  <label key={category}>
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category)}
                      onChange={() => toggleCategory(category)}
                    />
                    {category}
                  </label>
                ))}
              </div>
            </FilterGroup>
            <FilterGroup
              title="Condition"
              open={expanded.condition}
              onToggle={() => toggleSection("condition")}
            >
              <div className="genre-filter-list">
                <label>
                  <input
                    type="radio"
                    name="stock-status"
                    checked={stockStatus === "all"}
                    onChange={() => {
                      clearSearch();
                      setStockStatus("all");
                    }}
                  />
                  All products
                </label>
                <label>
                  <input
                    type="radio"
                    name="stock-status"
                    checked={stockStatus === "in-stock"}
                    onChange={() => {
                      clearSearch();
                      setStockStatus("in-stock");
                    }}
                  />
                  In stock
                </label>
                <label>
                  <input
                    type="radio"
                    name="stock-status"
                    checked={stockStatus === "out-of-stock"}
                    onChange={() => {
                      clearSearch();
                      setStockStatus("out-of-stock");
                    }}
                  />
                  Out of stock
                </label>
              </div>
            </FilterGroup>
            <FilterGroup
              title="Price"
              open={expanded.price}
              onToggle={() => toggleSection("price")}
            >
              <div className="price-filter">
                <label htmlFor="max-price">Maximum price: ₺{maxPrice.toLocaleString("tr-TR")}</label>
                <input
                  id="max-price"
                  type="range"
                  min="390"
                  max="14990"
                  step="100"
                  value={maxPrice}
                  onChange={(event) => {
                    clearSearch();
                    setMaxPrice(Number(event.target.value));
                  }}
                />
              </div>
            </FilterGroup>
            <button className="clear-filters" type="button" onClick={clearFilters}>
              Clear Filters
            </button>
          </aside>
          <CatalogRecords
            genres={selectedGenres}
            categories={selectedCategories}
            stockStatus={stockStatus}
            maxPrice={maxPrice}
            sort={sort}
            search={searchQuery}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}

function FilterGroup({ title, open, onToggle, children }) {
  return (
    <section className="filter-group">
      <button
        className="filter-heading"
        type="button"
        aria-expanded={open}
        onClick={onToggle}
      >
        {title}<span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="filter-content">{children}</div>}
    </section>
  );
}