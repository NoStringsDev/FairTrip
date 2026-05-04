import type { CurrencyCode, Trip, TripEntity } from "../types";

export const LEGACY_HUNTERS_ID = "legacy-hunters";
export const LEGACY_BARRIGAULTS_ID = "legacy-barrigaults";

const DEFAULT_ENTITIES: TripEntity[] = [
  {
    id: LEGACY_HUNTERS_ID,
    name: "Hunters",
    kind: "couple",
    colorIndex: 0,
  },
  {
    id: LEGACY_BARRIGAULTS_ID,
    name: "Barrigaults",
    kind: "couple",
    colorIndex: 1,
  },
];

export function normalizeTrip(trip: Trip): Trip {
  const entities =
    trip.entities && trip.entities.length >= 2
      ? trip.entities
      : DEFAULT_ENTITIES;
  const supported: CurrencyCode[] =
    trip.supportedCurrencies && trip.supportedCurrencies.length > 0
      ? trip.supportedCurrencies
      : [trip.homeCurrency ?? "GBP", trip.tripCurrency ?? "JPY"];
  return {
    ...trip,
    entities,
    supportedCurrencies: supported,
    homeCurrency: trip.homeCurrency ?? "GBP",
    tripCurrency: trip.tripCurrency ?? "JPY",
    settlementCurrency: trip.settlementCurrency ?? "GBP",
  };
}

export function entityById(trip: Trip, id: string): TripEntity | undefined {
  return normalizeTrip(trip).entities.find((e) => e.id === id);
}
