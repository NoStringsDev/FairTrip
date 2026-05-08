import inlineBreakIcon from "../assets/branding/designed-inline-break-icon.svg";
import inlineBreakWordmark from "../assets/branding/designed-inline-break-wordmark.svg";
import skewMotionIcon from "../assets/branding/designed-skew-motion-icon.svg";
import skewMotionWordmark from "../assets/branding/designed-skew-motion-wordmark.svg";
import stackedSplitIcon from "../assets/branding/designed-stacked-split-icon.svg";
import stackedSplitWordmark from "../assets/branding/designed-stacked-split-wordmark.svg";

export type BrandVariantId =
  | "designed-stacked-split"
  | "designed-inline-break"
  | "designed-skew-motion";

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
    id: "designed-stacked-split",
    name: "Option 1: Stacked Split",
    tone: "Stacked wordmark with a clean split band and route-like rows.",
    iconSrc: stackedSplitIcon,
    wordmarkSrc: stackedSplitWordmark,
  },
  {
    id: "designed-inline-break",
    name: "Option 2: Inline Break",
    tone: "Single-line wordmark with an intentional horizontal break.",
    iconSrc: inlineBreakIcon,
    wordmarkSrc: inlineBreakWordmark,
  },
  {
    id: "designed-skew-motion",
    name: "Option 3: Skew Motion",
    tone: "Subtle forward tilt with straight route segments and blue waypoints.",
    iconSrc: skewMotionIcon,
    wordmarkSrc: skewMotionWordmark,
  },
];

export const DEFAULT_BRAND_VARIANT_ID: BrandVariantId = "designed-stacked-split";

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
