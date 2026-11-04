// Centralizes catalog cart writes so preview records cannot enter the guest cart.
import { addToGuestCart } from "./guestCart.js";

export function addCatalogProductToCart(product, isPreview) {
  if (isPreview) return false;

  addToGuestCart(
    Number(product.id),
    1,
    Number(product.quantity)
  );
  return true;
}
