// Tests for the order status and date display helpers.
import { describe, expect, test } from "vitest";
import { formatOrderDate, statusClass, statusLabel } from "./orderStatus.js";

describe("statusLabel", () => {
  test.each([
    ["PROCESSING", "Processing"],
    ["IN_TRANSIT", "In transit"],
    ["DELIVERED", "Delivered"],
    ["CANCELLED", "Cancelled"],
  ])("labels %s as %s", (status, label) => {
    expect(statusLabel(status)).toBe(label);
  });

  test("shows an unknown status as it is, and a missing one as Unknown", () => {
    expect(statusLabel("REFUNDED")).toBe("REFUNDED");
    expect(statusLabel(undefined)).toBe("Unknown");
  });
});

describe("statusClass", () => {
  test("turns a status into a css modifier", () => {
    expect(statusClass("IN_TRANSIT")).toBe("in-transit");
    expect(statusClass("PROCESSING")).toBe("processing");
    expect(statusClass(null)).toBe("unknown");
  });
});

describe("formatOrderDate", () => {
  test("formats an ISO date as day, short month and year", () => {
    expect(formatOrderDate("2026-11-20T12:00:00.000Z")).toBe("20 Nov 2026");
  });

  test("shows a dash for a missing or invalid date", () => {
    expect(formatOrderDate("not a date")).toBe("—");
    expect(formatOrderDate(undefined)).toBe("—");
  });
});
