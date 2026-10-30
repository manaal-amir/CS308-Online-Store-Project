import rockImage from "../../assets/genres/rock.png";
import jazzImage from "../../assets/genres/jazz.png";
import classicalImage from "../../assets/genres/classical.png";
import hiphopImage from "../../assets/genres/hiphop.png";

const genres = [
  {
    title: "ROCK",
    description: "Loud & timeless",
    image: "rock",
    artwork: rockImage,
    filter: "Rock",
  },
  {
    title: "JAZZ",
    description: "For the late nights",
    image: "jazz",
    artwork: jazzImage,
    filter: "Jazz",
  },
  {
    title: "CLASSICAL",
    description: "Timeless performances",
    image: "classical",
    artwork: classicalImage,
    filter: "Classical",
  },
  {
    title: "HIP-HOP",
    description: "Beats that move you",
    image: "hip-hop",
    artwork: hiphopImage,
    filter: "Hip-Hop/Rap",
  },
];

export default function ShopByGenre() {
  return (
    <section className="genres-section" id="genres">
      <div className="section-inner">
        <span className="eyebrow">
          FOLLOW YOUR EARS
        </span>

        <h2>Find Your Sound</h2>

        <div className="genre-grid">
          {genres.map((genre) => (
            <a
              key={genre.title}
              className={`genre-tile genre-${genre.image}`}
              href={`/shop?genre=${encodeURIComponent(genre.filter)}`}
            >
              <img
                className="genre-image"
                src={genre.artwork}
                alt=""
                loading="lazy"
              />
              <div className="genre-label">
                <h3>{genre.title}</h3>
                <p>{genre.description}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}