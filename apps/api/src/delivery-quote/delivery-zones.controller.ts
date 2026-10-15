import { Controller, Get, Header } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { deliveryZoneListResponseSchema, problemDetailsSchema } from "@entana/contracts";
import type { DeliveryZoneListResponse } from "@entana/contracts";
import { DeliveryZonesService } from "./delivery-zones.service.js";

// The same value as the resellers: how long a visitor may keep seeing a zone that has just been
// removed. The answer is the same for everybody, so shared caches may keep it.
export const DELIVERY_ZONES_CACHE_CONTROL = "public, max-age=30";

@ApiTags("delivery")
@Controller({ path: "delivery", version: "1" })
export class DeliveryZonesController {
  constructor(private readonly deliveryZonesService: DeliveryZonesService) {}

  @Get("zones")
  @Header("Cache-Control", DELIVERY_ZONES_CACHE_CONTROL)
  @ApiOperation({
    summary: "List the delivery zones",
    description:
      "Public. Every active place of at least one active axis, once, by name, with five fields: " +
      "id, name, latitude, longitude and radiusM. Nothing of the axes. No pagination.",
    operationId: "listDeliveryZones",
  })
  @ApiOkResponse({
    description: "The covered places. An empty list is valid.",
    standardSchema: deliveryZoneListResponseSchema,
  })
  @ApiResponse({
    status: 500,
    description: "An unexpected error. The body names no place and no column.",
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
  list(): Promise<DeliveryZoneListResponse> {
    return this.deliveryZonesService.listZones();
  }
}
