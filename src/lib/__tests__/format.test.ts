import { describe, expect, it } from "vitest";
import { shortNames } from "../format";

describe("shortNames", () => {
  it("uses first names when they're unique", () => {
    const names = shortNames([
      { id: "a", displayName: "Alex Kim" },
      { id: "b", displayName: "Blair Tester" },
      { id: "c", displayName: "Maya" },
    ]);
    expect([...names.values()]).toEqual(["Alex", "Blair", "Maya"]);
  });

  it("falls back to full names for roommates who share a first name", () => {
    const names = shortNames([
      { id: "a", displayName: "Alex Kim" },
      { id: "b", displayName: "alex Lee " },
      { id: "c", displayName: "Extra 1" },
      { id: "d", displayName: "Extra 2" },
      { id: "e", displayName: "Chris Park" },
    ]);
    expect(names.get("a")).toBe("Alex Kim");
    expect(names.get("b")).toBe("alex Lee");
    expect(names.get("c")).toBe("Extra 1");
    expect(names.get("d")).toBe("Extra 2");
    expect(names.get("e")).toBe("Chris");
  });
});
