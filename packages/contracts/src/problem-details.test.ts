import { describe, expect, it } from "vitest";
import { problemDetailsSchema } from "./problem-details.js";

const problem = {
  type: "about:blank",
  title: "Not Found",
  status: 404,
  detail: "The requested resource does not exist.",
  instance: "/api/v1/missing",
};

describe("problemDetailsSchema", () => {
  it("accepts the five members of RFC 9457", () => {
    expect(problemDetailsSchema.safeParse(problem).success).toBe(true);
  });

  it("accepts a list of invalid fields as an extension member", () => {
    const withErrors = { ...problem, errors: [{ pointer: "/age", detail: "Too small" }] };
    expect(problemDetailsSchema.safeParse(withErrors).success).toBe(true);
  });

  it("accepts the product ids of the unavailable products problem, and keeps them when parsing", () => {
    const withIds = { ...problem, productIds: ["00000000-0000-4000-8000-000000000001"] };
    expect(problemDetailsSchema.parse(withIds).productIds).toEqual(withIds.productIds);
  });

  it("refuses product ids that are not strings", () => {
    expect(problemDetailsSchema.safeParse({ ...problem, productIds: [1] }).success).toBe(false);
  });

  it("refuses a success status", () => {
    expect(problemDetailsSchema.safeParse({ ...problem, status: 200 }).success).toBe(false);
  });
});
