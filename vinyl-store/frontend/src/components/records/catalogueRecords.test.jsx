import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import CatalogueRecords from "./catalogueRecords.jsx";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("requires confirmation, keeps a record after failure, and reloads after removal", async () => {
  const record = { id: 17, name: "Blue Train", serialNumber: "BT-17" };
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json([record]))
    .mockResolvedValueOnce(Response.json({ error: "Removal temporarily unavailable" }, { status: 503 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(Response.json([]));
  vi.stubGlobal("fetch", fetchMock);
  const confirm = vi.spyOn(window, "confirm")
    .mockReturnValueOnce(false)
    .mockReturnValue(true);

  render(<CatalogueRecords token="manager-token" version={0} />);
  const remove = await screen.findByRole("button", { name: "Remove Blue Train" });

  fireEvent.click(remove);
  expect(confirm).toHaveBeenCalledWith("Remove “Blue Train” from the catalogue?");
  expect(fetchMock).toHaveBeenCalledTimes(1);

  fireEvent.click(remove);
  expect(await screen.findByRole("alert")).toHaveTextContent("Removal temporarily unavailable");
  expect(remove).toBeEnabled();
  expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringMatching(/\/api\/products\/17$/),
    expect.objectContaining({
      method: "DELETE",
      headers: { Authorization: "Bearer manager-token" },
    }));

  fireEvent.click(remove);
  await screen.findByText("Removed Blue Train from the catalogue.");
  await waitFor(() => expect(screen.queryByText("Blue Train")).not.toBeInTheDocument());
  expect(await screen.findByText("No records in the catalogue.")).toBeInTheDocument();
});
