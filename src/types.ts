/** ISO currencies supported for entry (FX auto for non-GBP via Frankfurter where available). */
export type CurrencyCode = "GBP" | "JPY" | "EUR" | "USD";

export type QuoteCurrency = Exclude<CurrencyCode, "GBP">;

export type EntityKind = "couple" | "individual";

export interface TripEntity {
  id: string;
  name: string;
  kind: EntityKind;
  /** Index into shared colour palette (0 = blue, 1 = pink, …) */
  colorIndex: number;
}

export type SplitMode = "shared_equal" | "single";

export type ConversionMode = "auto" | "manualOverride";

export type FxRetrievalType = "historical" | "currentFallback";

export interface Trip {
  id: string;
  name: string;
  /** Free-form notes (e.g. flight dates, hotel). */
  tripNotes?: string;
  /** Optional headcount for reference only. */
  participantCount?: number;
  /** Currencies allowed when logging expenses (subset of CurrencyCode). */
  supportedCurrencies: CurrencyCode[];
  homeCurrency: CurrencyCode;
  tripCurrency: CurrencyCode;
  settlementCurrency: Extract<CurrencyCode, "GBP">;
  tripCode: string;
  /** Who balances are tracked between (2–6). */
  entities: TripEntity[];
  createdAt: number;
  closedAt?: number;
  updatedAt: number;
}

/** Legacy literals stored in older IndexedDB rows. */
export type LegacyCoupleId = "Hunters" | "Barrigaults";
export type LegacyAssignedTo = LegacyCoupleId | "Shared50_50";

export interface Expense {
  id: string;
  tripId: string;
  amountMinorUnits: number;
  currencyCode: CurrencyCode;
  payerEntityId: string;
  splitMode: SplitMode;
  /** When splitMode === "single", who the whole expense is for. */
  beneficiaryEntityId?: string;
  note: string;
  category: string;
  expenseTimestamp: number;
  receiptLocalBlobId?: string;
  receiptR2Key?: string;
  updatedAt: number;
  deletedAt?: number;
  manualGbpMinorUnits?: number;
  conversionMode: ConversionMode;
  fxRateUsed?: number;
  fxRateDateUsed?: string;
  fxRetrievalType?: FxRetrievalType;
  convertedGbpMinorUnits?: number;
  /** Present only on legacy rows before migration. */
  payerCouple?: LegacyCoupleId;
  assignedTo?: LegacyAssignedTo;
}

export interface ReceiptParseDraft {
  detectedMerchant?: string;
  detectedTotalMinorUnits?: number;
  detectedCurrencyCode?: CurrencyCode;
  detectedDate?: string;
  confidence?: number;
  rawText?: string;
}

export interface FxRateRow {
  id: string;
  rateDate: string;
  base: "GBP";
  quote: QuoteCurrency;
  /** GBP per 1 major unit of `quote`. */
  gbpPerUnit: number;
  retrievalType: FxRetrievalType;
  fetchedAt: number;
}

export type SyncStatus = "local" | "pending" | "synced";
