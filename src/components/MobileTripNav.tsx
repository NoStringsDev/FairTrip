import { NavLink, useLocation } from "react-router-dom";

export function MobileTripNav({ tripId }: { tripId: string }) {
  const base = `/trip/${tripId}`;
  const location = useLocation();
  const onHistory = location.pathname.includes("/history");
  return (
    <div
      className={`mobile-trip-nav-toggle${onHistory ? " mobile-trip-nav-toggle--history" : ""}`}
      role="navigation"
      aria-label="Trip sections"
    >
      <span className="mobile-trip-nav-toggle__thumb" aria-hidden />
      <NavLink
        to={`${base}/balance`}
        className={({ isActive }) =>
          `mobile-trip-nav-toggle__btn${isActive ? " mobile-trip-nav-toggle__btn--active" : ""}`
        }
      >
        Balance
      </NavLink>
      <NavLink
        to={`${base}/history`}
        className={({ isActive }) =>
          `mobile-trip-nav-toggle__btn${isActive ? " mobile-trip-nav-toggle__btn--active" : ""}`
        }
      >
        History
      </NavLink>
    </div>
  );
}
