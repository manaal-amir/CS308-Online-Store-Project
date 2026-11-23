import { useEffect, useState } from "react";
import { addProduct, getProductOptions } from "../services/manageProductsApi.js";
import { getAuthSession } from "../utils/authSession.js";
import "../styles/manageCatalogue.css";

const textFields = [
  ["name", "Record name"],
  ["model", "Edition"],
  ["serialNumber", "Serial number"],
  ["distributor", "Distributor"],
  ["warrantyStatus", "Warranty status"],
];

function OptionField({ name, label, options, required = false }) {
  return (
    <label>
      {label}
      <select name={name} required={required} defaultValue="">
        <option value="">{required ? `Select ${label.toLowerCase()}` : "None"}</option>
        {options.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>
  );
}

export default function ManageCatalogue() {
  const token = getAuthSession()?.token;
  const [options, setOptions] = useState(null);
  const [optionsError, setOptionsError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getProductOptions(token, controller.signal)
      .then(setOptions)
      .catch((failure) => {
        if (!controller.signal.aborted) setOptionsError(failure.message);
      });
    return () => controller.abort();
  }, [token, attempt]);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const record = Object.fromEntries(
      Array.from(values)
        .map(([name, value]) => [name, value.trim()])
        .filter(([, value]) => value !== ""),
    );

    setError("");
    setSuccess("");
    if ([...textFields.map(([name]) => name), "description"].some((name) => !record[name])) {
      setError("Fill in all required record details.");
      return;
    }
    for (const name of ["price", "cost", "quantity", "categoryId", "artistId", "genreId"]) {
      if (name in record) record[name] = Number(record[name]);
    }

    setSaving(true);
    try {
      await addProduct(token, record);
      form.reset();
      setSuccess(`Added ${record.name} to the catalogue.`);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h1>Catalogue</h1>
      <h2>Add a record</h2>
      {optionsError && (
        <div role="alert">
          <p>Could not load catalogue options. {optionsError}</p>
          <button type="button" onClick={() => {
            setOptionsError("");
            setAttempt((value) => value + 1);
          }}>Try again</button>
        </div>
      )}
      {!options && !optionsError && <p role="status">Loading catalogue options…</p>}
      {options && (
        <form onSubmit={submit} className="catalogue-form">
          <fieldset disabled={saving}>
            <legend>Record details</legend>
            {textFields.map(([name, label]) => (
              <label key={name}>{label}<input name={name} required /></label>
            ))}
            <OptionField name="categoryId" label="Category" options={options.categories} required />
            <OptionField name="artistId" label="Artist" options={options.artists} />
            <OptionField name="genreId" label="Genre" options={options.genres} />
            <label>Stock quantity<input name="quantity" type="number" min="0" max="2147483647" step="1" required /></label>
            <label>Selling price<input name="price" type="number" min="0" max="99999999.99" step="0.01" required /></label>
            <label>Cost price (optional)<input name="cost" type="number" min="0" max="99999999.99" step="0.01" /></label>
            <label>Cover image URL (optional)<input name="imageUrl" type="url" /></label>
            <label className="catalogue-form-description">
              Description<textarea name="description" rows="4" required />
            </label>
            <button type="submit">{saving ? "Adding record…" : "Add record"}</button>
          </fieldset>
          {error && <p role="alert">{error}</p>}
          {success && <p role="status">{success}</p>}
        </form>
      )}
    </section>
  );
}
