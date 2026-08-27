import { describe, expect, it } from "vitest";
import { formatDZD, formatQty, formatDate } from "./format";

describe("formatDZD", () => {
  it("groups thousands with spaces and appends دج", () => {
    expect(formatDZD(12400)).toBe("12 400 دج");
  });
  it("handles small amounts", () => {
    expect(formatDZD(400)).toBe("400 دج");
  });
  it("keeps up to 2 decimals when fractional", () => {
    expect(formatDZD(1234.5)).toBe("1 234.5 دج");
    expect(formatDZD(1000000.25)).toBe("1 000 000.25 دج");
  });
  it("rounds to 2 decimals", () => {
    expect(formatDZD(99.999)).toBe("100 دج");
  });
  it("zero", () => {
    expect(formatDZD(0)).toBe("0 دج");
  });
});

describe("formatQty", () => {
  it("trims trailing zeros", () => {
    expect(formatQty(12.5)).toBe("12.5");
    expect(formatQty(3)).toBe("3");
  });
});

describe("formatDate", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(formatDate(new Date(2026, 7, 27))).toBe("2026-08-27");
  });
});
