
import { useEffect, useRef, useState } from "react";
import { getAuthSession } from "../utils/authSession.js";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from "../services/wishlistApi.js";

export default function useWishlist() {
  const [session] = useState(getAuthSession);
  const token = session?.token;
  const userId = session?.user?.id;

  const [savedIds, setSavedIds] = useState([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const busyRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    if (!token || userId == null) {
      setSavedIds([]);
      setLoading(false);
      return () => controller.abort();
    }

    setLoading(true);
    setError("");

    getWishlist(token, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setSavedIds(items.map((item) => String(item.productId)));
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted && err.name !== "AbortError") {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [token, userId]);

  async function toggleWishlist(productId) {
    if (!token || userId == null) {
      throw new Error("Please sign in to use your wishlist.");
    }

    if (busyRef.current || loading) return;

    const id = String(productId);
    const alreadySaved = savedIds.includes(id);

    busyRef.current = true;
    setSavingId(id);
    setError("");

    try {
      if (alreadySaved) {
        await removeFromWishlist(token, productId);
        setSavedIds((current) =>
          current.filter((savedId) => savedId !== id)
        );
      } else {
        await addToWishlist(token, productId);
        setSavedIds((current) =>
          current.includes(id) ? current : [...current, id]
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current = false;
      setSavingId(null);
    }
  }

  return {
    savedIds,
    loading,
    savingId,
    error,
    toggleWishlist,
  };
}
