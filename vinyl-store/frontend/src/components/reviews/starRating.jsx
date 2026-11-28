import { useState } from "react";

const STARS = [1, 2, 3, 4, 5];

// Five clickable stars. `value` is the saved rating (0 = none yet). Whole stars only,
// because the API rejects anything but 1 to 5.
export default function StarRating({
  value = 0,
  onChange,
  disabled = false,
  label = "Your rating",
}) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <div className="star-rating" role="radiogroup" aria-label={label}>
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
          className={`star-button${star <= shown ? " is-filled" : ""}`}
          disabled={disabled}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onFocus={() => setHovered(star)}
          onBlur={() => setHovered(0)}
        >
          <span aria-hidden="true">★</span>
        </button>
      ))}
    </div>
  );
}
