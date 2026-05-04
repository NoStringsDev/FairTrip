import { NavLink } from "react-router-dom";

export function MobileTripNav({ tripId }: { tripId: string }) {
  const base = `/trip/${tripId}`;
  return (
    <div className="mobile-trip-nav" role="navigation" aria-label="Trip sections">
      <NavLink
        to={`${base}/balance`}
        className={({ isActive }) =>
          `mobile-trip-nav__btn${isActive ? " mobile-trip-nav__btn--active" : ""}`
        }
      >
        Balance
      </NavLink>
      <NavLink
        to={`${base}/history`}
        className={({ isActive }) =>
          `mobile-trip-nav__btn${isActive ? " mobile-trip-nav__btn--active" : ""}`
        }
      >
        History
      </NavLink>
    </div>
  );
}
