import { describe, it, expect } from "vitest";
import { slotFloor, slotGrid, HOUR } from "@/lib/factors/clock";

describe("clock", () => {
  it("slotFloor floors to the canonical (hourly) grid", () => {
    expect(slotFloor(HOUR + 123)).toBe(HOUR);
    expect(slotFloor(2 * HOUR - 1)).toBe(HOUR);
    expect(slotFloor(2 * HOUR)).toBe(2 * HOUR);
  });

  it("slotGrid is an inclusive list of boundaries", () => {
    expect(slotGrid(0, 3 * HOUR)).toEqual([0, HOUR, 2 * HOUR, 3 * HOUR]);
    expect(slotGrid(HOUR + 5, 2 * HOUR + 5)).toEqual([HOUR, 2 * HOUR]);
  });
});
