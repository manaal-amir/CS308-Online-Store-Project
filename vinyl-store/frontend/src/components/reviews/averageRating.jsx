
export default function AverageRating({ averageRating, ratingCount }) {
  if (averageRating == null || ratingCount == null) {
    return null;
  }

  const average = Number(averageRating);
  const count = Number(ratingCount);

  if (!Number.isFinite(count) || count < 0) {
    return null;
  }

  if (count === 0) {
    return <p className="average-rating">No ratings yet</p>;
  }

  if (!Number.isFinite(average) || average < 0 || average > 5) {
    return null;
  }

  return (
    <p className="average-rating" aria-label={`Average rating ${average.toFixed(1)} out of 5, from ${count} ratings`}>
      <span aria-hidden="true">★</span>
      {" "}{average.toFixed(1)} / 5 ({count} ratings)
    </p>
  );
}
