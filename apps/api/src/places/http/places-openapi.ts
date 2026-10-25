import { applyDecorators } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { placeSearchResponseSchema, problemDetailsSchema } from "@entana/contracts";

type Problem = readonly [number | "default", string];

const SEARCH_PROBLEMS: readonly Problem[] = [
  [400, "The text is too short or too long, or the query has an unknown parameter."],
  [429, "Too many searches from this address. Carries Retry-After."],
  [
    503,
    "The provider did not answer in time or gave an unusable answer: type " +
      "urn:entana:problem:place_search_unavailable. The body names no provider.",
  ],
  ["default", "Problem details (RFC 9457)."],
];

export const documentSearchPlaces = (): MethodDecorator =>
  applyDecorators(
    ApiOperation({
      summary: "Suggest places for a typed address",
      description:
        "Public. At most 5 places of Madagascar for a text of 3 to 100 characters (trimmed), " +
        "searched near the map centre of the instance, in the order of the provider. Each one " +
        "has a label, a latitude and a longitude.",
      operationId: "searchPlaces",
    }),
    ApiOkResponse({
      description: "The suggestions. An empty list is valid.",
      standardSchema: placeSearchResponseSchema,
    }),
    ...SEARCH_PROBLEMS.map(([status, description]) =>
      ApiResponse({ status, description, standardSchema: problemDetailsSchema }),
    ),
  );
