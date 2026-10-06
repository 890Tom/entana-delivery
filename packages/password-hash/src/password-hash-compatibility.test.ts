import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./index.js";

// Produced by hashPassword of the former location (packages/database/src/password-hash.ts, commit
// b5bc1c1) for this fake password, before the module moved to its own package.
const FIXTURE_PASSWORD = "fixture-password-123";
const FIXTURE_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$O+aJ4rEWtCcEbenTustz1A$qnBakqAp/G6A5v/1y1369VBucW58ka9UdLB2uX4A5l8";
const PHC_PREFIX = "$argon2id$v=19$m=19456,t=2,p=1$";

describe("hash format kept by the extraction", () => {
  it("verifies a hash made by the former implementation", async () => {
    expect(await verifyPassword(FIXTURE_PASSWORD, FIXTURE_HASH)).toBe(true);
  });

  it("rejects a wrong password against that hash", async () => {
    expect(await verifyPassword("fixture-password-124", FIXTURE_HASH)).toBe(false);
  });

  it("stores the fixture with the documented algorithm and parameters", () => {
    expect(FIXTURE_HASH.startsWith(PHC_PREFIX)).toBe(true);
  });

  it("produces new hashes with the same algorithm and parameters", async () => {
    const hash = await hashPassword(FIXTURE_PASSWORD);
    expect(hash.startsWith(PHC_PREFIX)).toBe(true);
  });
});
