import NavBar from "../components/layout/navBar.jsx";
import Footer from "../components/layout/footer.jsx";
import Hero from "../components/home/hero.jsx";
import FeaturedRecords from "../components/home/featuredRecords.jsx";
import ShopByGenre from "../components/home/shopByGenre.jsx";
import AboutPreview from "../components/home/aboutPreview.jsx";
import NewsLetter from "../components/home/newsLetter.jsx";

import "../styles/home.css";

export default function Home() {
  return (
    <div className="vinyl-site">
      <NavBar />

      <main>
        <Hero />
        <FeaturedRecords />
        <ShopByGenre />
        <AboutPreview />
        <NewsLetter />
      </main>

      <Footer />
    </div>
  );
}