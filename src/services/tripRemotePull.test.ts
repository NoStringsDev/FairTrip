import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PullMergeResult } from "./tripSync";

const mockPull = vi.fn();

vi.mock("./tripRevisionCache", () => ({
  snapshotTripRevisionNow: vi.fn().mockResolvedValue(undefined),
  clearTripRevisionCache: vi.fn(),
  hasTripRevisionWatermark: vi.fn().mockReturnValue(true),
  getCachedTripRevision: vi.fn(() => 1),
}));

vi.mock("./tripSync", () => ({
  pullAndMergeTrip: (code: string) => mockPull(code),
}));

import { executeTripPull, scheduleDebouncedTripPull } from "./tripRemotePull";

describe("tripRemotePull", () => {
  beforeEach(() => {
    mockPull.mockReset();
    mockPull.mockResolvedValue({ ok: true } satisfies PullMergeResult);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("executeTripPull shares one in-flight request per tripCode", async () => {
    let finish!: (v: PullMergeResult) => void;
    const gate = new Promise<PullMergeResult>((res) => {
      finish = res;
    });
    mockPull.mockImplementationOnce(() => gate);

    const p1 = executeTripPull("TRIP-A");
    const p2 = executeTripPull("TRIP-A");

    expect(mockPull).toHaveBeenCalledTimes(1);
    finish({ ok: true });

    await expect(Promise.all([p1, p2])).resolves.toEqual([
      { ok: true },
      { ok: true },
    ]);
    expect(mockPull).toHaveBeenCalledTimes(1);
  });

  it("executeTripPull allows concurrent pulls for different trip codes", async () => {
    mockPull.mockImplementation(async (code: string) => {
      await new Promise<void>((r) => setTimeout(r, code === "A" ? 8 : 4));
      return { ok: true } satisfies PullMergeResult;
    });

    await Promise.all([executeTripPull("A"), executeTripPull("B")]);

    expect(mockPull).toHaveBeenCalledTimes(2);
    expect(mockPull.mock.calls.map((c) => c[0]).sort()).toEqual(["A", "B"]);
  });

  it("scheduleDebouncedTripPull coalesces rapid calls into one pull", async () => {
    vi.useFakeTimers();
    scheduleDebouncedTripPull("X", 200);
    scheduleDebouncedTripPull("X", 200);
    scheduleDebouncedTripPull("X", 200);

    expect(mockPull).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(250);
    expect(mockPull).toHaveBeenCalledTimes(1);
    expect(mockPull).toHaveBeenCalledWith("X");
  });
});
