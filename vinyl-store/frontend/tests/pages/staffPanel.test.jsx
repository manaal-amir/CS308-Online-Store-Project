import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "../../src/App.jsx";
import { saveAuthSession } from "../../src/utils/authSession.js";

function openManagerPage(path, role) {
  window.history.replaceState(null, "", path);
  if (role) saveAuthSession({ token: "staff-token", user: { id: 1, role } });
  return render(<App />);
}

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

test("product managers can open deliveries directly and see the active menu item", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));
  openManagerPage("/manager/deliveries", "PRODUCT_MANAGER");

  const menu = within(screen.getByRole("navigation", { name: /staff menu/i }));
  expect(menu.getByRole("link", { name: /overview/i })).toHaveAttribute("href", "/manager");
  expect(menu.getByRole("link", { name: /deliveries/i })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("heading", { name: /delivery list/i })).toBeVisible();
  await screen.findByText(/no deliveries match/i);
});

test.each(["SALES_MANAGER", "SUPPORT_AGENT"])("%s sees their overview without product tools", (role) => {
  openManagerPage("/manager", role);
  const menu = within(screen.getByRole("navigation", { name: /staff menu/i }));
  expect(menu.getByRole("link", { name: /overview/i })).toHaveAttribute("aria-current", "page");
  expect(menu.queryByRole("link", { name: /catalogue|deliveries|comment/i })).toBeNull();
});

describe("direct access to deliveries", () => {
  const path = "/manager/deliveries";
  test.each(["CUSTOMER", "SALES_MANAGER", "SUPPORT_AGENT", "UNKNOWN"])("blocks %s before loading product tools", (role) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    openManagerPage(path, role);
    const main = within(screen.getByRole("main"));
    expect(main.getByRole("alert")).toBeVisible();
    expect(main.queryByRole("heading", { name: /delivery list/i })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("prompts signed-out visitors to sign in and preserves the requested page", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    openManagerPage(path);
    const main = within(screen.getByRole("main"));
    const signIn = new URL(main.getByRole("link", { name: /sign in/i }).href);
    expect(signIn.pathname).toBe("/sign-in");
    expect(signIn.searchParams.get("returnTo")).toBe(path);
    expect(main.queryByRole("navigation", { name: /staff menu/i })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
