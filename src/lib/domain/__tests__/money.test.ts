import { describe, expect, it } from "vitest";
import { amountInputError, centsToInput, formatCents, parseCents } from "../money";

describe("parseCents", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.05", 1205],
    ["0.99", 99],
    [".5", 50],
    ["$1,234.56", 123456],
    ["  7. ", 700],
  ])("parses %s", (input, expected) => {
    expect(parseCents(input)).toBe(expected);
  });

  it.each(["", ".", "abc", "-5", "1.234", "1e3", "12..3"])("rejects %s", (input) => {
    expect(parseCents(input)).toBeNull();
  });

  it("rejects amounts above the ceiling", () => {
    expect(parseCents("99999999999")).toBeNull();
  });
});

describe("formatCents", () => {
  it("formats positive, negative and signed values", () => {
    expect(formatCents(5000)).toBe("$50.00");
    expect(formatCents(-7001)).toBe("-$70.01");
    expect(formatCents(2000, { signed: true })).toBe("+$20.00");
    expect(formatCents(0, { signed: true })).toBe("$0.00");
  });

  it("round-trips through input format", () => {
    expect(centsToInput(1205)).toBe("12.05");
    expect(parseCents(centsToInput(98765))).toBe(98765);
  });
});

describe("amountInputError", () => {
  it("accepts positive amounts", () => {
    expect(amountInputError("12.50")).toBeNull();
    expect(amountInputError("$1,200")).toBeNull();
    expect(amountInputError("0.01")).toBeNull();
  });

  it("explains empty, zero, negative and malformed input", () => {
    expect(amountInputError("")).toBe("Enter an amount greater than $0.");
    expect(amountInputError("0")).toBe("Enter an amount greater than $0.");
    expect(amountInputError("0.00")).toBe("Enter an amount greater than $0.");
    expect(amountInputError("-5")).toBe("Amounts can't be negative.");
    expect(amountInputError("$-5")).toBe("Amounts can't be negative.");
    expect(amountInputError("12.345")).toMatch(/at most 2 decimals/);
    expect(amountInputError("abc")).toMatch(/dollar amount/);
  });
});
