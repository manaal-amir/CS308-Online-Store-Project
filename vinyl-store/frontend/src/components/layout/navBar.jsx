import { useEffect, useRef, useState } from "react";
import {
  getGuestCartCount,
  subscribeToGuestCart,
} from "../../utils/guestCart.js";

export default function NavBar() {
  const [cartCount, setCartCount] = useState(getGuestCartCount);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(() =>
    new URLSearchParams(window.location.search).get("search") || "",
  );

  useEffect(() => {

    return subscribeToGuestCart(() => {
      setCartCount(getGuestCartCount());
    });
  }, []);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    function handleSearchCleared() {
      setQuery("");
    }

    window.addEventListener("catalog:search-cleared", handleSearchCleared);

    return () => {
      window.removeEventListener("catalog:search-cleared", handleSearchCleared);
    };
  }, []);


  function submitSearch(event) {
    event.preventDefault();
    const search = query.trim();
    window.location.href = search
      ? `/shop?search=${encodeURIComponent(search)}`
      : "/shop";
  }

  return (
    <header className="vinyl-nav">
      <a className="vinyl-mark" href="/" aria-label="VINYL home">
        <span />
      </a>

      <button
        className="mobile-menu"
        onClick={() => setOpen(!open)}
        aria-label="Toggle navigation"
        aria-expanded={open}
      >
        ☰
      </button>

      <nav className={open ? "open" : ""} aria-label="Main navigation">
        <a href="/shop">Shop</a>
        <a href="/shop?sort=newest">New arrivals</a>
        <a href="/genres">Genres</a>
        <a href="/#about">About</a>
        <a href="/#newsletter">Magazine</a>
      </nav>

      <form className="nav-search-form" role="search" onSubmit={submitSearch}>
        <label className="sr-only" htmlFor="site-record-search">Search records</label>
        <input
          id="site-record-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search records..."
        />
        <button type="submit" aria-label="Submit search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.5" />
            <path d="m16 16 5 5" />
          </svg>
        </button>
      </form>

      <div className="nav-actions">
        <a href="/profile" aria-label="Your profile">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="7" r="3.3" />
            <path d="M5 21v-2c0-4 14-4 14 0v2" />
          </svg>
        </a>

        
<a
  href="/cart"
  className="nav-cart-link"
  aria-label={`Shopping cart, ${cartCount} items`}
>
  <svg viewBox="0 0 24 24">
    <path d="M3 4h2l2.2 11h11.5l2-8H6" />
    <circle cx="9" cy="20" r="1" />
    <circle cx="18" cy="20" r="1" />
  </svg>

  {cartCount > 0 && (
    <span className="cart-count-badge" aria-hidden="true">
      {cartCount}
    </span>
  )}
</a>

      </div>
    </header>
  );
}