import { Controller, Get, Header } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { problemDetailsSchema, productListResponseSchema } from "@entana/contracts";
import type { ProductListResponse } from "@entana/contracts";
import { CatalogService } from "./catalog.service.js";

// A product decision to confirm: how long a visitor may keep seeing a catalogue that has just
// changed (a price, a product sold out). The answer is the same for everybody, so shared caches may
// keep it. 30 seconds keeps a burst of visitors off the database for a shop-sized catalogue.
const CATALOG_CACHE_CONTROL = "public, max-age=30";

@ApiTags("catalog")
@Controller({ path: "products", version: "1" })
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @Header("Cache-Control", CATALOG_CACHE_CONTROL)
  @ApiOperation({
    summary: "List the active products",
    description:
      "Public. Every active product, in display order, with its availability. No pagination.",
    operationId: "listProducts",
  })
  @ApiOkResponse({
    description: "The active products in display order. An empty list is valid.",
    standardSchema: productListResponseSchema,
  })
  @ApiResponse({
    status: 500,
    description: "An unexpected error. The body names no product and no column.",
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
  list(): Promise<ProductListResponse> {
    return this.catalogService.listActiveProducts();
  }
}
