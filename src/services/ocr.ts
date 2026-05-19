import Tesseract from "tesseract.js";
import type { CurrencyCode, ReceiptParseDraft } from "../types";
import { minorUnitsFor } from "../domain/currency";

/** Amounts adjacent to common receipt labels (per line; contact lines skipped). */
const amountRegexes = [
  /(?:TOTAL|GRAND\s+TOTAL|AMOUNT\s*DUE|BALANCE\s*DUE|NET\s+DUE|AMOUNT|DUE|PAYABLE|CHANGE|SUBTOTAL|合計|計\s|税込|税抜|お預り|預り|売上|¥\s*|£\s*|€\s*)\s*[:\s]*([£¥€]?\s*[\d,]+(?:\.\d{1,2})?)/gi,
  /([£¥€]\s*[\d,]+(?:\.\d{1,2})?)/g,
  /(?:^|\s)([\d,]+(?:\.\d{1,2})?)\s*(?:GBP|JPY|EUR|USD|円)/gi,
];

/** Lines where a loose digit scan may pick up the real total (footer + labelled rows). */
const totalishLine =
  /\b(total|amount\s*due|balance\s*due|grand\s*total|net\s*total|subtotal|payable|change|合計|税込|税抜|預り|お預り|売上|円)\b|£\s*[\d,]|€\s*[\d,]|\$\s*[\d,]|¥\s*[\d,]/i;

function detectCurrency(text: string): CurrencyCode {
  if (/£|GBP/i.test(text)) return "GBP";
  if (/\bUSD\b|\$\s*[\d,]/.test(text)) return "USD";
  if (/\bEUR\b|€/.test(text)) return "EUR";
  if (/円|JPY|¥/.test(text)) return "JPY";
  return "JPY";
}

function parseAmountFromMatch(raw: string, currency: CurrencyCode): number | null {
  const cleaned = raw.replace(/[£¥€,\s]/g, "").replace(/,/g, "");
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * minorUnitsFor(currency));
}

function isLikelyContactOrHeaderLine(line: string): boolean {
  return /\b(tel|telephone|fax|phone|mobile|mob\.?|e-?mail|www\.|https?:\/\/|vat\s*no|abn|company\s*no)\b/i.test(
    line
  );
}

/** Digit runs that look like phone numbers, card refs, or order IDs — not menu prices. */
function isLikelyNonAmountNumeral(token: string, currency: CurrencyCode): boolean {
  const trimmed = token.trim();
  const noComma = trimmed.replace(/,/g, "");
  const hasDecimal = /\.\d{1,2}$/.test(noComma);
  if (hasDecimal) return false;

  const digits = noComma.replace(/\D/g, "");
  if (digits.length >= 10) return true;
  if (minorUnitsFor(currency) === 1 && digits.length >= 9) return true;
  return false;
}

function ocrLooseSearchRegion(fullText: string): string {
  const lines = fullText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const tail = lines.slice(-10).filter((l) => !isLikelyContactOrHeaderLine(l));
  const keyed = lines.filter((l) => totalishLine.test(l) && !isLikelyContactOrHeaderLine(l));
  return [...new Set([...keyed, ...tail])].join("\n");
}

function collectStructuredAmounts(text: string, currency: CurrencyCode): number[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const found: number[] = [];
  for (const line of lines) {
    if (isLikelyContactOrHeaderLine(line)) continue;
    for (const re of amountRegexes) {
      const lineRe = new RegExp(re.source, re.flags);
      let m: RegExpExecArray | null;
      while ((m = lineRe.exec(line)) !== null) {
        const raw = (m[1] ?? m[0]).trim();
        if (isLikelyNonAmountNumeral(raw, currency)) continue;
        const minor = parseAmountFromMatch(raw, currency);
        if (minor != null && minor > 0) found.push(minor);
      }
    }
  }
  return found;
}

function collectLooseAmounts(text: string, currency: CurrencyCode): number[] {
  const found: number[] = [];
  const loose = text.match(/[\d,]+(?:\.\d{1,2})?/g);
  if (!loose) return found;
  for (const s of loose) {
    if (isLikelyNonAmountNumeral(s, currency)) continue;
    const minor = parseAmountFromMatch(s, currency);
    if (minor != null && minor > 0) found.push(minor);
  }
  return found;
}

/**
 * Best guess for the receipt total from OCR text. Prefer label/symbol matches on
 * non-contact lines; only scan "loose" numbers in the footer and total-ish lines
 * so header phone numbers do not win as the largest digit run.
 */
export function extractReceiptTotalMinorUnits(
  text: string,
  currency: CurrencyCode
): number | null {
  const structured = collectStructuredAmounts(text, currency);
  const structuredBest = structured.length ? Math.max(...structured) : null;

  const regional = ocrLooseSearchRegion(text);
  const looseRegional = collectLooseAmounts(regional, currency);
  const looseBest = looseRegional.length ? Math.max(...looseRegional) : null;

  if (structuredBest != null && looseBest != null) {
    return Math.max(structuredBest, looseBest);
  }
  return structuredBest ?? looseBest;
}

function detectDate(text: string): string | undefined {
  const iso = text.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    const y = iso[1];
    const mo = iso[2].padStart(2, "0");
    const d = iso[3].padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  const jp = text.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (jp) {
    return `${jp[1]}-${jp[2].padStart(2, "0")}-${jp[3].padStart(2, "0")}`;
  }
  return undefined;
}

export async function runReceiptOcr(
  imageDataUrl: string,
  onProgress?: (p: number) => void
): Promise<ReceiptParseDraft> {
  const result = await Tesseract.recognize(imageDataUrl, "eng+jpn", {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(Math.round(m.progress * 100));
      }
    },
  });
  const text = result.data.text;
  const currency = detectCurrency(text);
  const detectedTotalMinorUnits = extractReceiptTotalMinorUnits(text, currency);
  const detectedDate = detectDate(text);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const detectedMerchant = lines[0]?.slice(0, 80);

  return {
    detectedMerchant,
    detectedTotalMinorUnits: detectedTotalMinorUnits ?? undefined,
    detectedCurrencyCode: currency,
    detectedDate,
    confidence: result.data.confidence || undefined,
    rawText: text.slice(0, 4000),
  };
}
