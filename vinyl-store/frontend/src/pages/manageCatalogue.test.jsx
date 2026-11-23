import { fireEvent, render, screen } from "@testing-library/react";
import ManageCatalogue from "./manageCatalogue.jsx";
import { saveAuthSession } from "../utils/authSession.js";

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

test("loads record options and submits the record without an empty optional cost", async () => {
  saveAuthSession({ token: "manager-token", user: { role: "PRODUCT_MANAGER" } });
  const fetchMock = vi.fn(async (url, request) => {
    if (url.endsWith("/options")) {
      return Response.json({
        categories: [{ id: 12, name: "Vinyl" }],
        artists: [],
        genres: [],
      });
    }
    if (request.method === "POST") return Response.json({ id: 23 }, { status: 201 });
    return Response.json([]);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<ManageCatalogue />);

  await screen.findByRole("option", { name: "Vinyl" });
  for (const [label, value] of [
    ["Record name", "Example record"],
    ["Edition", "First pressing"],
    ["Serial number", "VR-123"],
    ["Distributor", "Example label"],
    ["Warranty status", "Covered"],
    ["Category", "12"],
    ["Stock quantity", "0"],
    ["Selling price", "25.50"],
    ["Description", "A new record."],
  ]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Add record" }));

  await screen.findByText("Added Example record to the catalogue.");
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/api/products/options"))).toBe(true);
  const [url, request] = fetchMock.mock.calls.find(([, request]) => request.method === "POST");
  expect(url).toMatch(/\/api\/products$/);
  expect(request.method).toBe("POST");
  expect(request.headers.Authorization).toBe("Bearer manager-token");
  expect(JSON.parse(request.body)).toEqual({
    name: "Example record",
    model: "First pressing",
    serialNumber: "VR-123",
    distributor: "Example label",
    warrantyStatus: "Covered",
    categoryId: 12,
    quantity: 0,
    price: 25.5,
    description: "A new record.",
  });
});
