import { useCallback, useEffect, useRef, useState } from "react";

const DISMISS_DELAY = 2500;
const EXIT_ANIMATION_DURATION = 180;

export default function useCartToast() {
  const [notification, setNotification] = useState(null);
  const timer = useRef(null);
  const exitTimer = useRef(null);
  const nextId = useRef(0);

  const clearTimers = useCallback(() => {
    window.clearTimeout(timer.current);
    window.clearTimeout(exitTimer.current);
    timer.current = null;
    exitTimer.current = null;
  }, []);

  const showCartToast = useCallback((productName, quantity) => {
    clearTimers();
    setNotification({
      id: ++nextId.current,
      productName,
      quantity,
      isExiting: false,
    });
    timer.current = window.setTimeout(() => {
      setNotification(null);
      timer.current = null;
    }, DISMISS_DELAY);
  }, [clearTimers]);

  const dismissCartToast = useCallback(() => {
    clearTimers();
    setNotification((current) => (
      current ? { ...current, isExiting: true } : null
    ));
    exitTimer.current = window.setTimeout(() => {
      setNotification(null);
      exitTimer.current = null;
    }, EXIT_ANIMATION_DURATION);
  }, [clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  return { notification, showCartToast, dismissCartToast };
}
