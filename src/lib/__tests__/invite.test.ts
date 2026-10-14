import { describe, expect, it } from "vitest";
import { parseInviteToken } from "../invite";

const TOKEN = "67c129aae376594db55026701ae27f1b7369cc70d48337df";

describe("parseInviteToken", () => {
  it("accepts a bare code", () => {
    expect(parseInviteToken(TOKEN)).toBe(TOKEN);
    expect(parseInviteToken(`  ${TOKEN}\n`)).toBe(TOKEN);
  });

  it("extracts the token from full links on any origin", () => {
    expect(parseInviteToken(`http://127.0.0.1:4317/join/${TOKEN}`)).toBe(TOKEN);
    expect(parseInviteToken(`https://roommate.example.com/join/${TOKEN}/`)).toBe(TOKEN);
    expect(parseInviteToken(`https://roommate.example.com/join/${TOKEN}?utm=sms#x`)).toBe(TOKEN);
    expect(parseInviteToken(`/join/${TOKEN}`)).toBe(TOKEN);
  });

  it("forgives case and wrapping punctuation from chat apps", () => {
    expect(parseInviteToken(TOKEN.toUpperCase())).toBe(TOKEN);
    expect(parseInviteToken(`<https://x.dev/join/${TOKEN}>`)).toBe(TOKEN);
    expect(parseInviteToken(`"${TOKEN}".`)).toBe(TOKEN);
  });

  it("rejects things that aren't invite codes", () => {
    expect(parseInviteToken("")).toBeNull();
    expect(parseInviteToken("   ")).toBeNull();
    expect(parseInviteToken("hello")).toBeNull();
    expect(parseInviteToken("https://example.com/dashboard")).toBeNull();
    expect(parseInviteToken("https://example.com/join/")).toBeNull();
    expect(parseInviteToken(`${TOKEN.slice(0, 10)}`)).toBeNull();
    expect(parseInviteToken(`${TOKEN}zz`)).toBeNull();
    expect(parseInviteToken("../../etc/passwd")).toBeNull();
  });
});
