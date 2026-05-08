import { useEffect, useState } from "react";
import {
  BRAND_VARIANT_STORAGE_KEY,
  getBrandVariant,
  readBrandVariantId,
  type BrandVariantId,
} from "../branding/variants";

export function AppBrandHeader() {
  const [variantId, setVariantId] = useState<BrandVariantId>(readBrandVariantId);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== BRAND_VARIANT_STORAGE_KEY) return;
      setVariantId(readBrandVariantId());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const onBrandVariantChanged = () => setVariantId(readBrandVariantId());
    window.addEventListener("brandVariantChanged", onBrandVariantChanged);
    return () => window.removeEventListener("brandVariantChanged", onBrandVariantChanged);
  }, []);

  const variant = getBrandVariant(variantId);
  return (
    <header className="brand-header" aria-label="FairTrip brand">
      <div className="brand-header__inner">
        <img className="brand-header__icon" src={variant.iconSrc} alt="" aria-hidden />
        <img className="brand-header__wordmark" src={variant.wordmarkSrc} alt="FairTrip" />
      </div>
    </header>
  );
}
