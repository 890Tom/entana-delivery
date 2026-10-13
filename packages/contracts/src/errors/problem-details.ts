import { z } from "zod";

/** Media type of every error response (RFC 9457). */
export const PROBLEM_DETAILS_CONTENT_TYPE = "application/problem+json";

/** `type` of a problem that has no more specific meaning than its status (RFC 9457, 4.2.1). */
export const GENERIC_PROBLEM_TYPE = "about:blank";

export const VALIDATION_PROBLEM_TYPE = "urn:entana:problem:validation-error";

/**
 * `type` of the problems of the product form that a client acts on: the status alone does not say
 * which one it is (422 and 415 are shared by several). The detail is a fixed text.
 */
export const PRODUCT_PROBLEM_TYPES = {
  notPublishable: "urn:entana:problem:product_not_publishable",
  skuTaken: "urn:entana:problem:sku_taken",
  photoAltRequired: "urn:entana:problem:photo_alt_required",
  photoTooSmall: "urn:entana:problem:photo_too_small",
  photoInvalid: "urn:entana:problem:photo_invalid",
  photoTooLarge: "urn:entana:problem:photo_too_large",
} as const;

/** One invalid field of a request. `pointer` is a JSON Pointer (RFC 6901) into the request data. */
export const fieldErrorSchema = z.object({
  pointer: z.string(),
  detail: z.string(),
});

export type FieldError = z.infer<typeof fieldErrorSchema>;

/** The single error shape of the API (RFC 9457 problem details). */
export const problemDetailsSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  status: z.number().int().min(400).max(599),
  detail: z.string(),
  instance: z.string(),
  errors: z.array(fieldErrorSchema).optional(),
  /** Extension member (RFC 9457, 3.2) of the unavailable products problem: the ids the client sent. */
  productIds: z.array(z.uuid()).max(30).optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
