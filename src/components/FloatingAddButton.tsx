import { Link, useLocation } from "react-router-dom";

export function FloatingAddButton({ tripId }: { tripId: string }) {
  const loc = useLocation();
  if (loc.pathname.includes("/add")) return null;
  return (
    <Link
      to={`/trip/${tripId}/add`}
      className="fab-add"
      aria-label="Add expense"
    >
      <span className="fab-add__plus" aria-hidden>
        +
      </span>
      <span className="fab-add__label">Add expense</span>
    </Link>
  );
}
