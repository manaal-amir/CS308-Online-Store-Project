import { useEffect, useState } from "react";
import { getProducts } from "../../services/api.js";
import { removeProduct } from "../../services/manageProductsApi.js";

export default function CatalogueRecords({ token, version }) {
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [removingId, setRemovingId] = useState(null);
  const [removeError, setRemoveError] = useState("");
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
    if (removingId !== null || !window.confirm(`Remove “${record.name}” from the catalogue?`)) return;

    setRemovingId(record.id);
    setRemoveError("");
    setNotice("");
    try {
      await removeProduct(token, record.id);
      setNotice(`Removed ${record.name} from the catalogue.`);
      setAttempt((value) => value + 1);
    } catch (error) {
      setRemoveError(`Could not remove ${record.name}. ${error.message}`);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="catalogue-records">
      <h2>Current records</h2>
      {notice && <p role="status">{notice}</p>}
      {removeError && <p role="alert">{removeError}</p>}
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
              <button
                type="button"
                aria-label={`Remove ${record.name}`}
                disabled={removingId !== null}
                onClick={() => handleRemove(record)}
              >
                {removingId === record.id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
