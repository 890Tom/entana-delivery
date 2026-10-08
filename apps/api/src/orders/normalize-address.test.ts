import { describe, expect, it } from "vitest";
import { normalizeAddress } from "./normalize-address.js";

describe("normalizeAddress", () => {
  it("keeps a plain IPv4 address", () => {
    expect(normalizeAddress("203.0.113.7")).toBe("203.0.113.7");
  });

  it("gives an IPv4-mapped IPv6 address the same key as the plain IPv4 form", () => {
    expect(normalizeAddress("::ffff:203.0.113.7")).toBe(normalizeAddress("203.0.113.7"));
  });

  it("gives the hexadecimal mapped form the same key too, in any letter case", () => {
    expect(normalizeAddress("::FFFF:cb00:7107")).toBe("203.0.113.7");
  });

  it("groups an IPv6 address by its /64 prefix, so rotating the host part changes nothing", () => {
    const first = normalizeAddress("2001:db8:1:2:aaaa:bbbb:cccc:dddd");
    const second = normalizeAddress("2001:DB8:1:2::1");

    expect(first).toBe(second);
    expect(normalizeAddress("2001:db8:1:3::1")).not.toBe(first);
  });

  it("expands the compressed forms before cutting the prefix", () => {
    expect(normalizeAddress("::1")).toBe(normalizeAddress("0:0:0:0:0:0:0:1"));
    expect(normalizeAddress("2001:db8::")).toBe(normalizeAddress("2001:db8:0:0:1:1:1:1"));
  });

  it("shares one key for a missing or unreadable address", () => {
    expect(normalizeAddress(undefined)).toBe(normalizeAddress("not an address"));
  });
});
