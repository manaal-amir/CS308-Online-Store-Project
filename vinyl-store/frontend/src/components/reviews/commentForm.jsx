// Comment form on the product page (SCRUM-58 / SCRUM-163). Only customers who received
// the record can comment, and the comment stays pending until a product manager approves it.
import { useEffect, useState } from "react";
import { getMyReview, postComment } from "../../services/reviewsApi.js";
import { getAuthSession } from "../../utils/authSession.js";
import "../../styles/commentForm.css";

export const MAX_COMMENT_LENGTH = 1000;
export const WAITING_MESSAGE =
  "Your comment is waiting for approval. It will appear here once a product manager approves it.";

export default function CommentForm({ productId }) {
  const [session] = useState(getAuthSession);
  const isCustomer = session?.user?.role === "CUSTOMER";
  const [state, setState] = useState(isCustomer ? "loading" : session ? "hidden" : "guest");
  const [canReview, setCanReview] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isCustomer) return undefined;

    const controller = new AbortController();
    getMyReview(session.token, productId, controller.signal)
      .then((result) => {
        setCanReview(Boolean(result.canReview));
        setWaiting(Boolean(result.hasPendingComment));
        setState("ready");
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setErrorMessage(error.message);
        setState("error");
      });

    return () => controller.abort();
  }, [isCustomer, session, productId]);

  const content = text.trim();

  async function handleSubmit(event) {
    event.preventDefault();
    if (!content || submitting) return;

    setSubmitting(true);
    setErrorMessage("");
    try {
      await postComment(session.token, productId, content);
      setText("");
      setWaiting(true);
    } catch (error) {
      if (error.status === 409) {
        // One comment is already waiting for approval, so show that instead of the form.
        setWaiting(true);
      } else {
        setErrorMessage(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Staff accounts do not comment on records.
  if (state === "hidden") return null;

  return (
    <section className="comment-form-section" aria-labelledby="comment-form-heading">
      <h2 id="comment-form-heading">Leave a comment</h2>

      {state === "guest" && (
        <p className="comment-form-note">
          <a href="/sign-in">Sign in</a> to comment on records that have been delivered to you.
        </p>
      )}
      {state === "loading" && (
        <p className="comment-form-note" role="status">Checking if you can comment…</p>
      )}
      {state === "error" && (
        <p className="comment-form-note is-error" role="alert">{errorMessage}</p>
      )}
      {state === "ready" && !canReview && (
        <p className="comment-form-note">
          You can comment on this record once it has been delivered to you.
        </p>
      )}
      {state === "ready" && canReview && waiting && (
        <p className="comment-form-note is-success" role="status">{WAITING_MESSAGE}</p>
      )}
      {state === "ready" && canReview && !waiting && (
        <form className="comment-form" onSubmit={handleSubmit}>
          <label htmlFor="comment-text">Your comment</label>
          <textarea
            id="comment-text"
            value={text}
            maxLength={MAX_COMMENT_LENGTH}
            rows={4}
            disabled={submitting}
            onChange={(event) => setText(event.target.value)}
            placeholder="What did you think of this record?"
          />
          <div className="comment-form-footer">
            <span className="comment-form-count">
              {text.length} / {MAX_COMMENT_LENGTH}
            </span>
            <button type="submit" disabled={!content || submitting}>
              {submitting ? "Sending…" : "Post comment"}
            </button>
          </div>
          {errorMessage && (
            <p className="comment-form-note is-error" role="alert">{errorMessage}</p>
          )}
        </form>
      )}
    </section>
  );
}
