import { afterEach, describe, expect, it } from "vitest";
import { clearLastTripId, getLastTripId, setLastTripId } from "./lastTrip";

function mockWindowStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage },
  });
}

describe("lastTrip storage helpers", () => {
  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: undefined,
    });
  });

  it("stores and reads last trip id", () => {
    mockWindowStorage();
    setLastTripId("trip-123");
    expect(getLastTripId()).toBe("trip-123");
  });

  it("clears last trip id", () => {
    mockWindowStorage();
    setLastTripId("trip-123");
    clearLastTripId();
    expect(getLastTripId()).toBeNull();
  });

  it("returns null when storage is unavailable", () => {
    expect(getLastTripId()).toBeNull();
  });
});

