import Tesseract from "tesseract.js";
import type { CurrencyCode, ReceiptParseDraft } from "../types";
import { minorUnitsFor } from "../domain/currency";

const amountRegexes = [
  /(?:TOTAL|AMOUNT|合計|計|お預り|預り|¥|£)\s*[:\s]*([£¥]?\s*[\d,]+(?:\.\d{1,2})?)/gi,
  /([£¥]\s*[\d,]+(?:\.\d{1,2})?)/g,
  /(?:^|\s)([\d,]+(?:\.\d{1,2})?)\s*(?:GBP|JPY|EUR|円)/gi,
];

function detectCurrency(text: string): CurrencyCode {
  if (/£|GBP/i.test(text)) return "GBP";
  if (/\bUSD\b|\$\s*[\d,]/.test(text)) return "USD";
  if (/\bEUR\b|€/.test(text)) return "EUR";
  if (/円|JPY|¥/.test(text)) return "JPY";
  return "JPY";
}

function parseAmountFromMatch(raw: string, currency: CurrencyCode): number | null {
  const cleaned = raw.replace(/[£¥,\s]/g, "").replace(/,/g, "");
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * minorUnitsFor(currency));
}

function pickLargestAmount(text: string, currency: CurrencyCode): number | null {
  let best: number | null = null;
  for (const re of amountRegexes) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const minor = parseAmountFromMatch(m[1] ?? m[0], currency);
      if (minor != null && (best == null || minor > best)) best = minor;
    }
  }
  const loose = text.match(/[\d,]+(?:\.\d{1,2})?/g);
  if (loose) {
    for (const s of loose) {
      const minor = parseAmountFromMatch(s, currency);
      if (minor != null && minor > 0 && (best == null || minor > best)) best = minor;
    }
  }
  return best;
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
  const detectedTotalMinorUnits = pickLargestAmount(text, currency);
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
