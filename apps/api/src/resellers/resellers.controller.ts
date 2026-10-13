import { Controller, Get, Header } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { problemDetailsSchema, resellerListResponseSchema } from "@entana/contracts";
import type { ResellerListResponse } from "@entana/contracts";
import { ResellersService } from "./resellers.service.js";

// A product decision to confirm, borrowed from the catalogue: how long a visitor may keep seeing a
// list that has just changed (a reseller who withdrew). The answer is the same for everybody, so
// shared caches may keep it.
const RESELLERS_CACHE_CONTROL = "public, max-age=30";

@ApiTags("resellers")
@Controller({ path: "resellers", version: "1" })
export class ResellersController {
  constructor(private readonly resellersService: ResellersService) {}

  @Get()
  @Header("Cache-Control", RESELLERS_CACHE_CONTROL)
  @ApiOperation({
    summary: "List the visible resellers",
    description:
      "Public. Every reseller shown on the map, by neighborhood then name, with six fields: " +
      "id, name, neighborhood, landmark, latitude and longitude. No pagination.",
    operationId: "listResellers",
  })
  @ApiOkResponse({
    description: "The visible resellers. An empty list is valid.",
    standardSchema: resellerListResponseSchema,
  })
  @ApiResponse({
    status: 500,
    description: "An unexpected error. The body names no reseller and no column.",
    standardSchema: problemDetailsSchema,
  })
  @ApiResponse({
    status: 503,
    description: "The database is unreachable. The body names no host.",
    standardSchema: problemDetailsSchema,
  })
  @ApiResponse({
    status: "default",
    description: "Problem details (RFC 9457).",
    standardSchema: problemDetailsSchema,
  })
  list(): Promise<ResellerListResponse> {
    return this.resellersService.listVisibleResellers();
  }
}
