
import { useEffect, useState } from "react";
import { getAuthSession } from "../utils/authSession.js";
import {
  getPendingComments,
  reviewPendingComment,
} from "../services/managerCommentsApi.js";
import "../styles/pendingComments.css";

export default function PendingComments() {
  const [session] = useState(getAuthSession);
  const isManager = session?.user?.role === "PRODUCT_MANAGER";

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(isManager);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isManager) return;

    const controller = new AbortController();

    setLoading(true);

    getPendingComments(session.token, controller.signal)
      .then((items) => {
        setComments(items);
        setError("");
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [isManager, session?.token, reloadKey]);

  async function handleReview(commentId, decision) {
    if (savingId !== null) return;

    setSavingId(commentId);
    setError("");
    setNotice("");

    try {
      await reviewPendingComment(session.token, commentId, decision);

      setComments((current) =>
        current.filter((comment) => comment.id !== commentId),
      );

      setNotice(
        decision === "APPROVED"
          ? "Comment approved successfully."
          : "Comment rejected successfully.",
      );
    } catch (err) {
      setError(err.message);

      if (err.status === 409) {
        setReloadKey((key) => key + 1);
      }
    } finally {
      setSavingId(null);
    }
  }

  if (!isManager) {
    return (
      <p className="orders-state" role="alert">
        Only product managers can review comments.
      </p>
    );
  }

  return (
    <section className="pending-comments">
      <h1>Pending Comments</h1>

      <p className="orders-state">
        Review customer comments before they become visible.
      </p>

      {error && <p role="alert" className="comment-review-error">{error}</p>}
      {notice && <p role="status" className="comment-review-notice">{notice}</p>}

      {loading ? (
        <p className="orders-state" role="status">
          Loading pending comments...
        </p>
      ) : comments.length === 0 && !error ? (
        <p className="orders-state">No comments waiting for approval.</p>
      ) : (
        <div className="pending-comments-list">
          {comments.map((comment) => (
            <article className="pending-comment-card" key={comment.id}>
              <div className="pending-comment-info">
                <h2>{comment.productName}</h2>
                <p>Product ID: {comment.productId}</p>
                <p>Customer: {comment.author?.name || "Unknown"}</p>
                <p>
                  Submitted:{" "}
                  {new Date(comment.createdAt).toLocaleDateString("en-GB")}
                </p>
              </div>

              <blockquote>{comment.content}</blockquote>

              <div className="pending-comment-actions">
                <button
                  type="button"
                  className="comment-approve"
                  disabled={savingId !== null}
                  onClick={() => handleReview(comment.id, "APPROVED")}
                >
                  {savingId === comment.id ? "Saving..." : "Approve"}
                </button>

                <button
                  type="button"
                  className="comment-reject"
                  disabled={savingId !== null}
                  onClick={() => handleReview(comment.id, "REJECTED")}
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
