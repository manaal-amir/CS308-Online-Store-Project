
import { getAuthSession } from "./authSession.js";

export function getCheckoutDestination() {
  const session = getAuthSession();

  return session?.token
    ? "/checkout"
    : "/sign-in?returnTo=%2Fcheckout";
}
