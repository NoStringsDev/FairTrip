import type { Trip, TripEntity } from "../types";
import { stylesForEntity } from "../theme/entities";
import { normalizeTrip } from "../lib/tripNormalize";

export function EntityChip({
  entity,
  size = "md",
}: {
  entity: TripEntity;
  size?: "sm" | "md";
}) {
  const c = stylesForEntity(entity);
  const pad = size === "sm" ? "3px 10px" : "5px 12px";
  const font = size === "sm" ? "0.72rem" : "0.8rem";
  const kind =
    entity.kind === "couple" ? "Couple" : "Individual";
  return (
    <span
      className="chip"
      title={`${entity.name} (${kind})`}
      style={{
        background: c.bg,
        borderColor: c.border,
        color: c.text,
        padding: pad,
        fontSize: font,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 99,
          background: c.chip,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      <span>{entity.name}</span>
    </span>
  );
}

export function EntityChipById({
  trip,
  entityId,
  size = "md",
}: {
  trip: Trip;
  entityId: string;
  size?: "sm" | "md";
}) {
  const entity = normalizeTrip(trip).entities.find((e) => e.id === entityId);
  if (!entity) {
    return (
      <span className="chip" style={{ fontSize: "0.75rem" }}>
        Unknown
      </span>
    );
  }
  return <EntityChip entity={entity} size={size} />;
}
