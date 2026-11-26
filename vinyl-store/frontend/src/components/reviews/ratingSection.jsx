// Star rating on the product page (SCRUM-57 / SCRUM-162). Only customers who
// received the record can rate it, and the rating shows immediately.
import { useEffect, useState } from "react";
import StarRating from "./starRating.jsx";
import { getMyReview, rateProduct } from "../../services/reviewsApi.js";
import { getAuthSession } from "../../utils/authSession.js";
import "../../styles/reviews.css";

export function ratingSummaryText({ averageRating, ratingCount }) {
  if (averageRating == null || !ratingCount) return "No ratings yet.";
  return `Average ${averageRating} out of 5 from ${ratingCount} ${ratingCount === 1 ? "rating" : "ratings"}.`;
}

export default function RatingSection({ productId }) {
  const [session] = useState(getAuthSession);
  const isCustomer = session?.user?.role === "CUSTOMER";
  const [state, setState] = useState(isCustomer ? "loading" : session ? "hidden" : "guest");
  const [mine, setMine] = useState({ canReview: false, rating: null });
  const [summary, setSummary] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isCustomer) return undefined;

    const controller = new AbortController();
    getMyReview(session.token, productId, controller.signal)
      .then((result) => {
        setMine(result);
        setState("ready");
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setErrorMessage(error.message);
        setState("error");
      });

    return () => controller.abort();
  }, [isCustomer, session, productId]);

  async function handleRate(value) {
    setSaving(true);
    setSaved(false);
    setErrorMessage("");
    try {
      const result = await rateProduct(session.token, productId, value);
      setMine((current) => ({ ...current, rating: result.value }));
      setSummary({ averageRating: result.averageRating, ratingCount: result.ratingCount });
      setSaved(true);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  // Staff accounts do not rate records.
  if (state === "hidden") return null;

  return (
    <section className="rating-section" aria-labelledby="rating-heading">
      <h2 id="rating-heading">Rate this record</h2>

      {state === "guest" && (
        <p className="reviews-note">
          <a href="/sign-in">Sign in</a> to rate records that have been delivered to you.
        </p>
      )}
      {state === "loading" && (
        <p className="reviews-note" role="status">Checking if you can rate this record…</p>
      )}
      {state === "error" && (
        <p className="reviews-note is-error" role="alert">{errorMessage}</p>
      )}
      {state === "ready" && !mine.canReview && (
        <p className="reviews-note">
          You can rate this record once it has been delivered to you.
        </p>
      )}
      {state === "ready" && mine.canReview && (
        <>
          <StarRating
            value={mine.rating ?? 0}
            onChange={handleRate}
            disabled={saving}
          />
          <p className="reviews-note">
            {mine.rating
              ? `You rated this ${mine.rating} out of 5. Click a star to change it.`
              : "Click a star to rate this record."}
          </p>
          {saved && summary && (
            <p className="reviews-note is-success" role="status">
              Thanks, your rating is saved. {ratingSummaryText(summary)}
            </p>
          )}
          {errorMessage && (
            <p className="reviews-note is-error" role="alert">{errorMessage}</p>
          )}
        </>
      )}
    </section>
  );
}
