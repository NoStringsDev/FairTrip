import { useEffect, useState } from "react";
import {
  BRAND_VARIANT_STORAGE_KEY,
  BRAND_VARIANTS,
  getBrandVariant,
  readBrandVariantId,
  writeBrandVariantId,
  type BrandVariantId,
} from "../branding/variants";

type Props = {
  className?: string;
};

export function BrandVariantPicker({ className }: Props) {
  const [selectedId, setSelectedId] = useState<BrandVariantId>(readBrandVariantId);
  const selected = getBrandVariant(selectedId);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== BRAND_VARIANT_STORAGE_KEY) return;
      setSelectedId(readBrandVariantId());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function choose(variantId: BrandVariantId) {
    writeBrandVariantId(variantId);
    setSelectedId(variantId);
    window.dispatchEvent(new CustomEvent("brandVariantChanged"));
  }

  return (
    <section className={`card stack brand-picker ${className ?? ""}`.trim()}>
      <div className="stack" style={{ gap: 4 }}>
        <h2 className="title" style={{ fontSize: "1rem" }}>
          Choose your FairTrip vibe
        </h2>
        <p className="sub">
          Preview three travel-friendly concepts. Your choice updates the top brand on every
          page.
        </p>
      </div>
      <div className="brand-picker__grid">
        {BRAND_VARIANTS.map((variant) => (
          <button
            key={variant.id}
            type="button"
            className={`brand-picker__option ${selected.id === variant.id ? "brand-picker__option--on" : ""}`}
            onClick={() => choose(variant.id)}
          >
            <img src={variant.iconSrc} alt="" aria-hidden className="brand-picker__icon" />
            <img src={variant.wordmarkSrc} alt={variant.name} className="brand-picker__wordmark" />
            <span className="brand-picker__name">{variant.name}</span>
            <span className="sub">{variant.tone}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
