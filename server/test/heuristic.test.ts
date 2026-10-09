import { describe, expect, it } from "vitest";
import { toIsoDate, toNumber } from "../src/providers/heuristic.js";

describe("toNumber", () => {
  it.each([
    ["1,241.00", 1241],
    ["1.241,50", 1241.5],
    ["EUR 1,501.61", 1501.61],
    ["£646.00", 646],
    ["0.00", 0],
  ])("%s -> %d", (input, expected) => expect(toNumber(input)).toBe(expected));

  it("returns null for empty or non-numeric input", () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber("n/a")).toBeNull();
  });
});

describe("toIsoDate", () => {
  it.each([
    ["2026-09-02", "2026-09-02"],
    ["14 Sep 2026", "2026-09-14"],
    ["10 September 2026", "2026-09-10"],
    ["03/04/2026", "2026-04-03"], // day-first
  ])("%s -> %s", (input, expected) => expect(toIsoDate(input)).toBe(expected));
});
