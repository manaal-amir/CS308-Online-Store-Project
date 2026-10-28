import Home from "./pages/home.jsx";
import Shop from "./pages/shop.jsx";
import Genre from "./pages/genre.jsx";
import Genres from "./pages/genres.jsx";
import Account from "./pages/account.jsx";

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

  if (
    path === "/sign-in" ||
    path === "/create-account" ||
    path === "/profile" ||
    path === "/wishlist" ||
    path === "/account-settings"
  ) {
    return <Account />;
  }

  return <Home />;
}

export default App;