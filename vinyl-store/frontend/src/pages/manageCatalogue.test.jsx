import { fireEvent, render, screen } from "@testing-library/react";
import ManageCatalogue from "./manageCatalogue.jsx";
import { saveAuthSession } from "../utils/authSession.js";

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

test("loads record options and submits the record without an empty optional cost", async () => {
  saveAuthSession({ token: "manager-token", user: { role: "PRODUCT_MANAGER" } });
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({
      categories: [{ id: 12, name: "Vinyl" }],
      artists: [],
      genres: [],
    }))
    .mockResolvedValueOnce(Response.json({ id: 23 }, { status: 201 }));
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
  expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/products\/options$/);
  const [url, request] = fetchMock.mock.calls[1];
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
