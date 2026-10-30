import aboutImage from "../../assets/about/about-us.png";

export default function AboutPreview() {
  return (
    <section className="about-section" id="about">
      <div className="section-inner about-grid">
        <img
          className="about-photo"
          src={aboutImage}
          alt="Person playing a record in a vinyl shop"
          loading="lazy"
        />

        <div className="about-copy">
          <span className="eyebrow">
            MORE THAN MUSIC
          </span>

          <h2>
            For the Love
            <br />
            of the Spin.
          </h2>

          <p>
            We believe a record is more than a way to
            listen. It is the artwork, the ritual, the
            stories, and the feeling of finding a sound
            that stays with you.
          </p>

          <a href="/about" className="text-link">
            DISCOVER OUR STORY →
          </a>
        </div>
      </div>
    </section>
  );
}