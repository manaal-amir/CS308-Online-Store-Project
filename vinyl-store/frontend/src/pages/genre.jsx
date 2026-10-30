import NavBar from "../components/layout/navBar.jsx";
import Footer from "../components/layout/footer.jsx";
import CatalogRecords from "../components/records/catalogRecords.jsx";
import rockImage from "../assets/genres/rock.png";
import jazzImage from "../assets/genres/jazz.png";
import popImage from "../assets/genres/pop.png";
import electronicImage from "../assets/genres/electronic.png";
import classicalImage from "../assets/genres/classical.png";
import hiphopImage from "../assets/genres/hiphop.png";
import "../styles/home.css";
import "../styles/catalog.css";

const genreDetails = {
  rock: {
    name: "Rock",
    image: rockImage,
    description:
      "From classic legends to modern icons, explore our records that shaped generations.",
  },
  jazz: {
    name: "Jazz",
    image: jazzImage,
    description: "Explore timeless records, smooth improvisations, and sounds for the late nights.",
  },
  pop: {
    name: "Pop",
    image: popImage,
    description: "Discover the records and artists that define the sound of now.",
  },
  electronic: {
    name: "Electronic",
    image: electronicImage,
    description: "Explore electronic sounds, from deep grooves to dance-floor classics.",
  },
  classical: {
    name: "Classical",
    image: classicalImage,
    description: "Find enduring performances and essential orchestral recordings.",
  },
  "hip-hop": {
    name: "Hip-Hop",
    image: hiphopImage,
    description: "Discover essential beats, rhymes, and records that moved culture.",
  },
  soundtracks: {
    name: "Soundtracks",
    image: rockImage,
    description: "Bring unforgettable film and television soundtracks to your turntable.",
  },
  soul: {
    name: "Soul",
    image: popImage,
    description: "Feel every note with soulful voices and timeless grooves.",
  },
  "soul-rb": {
    name: "Soul & R&B",
    image: popImage,
    description: "Feel every note with soulful voices and timeless grooves.",
  },
  funk: {
    name: "Funk",
    image: popImage,
    description: "Find deep grooves, bold basslines, and records made to move you.",
  },
  blues: {
    name: "Blues",
    image: rockImage,
    description: "Explore the sounds and stories that shaped generations of music.",
  },
};

export default function Genre({ genre = "Rock" }) {
  const key = genre.toLowerCase().replace(/&/g, "").replace(/\s+/g, "-").replace(/\/.*/, "");
  const details = genreDetails[key] ?? {
    name: genre,
    image: rockImage,
    description: `Explore our ${genre} records and discover your next favorite.`,
  };

  return (
    <div className="vinyl-site catalog-site">
      <NavBar />
      <main className="genre-page">
        <section
          className="genre-collection-hero"
          style={{ "--collection-art": `url("${details.image}")` }}
        >
          <div className="genre-collection-copy">
            <h1>{details.name}</h1>
            <p>{details.description}</p>
            <a href="/shop" className="back-to-shop">
              <span aria-hidden="true">↓</span> Back to Shop
            </a>
          </div>
        </section>
        <section className="genre-collection-records" aria-label={`${details.name} records`}>
          <CatalogRecords genre={details.name} />
        </section>
      </main>
      <Footer />
    </div>
  );
}