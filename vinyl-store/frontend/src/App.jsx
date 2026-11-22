import Cart from "./pages/cart.jsx";
import Home from "./pages/home.jsx";
import Shop from "./pages/shop.jsx";
import Genre from "./pages/genre.jsx";
import Genres from "./pages/genres.jsx";
import Account from "./pages/account.jsx";
import ProductDetail from "./pages/productDetail.jsx";
import Orders from "./pages/orders.jsx";
import OrderDetail from "./pages/orderDetail.jsx";
import Deliveries from "./pages/deliveries.jsx";
import Checkout from "./pages/checkout.jsx";
import Invoice from "./pages/invoice.jsx";

function App() {
  const path = window.location.pathname;
  const genre = new URLSearchParams(window.location.search).get("genre");

  if (path === "/genres") {
    return <Genres />;
  }

  if (path === "/shop" && genre) {
    return <Genre genre={genre} />;
  }

  if (path === "/shop") {
    return <Shop />;
  }

  const productMatch = path.match(/^\/product\/(\d+)\/?$/);
  if (productMatch) {
    return <ProductDetail id={productMatch[1]} />;
  }

  if (path === "/manager/deliveries") {
    return <Deliveries />;
  }

  const orderMatch = path.match(/^\/orders\/(\d+)\/?$/);
  if (orderMatch) {
    return <OrderDetail id={orderMatch[1]} />;
  }

  if (path === "/orders") {
    return <Orders />;
  }

  if (path === "/cart") {
    return <Cart />;
  }

  if (path === "/checkout") {
    return <Checkout />;
  }

  if (
    path === "/sign-in" ||
    path === "/create-account" ||
    path === "/profile" ||
    path === "/wishlist" ||
    path === "/account-settings"
  ) {
    return <Account />;
  }

  if (path === "/invoice") {
  const savedOrder = sessionStorage.getItem("vinyl-store-last-order");
  let order = null;

  try {
    order = savedOrder ? JSON.parse(savedOrder) : null;
  } catch {
    order = null;
  }

  return <Invoice order={order} />;
}

  return <Home />;
}

export default App;
