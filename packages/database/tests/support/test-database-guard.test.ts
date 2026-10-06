import { describe, expect, it } from "vitest";
import { checkTestDatabaseHost, isRemoteOverrideEnabled } from "./test-database-guard.js";

describe("checkTestDatabaseHost", () => {
  it.each([
    ["localhost", "postgresql://u:p@localhost:5432/db"],
    ["LOCALHOST", "postgresql://u:p@LOCALHOST/db"],
    ["127.0.0.1", "postgresql://u:p@127.0.0.1:5432/db"],
    ["127.0.0.2", "postgres://u:p@127.0.0.2/db"],
    ["[::1]", "postgresql://u:p@[::1]:5432/db"],
    [
      "a user that looks remote but a host that is localhost",
      "postgresql://db.invalid@localhost/db",
    ],
  ])("accepts %s", (_label, url) => {
    expect(checkTestDatabaseHost(url)).toBe("allowed");
  });

  it.each([
    ["a .invalid host", "postgresql://u:p@db.invalid:5432/db"],
    ["0.0.0.0", "postgresql://u:p@0.0.0.0/db"],
    ["a private range", "postgresql://u:p@10.0.0.5/db"],
    ["localhost.invalid", "postgresql://u:p@localhost.invalid/db"],
    ["127.0.0.1.invalid", "postgresql://u:p@127.0.0.1.invalid/db"],
    ["a trailing dot", "postgresql://u:p@localhost./db"],
    ["comma-separated hosts", "postgresql://u:p@localhost,db.invalid/db"],
    ["comma-separated loopback hosts", "postgresql://u:p@localhost,127.0.0.1/db"],
    ["a user named localhost on a remote host", "postgresql://localhost@db.invalid/db"],
    ["a host query parameter", "postgresql://u:p@localhost/db?host=db.invalid"],
    ["a hostaddr query parameter", "postgresql://u:p@localhost/db?hostaddr=10.0.0.5"],
    ["an empty host", "postgresql:///db"],
    ["a decimal IPv4", "postgresql://u:p@2130706433/db"],
    ["a hexadecimal IPv4", "postgresql://u:p@0x7f000001/db"],
    ["a shortened IPv4", "postgresql://u:p@127.1/db"],
    ["an octal IPv4", "postgresql://u:p@0177.0.0.1/db"],
    ["an out-of-range octet", "postgresql://u:p@127.0.0.256/db"],
    ["an IPv4-mapped IPv6", "postgresql://u:p@[::ffff:127.0.0.1]/db"],
    ["a malformed string", "not a url"],
    ["an empty string", ""],
    ["a mysql scheme", "mysql://u:p@localhost/db"],
    ["an http scheme", "http://localhost/db"],
  ])("refuses %s", (_label, url) => {
    expect(checkTestDatabaseHost(url)).toBe("refused");
  });
});

describe("isRemoteOverrideEnabled", () => {
  it('is enabled only by the exact string "1"', () => {
    expect(isRemoteOverrideEnabled("1")).toBe(true);
  });

  it.each(["true", "yes", "0", "", " 1", "1 ", undefined])("is not enabled by %j", (value) => {
    expect(isRemoteOverrideEnabled(value)).toBe(false);
  });
});
