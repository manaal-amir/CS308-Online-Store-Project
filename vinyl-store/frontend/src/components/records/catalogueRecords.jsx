import { useEffect, useState } from "react";
import { getProducts } from "../../services/api.js";
import { removeProduct, updateProductStock } from "../../services/manageProductsApi.js";

const MAX_STOCK = 2147483647;

export default function CatalogueRecords({ token, version }) {
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(null);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const current = result?.version === version && result.attempt === attempt ? result : null;

  useEffect(() => {
    const controller = new AbortController();
    getProducts(controller.signal)
      .then((records) => {
        if (!controller.signal.aborted) setResult({ version, attempt, records });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ version, attempt, error: error.message });
      });
    return () => controller.abort();
  }, [version, attempt]);

  async function handleRemove(record) {
    if (pending || !window.confirm(`Remove “${record.name}” from the catalogue?`)) return;

    setPending({ id: record.id, action: "remove" });
    setActionError("");
    setNotice("");
    try {
      await removeProduct(token, record.id);
      setNotice(`Removed ${record.name} from the catalogue.`);
      setAttempt((value) => value + 1);
    } catch (error) {
      setActionError(`Could not remove ${record.name}. ${error.message}`);
    } finally {
      setPending(null);
    }
  }

  async function handleStockUpdate(event, record) {
    event.preventDefault();
    if (pending) return;

    const quantity = event.currentTarget.elements.namedItem("quantity").valueAsNumber;
    setNotice("");
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_STOCK) {
      setActionError("Enter a valid whole-number stock quantity of zero or more.");
      return;
    }

    setPending({ id: record.id, action: "stock" });
    setActionError("");
    try {
      await updateProductStock(token, record.id, quantity);
      setNotice(`Updated stock for ${record.name}.`);
      setAttempt((value) => value + 1);
    } catch (error) {
      setActionError(`Could not update stock for ${record.name}. ${error.message}`);
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="catalogue-records">
      <h2>Current records</h2>
      {notice && <p role="status">{notice}</p>}
      {actionError && <p role="alert">{actionError}</p>}
      {!current && <p role="status">Loading records…</p>}
      {current?.error && (
        <div role="alert">
          <p>Could not load records. {current.error}</p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry loading records</button>
        </div>
      )}
      {current?.records?.length === 0 && <p>No records in the catalogue.</p>}
      {current?.records?.length > 0 && (
        <ul className="order-list">
          {current.records.map((record) => (
            <li key={record.id}>
              <div>
                <strong>{record.name}</strong>
                {record.serialNumber && <small>{record.serialNumber}</small>}
              </div>
              <div className="catalogue-record-actions">
                <form className="catalogue-stock-form" onSubmit={(event) => handleStockUpdate(event, record)}>
                  <label>
                    Stock
                    <input
                      name="quantity"
                      type="number"
                      aria-label={`Stock for ${record.name}`}
                      min="0"
                      max={MAX_STOCK}
                      step="1"
                      defaultValue={record.quantity}
                      required
                      disabled={Boolean(pending)}
                    />
                  </label>
                  <button type="submit" aria-label={`Save stock for ${record.name}`} disabled={Boolean(pending)}>
                    {pending?.id === record.id && pending.action === "stock" ? "Saving…" : "Save stock"}
                  </button>
                </form>
                <button
                  type="button"
                  aria-label={`Remove ${record.name}`}
                  disabled={Boolean(pending)}
                  onClick={() => handleRemove(record)}
                >
                  {pending?.id === record.id && pending.action === "remove" ? "Removing…" : "Remove"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
