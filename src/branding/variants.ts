import pocketIcon from "../assets/branding/pocket-trip-balance-icon.svg";
import pocketWordmark from "../assets/branding/pocket-trip-balance-wordmark.svg";
import splitIcon from "../assets/branding/split-and-share-route-icon.svg";
import splitWordmark from "../assets/branding/split-and-share-route-wordmark.svg";
import sunnyIcon from "../assets/branding/sunny-ledger-journey-icon.svg";
import sunnyWordmark from "../assets/branding/sunny-ledger-journey-wordmark.svg";

export type BrandVariantId =
  | "sunny-ledger-journey"
  | "split-and-share-route"
  | "pocket-trip-balance";

export type BrandVariant = {
  id: BrandVariantId;
  name: string;
  tone: string;
  iconSrc: string;
  wordmarkSrc: string;
};

export const BRAND_VARIANT_STORAGE_KEY = "fairtrip.brandVariant";

export const BRAND_VARIANTS: BrandVariant[] = [
  {
    id: "sunny-ledger-journey",
    name: "Sunny Ledger Journey",
    tone: "Cheerful checklist vibe with a playful route cue.",
    iconSrc: sunnyIcon,
    wordmarkSrc: sunnyWordmark,
  },
  {
    id: "split-and-share-route",
    name: "Split & Share Route",
    tone: "Dynamic social split paths that meet in the middle.",
    iconSrc: splitIcon,
    wordmarkSrc: splitWordmark,
  },
  {
    id: "pocket-trip-balance",
    name: "Pocket Trip Balance",
    tone: "Friendly pocket travel marker with list-based fairness cues.",
    iconSrc: pocketIcon,
    wordmarkSrc: pocketWordmark,
  },
];

export const DEFAULT_BRAND_VARIANT_ID: BrandVariantId = "sunny-ledger-journey";

export function readBrandVariantId(): BrandVariantId {
  if (typeof window === "undefined") return DEFAULT_BRAND_VARIANT_ID;
  const stored = window.localStorage.getItem(BRAND_VARIANT_STORAGE_KEY) as BrandVariantId | null;
  return BRAND_VARIANTS.some((variant) => variant.id === stored)
    ? (stored as BrandVariantId)
    : DEFAULT_BRAND_VARIANT_ID;
}

export function writeBrandVariantId(variantId: BrandVariantId) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BRAND_VARIANT_STORAGE_KEY, variantId);
}

export function getBrandVariant(variantId: BrandVariantId): BrandVariant {
  return BRAND_VARIANTS.find((variant) => variant.id === variantId) ?? BRAND_VARIANTS[0];
}
