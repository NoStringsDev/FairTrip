import { describe, expect, it } from "vitest";
import { convertExpenseMinorToGbpMinor } from "./fx";

describe("convertExpenseMinorToGbpMinor", () => {
  it("converts JPY minor to GBP pence", () => {
    const gbpPerUnit = 0.005;
    const jpyMinor = 1000;
    const gbp = convertExpenseMinorToGbpMinor(jpyMinor, "JPY", gbpPerUnit);
    expect(gbp).toBe(Math.round(1000 * gbpPerUnit * 100));
  });

  it("converts EUR cents to GBP pence", () => {
    const gbpPerEur = 0.85;
    const eurCents = 10000;
    const gbp = convertExpenseMinorToGbpMinor(eurCents, "EUR", gbpPerEur);
    expect(gbp).toBe(Math.round(100 * gbpPerEur * 100));
  });
});
