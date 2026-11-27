// Approved comments on the product page (SCRUM-60 / SCRUM-164). Anyone can read them,
// and the API only ever returns approved ones, so pending and rejected comments never show.
import { useEffect, useState } from "react";
import { getApprovedComments } from "../../services/reviewsApi.js";
import { formatOrderDate } from "../../utils/orderStatus.js";
import "../../styles/commentList.css";

export function CommentList({ comments }) {
  return (
    <ul className="comment-list">
      {comments.map((comment) => (
        <li key={comment.id} className="comment-item">
          <div className="comment-meta">
            <strong className="comment-author">{comment.authorName}</strong>
            <time className="comment-date" dateTime={comment.createdAt}>
              {formatOrderDate(comment.createdAt)}
            </time>
          </div>
          <p className="comment-content">{comment.content}</p>
        </li>
      ))}
    </ul>
  );
}

export default function ApprovedComments({ productId }) {
  const [comments, setComments] = useState([]);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    getApprovedComments(productId, controller.signal)
      .then((items) => {
        setComments(Array.isArray(items) ? items : []);
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setErrorMessage(error.message);
        setStatus("error");
      });

    return () => controller.abort();
  }, [productId]);

  return (
    <section className="comments-section" aria-labelledby="comments-heading">
      <h2 id="comments-heading">
        Comments{status === "ready" && comments.length > 0 ? ` (${comments.length})` : ""}
      </h2>
      {status === "loading" && (
        <p className="comments-note" role="status">Loading comments…</p>
      )}
      {status === "error" && (
        <p className="comments-note is-error" role="alert">{errorMessage}</p>
      )}
      {status === "ready" && comments.length === 0 && (
        <p className="comments-note">No comments yet.</p>
      )}
      {status === "ready" && comments.length > 0 && <CommentList comments={comments} />}
    </section>
  );
}
