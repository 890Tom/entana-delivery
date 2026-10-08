import { createOrderRequestSchema } from "../create-order-request.js";

// Shared by the tests of createOrderRequestSchema. It is excluded from the build
// (tsconfig.build.json) so that it never ships in dist.

export const FIRST_PRODUCT_ID = "3b241101-e2bb-4255-8caf-4136c566a962";
export const SECOND_PRODUCT_ID = "0190a5b2-7c3d-7e4f-8a1b-2c3d4e5f6a7b";
/** 43 characters of the base64url alphabet, as 32 random bytes give. Built from a low-entropy filler on purpose: a random-looking literal is flagged by the secrets scan. */
export const VALID_TRACKING_TOKEN = "FAKE".padEnd(43, "0");

/** A valid request; `overrides` replaces or adds fields, so a test changes one thing at a time. */
export const buildRequest = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  phone: "034 12 345 67",
  trackingToken: VALID_TRACKING_TOKEN,
  contactName: "Rakoto Andry",
  customerNote: "Portail bleu, sonner deux fois",
  landmarkText: "En face de la pharmacie Ankorondrano",
  location: { lat: -18.8792, lng: 47.5079 },
  items: [{ productId: FIRST_PRODUCT_ID, quantity: 2 }],
  ...overrides,
});

export const isAccepted = (value: unknown): boolean => {
  return createOrderRequestSchema.safeParse(value).success;
};

export const issueCodes = (value: unknown): string[] => {
  const result = createOrderRequestSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.code);
};

export const issueMessages = (value: unknown): string[] => {
  const result = createOrderRequestSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

/** The distinct paths of the issues, "items.0.quantity" style; "" is the request itself. */
export const rejectedPaths = (value: unknown): string[] => {
  const result = createOrderRequestSchema.safeParse(value);
  if (result.success) {
    return [];
  }
  return [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
};

/** The first segment of every issue path: the top-level field the request is rejected for. */
export const rejectedFields = (value: unknown): string[] => {
  return [...new Set(rejectedPaths(value).map((path) => path.split(".")[0] ?? ""))];
};
