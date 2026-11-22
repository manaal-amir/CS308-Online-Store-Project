// Display helpers for order statuses and dates.

const STATUS_LABELS = {
  PROCESSING: "Processing",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? String(status ?? "Unknown");
}

// CSS modifier for the status badge, e.g. "in-transit".
export function statusClass(status) {
  return String(status ?? "unknown").toLowerCase().replace(/_/g, "-");
}

export function formatOrderDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

// The only status an order may move to next (mirrors the API's rules).
const NEXT_STATUS = { PROCESSING: "IN_TRANSIT", IN_TRANSIT: "DELIVERED" };

export function nextStatus(status) {
  return NEXT_STATUS[status] ?? null;
}
