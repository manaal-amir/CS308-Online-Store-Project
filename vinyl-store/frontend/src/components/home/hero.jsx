import heroImage from "../../assets/hero/hero.png";

export default function Hero() {
  return (
    <section className="vinyl-hero">
      <img className="vinyl-hero-image" src={heroImage} alt="" />
      <div className="hero-content">
        <h1>VINYL</h1>

        <p className="hero-tagline">
          Where Sound Has Soul.
        </p>

        <p className="hero-description">
          Good music deserves more than a playlist.
          <br />
          Discover new music and timeless classics.
        </p>

        <a className="vinyl-button" href="/shop">
          Shop Records <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  );
}