import type { CurrencyCode } from "../types";

export interface CurrencyOption {
  code: CurrencyCode;
  label: string;
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: "GBP", label: "GBP - British Pound" },
  { code: "USD", label: "USD - US Dollar" },
  { code: "EUR", label: "EUR - Euro" },
  { code: "JPY", label: "JPY - Japanese Yen" },
  { code: "AUD", label: "AUD - Australian Dollar" },
  { code: "CAD", label: "CAD - Canadian Dollar" },
  { code: "NZD", label: "NZD - New Zealand Dollar" },
  { code: "CHF", label: "CHF - Swiss Franc" },
  { code: "SEK", label: "SEK - Swedish Krona" },
  { code: "NOK", label: "NOK - Norwegian Krone" },
  { code: "DKK", label: "DKK - Danish Krone" },
  { code: "PLN", label: "PLN - Polish Zloty" },
  { code: "CZK", label: "CZK - Czech Koruna" },
  { code: "HUF", label: "HUF - Hungarian Forint" },
  { code: "RON", label: "RON - Romanian Leu" },
  { code: "TRY", label: "TRY - Turkish Lira" },
  { code: "CNY", label: "CNY - Chinese Yuan" },
  { code: "HKD", label: "HKD - Hong Kong Dollar" },
  { code: "SGD", label: "SGD - Singapore Dollar" },
  { code: "KRW", label: "KRW - South Korean Won" },
  { code: "INR", label: "INR - Indian Rupee" },
];

export const DEFAULT_HOME_CURRENCY: CurrencyCode = "GBP";
export const DEFAULT_TRIP_CURRENCY: CurrencyCode = "USD";

export function labelForCurrency(code: CurrencyCode): string {
  return CURRENCY_OPTIONS.find((c) => c.code === code)?.label ?? code;
}

