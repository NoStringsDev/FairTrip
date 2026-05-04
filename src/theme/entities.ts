import type { TripEntity } from "../types";

export const ENTITY_PALETTE: Array<{
  bg: string;
  border: string;
  text: string;
  chip: string;
}> = [
  {
    bg: "rgba(59, 130, 246, 0.14)",
    border: "rgba(59, 130, 246, 0.5)",
    text: "#1e3a8a",
    chip: "#3b82f6",
  },
  {
    bg: "rgba(244, 114, 182, 0.16)",
    border: "rgba(236, 72, 153, 0.55)",
    text: "#831843",
    chip: "#ec4899",
  },
  {
    bg: "rgba(16, 185, 129, 0.14)",
    border: "rgba(16, 185, 129, 0.45)",
    text: "#064e3b",
    chip: "#10b981",
  },
  {
    bg: "rgba(245, 158, 11, 0.18)",
    border: "rgba(245, 158, 11, 0.55)",
    text: "#78350f",
    chip: "#f59e0b",
  },
  {
    bg: "rgba(139, 92, 246, 0.14)",
    border: "rgba(139, 92, 246, 0.45)",
    text: "#4c1d95",
    chip: "#8b5cf6",
  },
  {
    bg: "rgba(14, 165, 233, 0.14)",
    border: "rgba(14, 165, 233, 0.45)",
    text: "#0c4a6e",
    chip: "#0ea5e9",
  },
];

export function stylesForEntity(entity: TripEntity) {
  return ENTITY_PALETTE[entity.colorIndex % ENTITY_PALETTE.length];
}
