import { useState } from "react";

export default function NewsLetter() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <section className="newsletter-section" id="newsletter">
      <div className="section-inner">
        <span className="eyebrow">
          STAY IN THE GROOVE
        </span>

        <h2>Good music. Straight to your inbox.</h2>

        <p>
          New drops, hidden gems, and stories worth sharing.
        </p>

        <form
          className="newsletter-form"
          onSubmit={handleSubmit}
        >
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setSubmitted(false);
            }}
            placeholder="Your email address"
            aria-label="Email address"
            required
          />

          <button type="submit">
            SUBSCRIBE →
          </button>
        </form>

        {submitted && (
          <p className="form-note" role="status">
            Newsletter sign-up will be available
            when the service is connected.
          </p>
        )}
      </div>
    </section>
  );
}