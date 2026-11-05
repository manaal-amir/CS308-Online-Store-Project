// Formatting helpers for the product detail page.

export function relationName(value) {
  return typeof value === "object" && value !== null ? value.name : value;
}

export function formatPrice(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

// Stock label shown next to the price (VS-10). Quantity comes straight from the API.
export function stockLabel(quantity) {
  const stock = Number(quantity);
  if (!Number.isFinite(stock) || stock <= 0) return "Out of stock";
  if (stock <= 5) return `Only ${stock} left in stock`;
  return `${stock} in stock`;
}

// Missing values render as an em dash instead of "undefined" or an empty cell.
export function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}
