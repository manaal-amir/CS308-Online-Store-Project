
import { useCallback, useEffect, useState } from "react";

import {
  addAuthenticatedCartItem,
  getAuthenticatedCart,
  removeAuthenticatedCartItem,
  updateAuthenticatedCartItem,
} from "../services/cartApi.js";

import {
  getAuthSession,
  clearAuthSession,
} from "../utils/authSession.js";

import {
  addToGuestCart,
  getGuestCart,
  mergeGuestCartAfterLogin,
  removeFromGuestCart,
  subscribeToGuestCart,
  updateGuestCartItem,
  waitForGuestCartMerge,
} from "../utils/guestCart.js";

const CART_CHANGED_EVENT = "authenticated-cart-changed";

function isValidSession(session) {
  return Boolean(session?.token && session.user?.id != null);
}

function notifyAuthenticatedCartChanged() {
  window.dispatchEvent(new Event(CART_CHANGED_EVENT));
}

export default function useCart() {
  const [session, setSession] = useState(getAuthSession);

  const [items, setItems] = useState(() =>
    isValidSession(getAuthSession()) ? [] : getGuestCart()
  );

  const [loading, setLoading] = useState(() =>
    isValidSession(getAuthSession())
  );

  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const currentSession = getAuthSession();
    setSession(currentSession);

    if (!isValidSession(currentSession)) {
      const guestItems = getGuestCart();

      setItems(guestItems);
      setError("");
      setLoading(false);

      return guestItems;
    }

    setLoading(true);
    setError("");

    let mergeError = "";

    try {
      try {
        await waitForGuestCartMerge();

        if (getGuestCart().length > 0) {
          await mergeGuestCartAfterLogin(
            currentSession.token,
            import.meta.env.VITE_API_BASE_URL || ""
          );
        }
      } catch (mergeFailure) {
        mergeError = `Guest cart sync failed: ${mergeFailure.message}`;
      }

      const result = await getAuthenticatedCart(
        currentSession.token
      );

      if (!Array.isArray(result?.items)) {
        throw new Error(
          "The server returned an invalid cart response."
        );
      }

      if (getAuthSession()?.token === currentSession.token) {
        setItems(result.items);
        setError(mergeError);
      }

      return result.items;
    } catch (requestError) {
      if (requestError.status === 401) {
        clearAuthSession();
        setSession(null);
        setItems([]);
        setError(
          "Your session has expired. Please sign in again."
        );
      } else {
        setError(requestError.message);
      }

      throw requestError;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const load = () => {
      if (!active) return;

      refresh().catch(() => {
        // Errors are stored in the hook state.
      });
    };

    const unsubscribe = subscribeToGuestCart(() => {
      if (active && !isValidSession(getAuthSession())) {
        setItems(getGuestCart());
      }
    });

    const onSessionChange = (event) => {
      if (
        event.key === "vinyl-store-auth-session" ||
        event.key === null
      ) {
        load();
      }
    };

    window.addEventListener("storage", onSessionChange);
    window.addEventListener(CART_CHANGED_EVENT, load);

    load();

    return () => {
      active = false;
      unsubscribe();

      window.removeEventListener("storage", onSessionChange);
      window.removeEventListener(CART_CHANGED_EVENT, load);
    };
  }, [refresh]);

  function add(productId, quantity = 1, stock) {
    const currentSession = getAuthSession();

    if (!isValidSession(currentSession)) {
      return addToGuestCart(
        Number(productId),
        quantity,
        Number(stock)
      );
    }

    return (async () => {
      await waitForGuestCartMerge();

      await addAuthenticatedCartItem(
        currentSession.token,
        Number(productId),
        quantity
      );

      const updatedItems = await refresh();

      notifyAuthenticatedCartChanged();

      return updatedItems.find(
        (item) =>
          Number(item.productId) === Number(productId)
      );
    })();
  }

  function update(productId, quantity, stock) {
    const currentSession = getAuthSession();

    if (!isValidSession(currentSession)) {
      return updateGuestCartItem(
        Number(productId),
        quantity,
        Number(stock)
      );
    }

    if (quantity === 0) {
      return remove(productId);
    }

    return (async () => {
      await waitForGuestCartMerge();

      await updateAuthenticatedCartItem(
        currentSession.token,
        Number(productId),
        quantity
      );

      const updatedItems = await refresh();

      notifyAuthenticatedCartChanged();

      return updatedItems;
    })();
  }

  function remove(productId) {
    const currentSession = getAuthSession();

    if (!isValidSession(currentSession)) {
      return removeFromGuestCart(Number(productId));
    }

    return (async () => {
      await waitForGuestCartMerge();

      await removeAuthenticatedCartItem(
        currentSession.token,
        Number(productId)
      );

      const updatedItems = await refresh();

      notifyAuthenticatedCartChanged();

      return updatedItems;
    })();
  }

  return {
    items,
    loading,
    error,
    isAuthenticated: isValidSession(session),
    add,
    update,
    remove,
    refresh,
  };
}
