import { describe, expect, it } from "vitest";
import { createResellerRequestSchema, updateResellerRequestSchema } from "./reseller-form.js";

const VALID = {
  name: "Demo Reseller",
  neighborhood: "Demo Area",
  landmark: "Next to the fake market",
  latitude: -18.9,
  longitude: 47.5,
};

describe("createResellerRequestSchema", () => {
  it("applies the defaults: no consent, not visible", () => {
    const parsed = createResellerRequestSchema.parse(VALID);

    expect(parsed).toEqual({ ...VALID, consentGiven: false, visible: false });
  });

  it("trims the text fields", () => {
    const parsed = createResellerRequestSchema.parse({ ...VALID, name: "  Demo  " });

    expect(parsed.name).toBe("Demo");
  });

  it.each([
    ["a missing latitude", { ...VALID, latitude: undefined }],
    ["a missing longitude", { ...VALID, longitude: undefined }],
    ["a missing landmark", { ...VALID, landmark: undefined }],
    ["an empty landmark", { ...VALID, landmark: "   " }],
    ["a name over 60 characters", { ...VALID, name: "a".repeat(61) }],
    ["a neighborhood over 40 characters", { ...VALID, neighborhood: "a".repeat(41) }],
    ["a landmark over 120 characters", { ...VALID, landmark: "a".repeat(121) }],
    ["a latitude over 90", { ...VALID, latitude: 90.1 }],
    ["a longitude under -180", { ...VALID, longitude: -180.1 }],
    ["an unknown field", { ...VALID, phone: "0340000000" }],
  ])("refuses %s", (_name, body) => {
    expect(createResellerRequestSchema.safeParse(body).success).toBe(false);
  });

  it("accepts the limits of the values", () => {
    const body = {
      name: "a".repeat(60),
      neighborhood: "a".repeat(40),
      landmark: "a".repeat(120),
      latitude: -90,
      longitude: 180,
    };

    expect(createResellerRequestSchema.safeParse(body).success).toBe(true);
  });
});

describe("updateResellerRequestSchema", () => {
  it("accepts one field", () => {
    expect(updateResellerRequestSchema.safeParse({ visible: false }).success).toBe(true);
  });

  it("refuses an empty body", () => {
    expect(updateResellerRequestSchema.safeParse({}).success).toBe(false);
  });

  it("refuses a latitude without a longitude, and the other way round", () => {
    expect(updateResellerRequestSchema.safeParse({ latitude: -18.9 }).success).toBe(false);
    expect(updateResellerRequestSchema.safeParse({ longitude: 47.5 }).success).toBe(false);
  });

  it("accepts a latitude with a longitude", () => {
    expect(
      updateResellerRequestSchema.safeParse({ latitude: -18.9, longitude: 47.5 }).success,
    ).toBe(true);
  });

  it("refuses a null position: it is never cleared", () => {
    const body = { latitude: null, longitude: null };

    expect(updateResellerRequestSchema.safeParse(body).success).toBe(false);
  });

  it("refuses an unknown field", () => {
    expect(updateResellerRequestSchema.safeParse({ name: "A", id: "x" }).success).toBe(false);
  });
});
