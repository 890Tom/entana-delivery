import { argon2Sync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ARGON2ID_PARAMETERS, hashPassword, verifyPassword } from "./password-hash.js";

describe("hashPassword", () => {
  it("produces a PHC string with the OWASP parameters", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(
      /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/,
    );
  });

  it("uses a new salt every time", async () => {
    expect(await hashPassword("same password")).not.toBe(await hashPassword("same password"));
  });

  it("refuses an empty password", async () => {
    await expect(hashPassword("")).rejects.toThrow(RangeError);
  });
});

describe("verifyPassword", () => {
  it("accepts the right password", async () => {
    const hash = await hashPassword("right password");
    expect(await verifyPassword("right password", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("right password");
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("rejects passwords that differ only by case or by a trailing character", async () => {
    const hash = await hashPassword("Right Password");
    expect(await verifyPassword("right password", hash)).toBe(false);
    expect(await verifyPassword("Right Password ", hash)).toBe(false);
  });

  it.each([
    ["an empty string", ""],
    ["plain text", "not-a-hash"],
    [
      "another algorithm",
      "$argon2i$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g",
    ],
    ["a bcrypt hash", "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234"],
    [
      "a salt that is too short",
      "$argon2id$v=19$m=19456,t=2,p=1$YQ$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g",
    ],
  ])("returns false for %s", async (_label, stored) => {
    expect(await verifyPassword("anything", stored)).toBe(false);
  });

  describe("parameters read from the stored hash", () => {
    const salt = "c29tZXNhbHRzb21lc2FsdA"; // 16 bytes
    const tag = "aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g"; // 32 bytes
    const phc = (parameters: string, saltPart = salt, tagPart = tag): string =>
      `$argon2id$v=19$${parameters}$${saltPart}$${tagPart}`;

    it.each([
      ["a memory above the limit", phc("m=1048577,t=2,p=1")],
      ["a memory of 4 GiB", phc("m=4194304,t=2,p=1")],
      ["a huge number of digits", phc(`m=${"9".repeat(40)},t=2,p=1`)],
      ["too many passes", phc("m=19456,t=11,p=1")],
      ["too much parallelism", phc("m=19456,t=2,p=17")],
      ["zero passes", phc("m=19456,t=0,p=1")],
      ["zero parallelism", phc("m=19456,t=2,p=0")],
      ["too little memory for the lanes", phc("m=8,t=2,p=2")],
      ["a salt of 7 bytes", phc("m=19456,t=2,p=1", "YWFhYWFhYQ")],
      ["a tag of 15 bytes", phc("m=19456,t=2,p=1", salt, "YWFhYWFhYWFhYWFhYWFh")],
    ])("returns false for %s", async (_label, stored) => {
      expect(await verifyPassword("anything", stored)).toBe(false);
    });

    it("refuses a memory above the limit before allocating it", async () => {
      // Hashing with 4 GiB would take seconds, or fail: the refusal must come first.
      const start = performance.now();
      expect(await verifyPassword("anything", phc("m=4194304,t=10,p=1"))).toBe(false);
      expect(performance.now() - start).toBeLessThan(200);
    });
  });

  it("returns false for an empty password", async () => {
    const hash = await hashPassword("something");
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("reads the parameters from the stored hash", async () => {
    // Hash made with other parameters than the current ones: still verifiable.
    const salt = Buffer.alloc(16, 7);
    const tag = argon2Sync("argon2id", {
      message: "older password",
      nonce: salt,
      memory: 8192,
      passes: 3,
      parallelism: 1,
      tagLength: 32,
    });
    const stored = `$argon2id$v=19$m=8192,t=3,p=1$${salt.toString("base64").replace(/=+$/, "")}$${tag.toString("base64").replace(/=+$/, "")}`;
    expect(await verifyPassword("older password", stored)).toBe(true);
    expect(await verifyPassword("newer password", stored)).toBe(false);
  });
});

describe("Node's Argon2id", () => {
  // Test vector of RFC 9106, section 5.3. It shows that the primitive we rely on is the standard
  // Argon2id, so a hash made here can be verified by any other implementation.
  it("matches the RFC 9106 test vector", () => {
    const tag = argon2Sync("argon2id", {
      message: Buffer.alloc(32, 1),
      nonce: Buffer.alloc(16, 2),
      secret: Buffer.alloc(8, 3),
      associatedData: Buffer.alloc(12, 4),
      memory: 32,
      passes: 3,
      parallelism: 4,
      tagLength: 32,
    });
    expect(tag.toString("hex")).toBe(
      "0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659",
    );
  });

  it("keeps the OWASP minimum", () => {
    expect(ARGON2ID_PARAMETERS).toMatchObject({ memoryKib: 19_456, passes: 2, parallelism: 1 });
  });
});
