import NavBar from "../components/layout/navBar.jsx";
import Footer from "../components/layout/footer.jsx";
import rockImage from "../assets/genres/rock.png";
import jazzImage from "../assets/genres/jazz.png";
import popImage from "../assets/genres/soulAndR&B.png";
import electronicImage from "../assets/genres/hiphop.png";
import classicalImage from "../assets/genres/jazz.png";
import hiphopImage from "../assets/genres/hiphop.png";
import "../styles/home.css";
import "../styles/catalog.css";

const genres = [
  { name: "Jazz", image: jazzImage, description: "For the late nights" },
  { name: "Rock", image: rockImage, description: "Loud & timeless" },
  { name: "Pop", image: popImage, description: "Find your new favorite" },
  { name: "Classical", image: classicalImage, description: "Timeless performances" },
  { name: "Hip-Hop/Rap", image: hiphopImage, description: "Beats that move you" },
  { name: "Electronic", image: electronicImage, description: "Into a different frequency" },
];

export default function Genres() {
  return (
    <div className="vinyl-site catalog-site">
      <NavBar />
      <main className="genres-browse-page">
        <div className="genres-browse-heading">
          <p className="eyebrow">Follow your ears</p>
          <h1>Shop by Genre</h1>
          <p>Find the sounds you love, then discover something new.</p>
        </div>
        <div className="genres-browse-grid">
          {genres.map((genre) => (
            <a
              className="genres-browse-card"
              href={`/shop?genre=${encodeURIComponent(genre.name)}`}
              key={genre.name}
            >
              <img src={genre.image} alt="" loading="lazy" />
              <span className="genres-browse-copy">
                <span>{genre.name}</span>
                <small>{genre.description}</small>
              </span>
            </a>
          ))}
        </div>
        <a className="genres-all-records" href="/shop">Browse all records →</a>
      </main>
      <Footer />
    </div>
  );
}
