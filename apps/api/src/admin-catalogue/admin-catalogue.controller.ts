import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { availabilityRequestSchema, productOrderRequestSchema } from "@entana/contracts";
import type {
  AdminProduct,
  AdminProductListResponse,
  AdminProfile,
  AvailabilityRequest,
  ProductOrderRequest,
} from "@entana/contracts";
import { currentAdmin } from "../admin-auth/http/authenticated-admin.js";
import { JsonContentTypeGuard } from "../errors/request-body/json-content-type.guard.js";
import { AdminCatalogueService } from "./admin-catalogue.service.js";
import {
  documentChangeAvailability,
  documentListProducts,
  documentReorderProducts,
  documentRestoreProduct,
  documentRetireProduct,
} from "./http/admin-catalogue-openapi.js";

// Errors carry it too (the problem filter sets it): this is for the answers of success.
const NO_STORE = "no-store";

@ApiTags("admin")
@Controller({ path: "admin/products", version: "1" })
export class AdminCatalogueController {
  constructor(private readonly catalogue: AdminCatalogueService) {}

  @Get()
  @Header("Cache-Control", NO_STORE)
  @documentListProducts()
  list(): Promise<AdminProductListResponse> {
    return this.catalogue.listProducts();
  }

  // `order` is a literal segment of a PUT: it cannot be taken for an id by the `:id` routes.
  @Put("order")
  @UseGuards(JsonContentTypeGuard)
  @Header("Cache-Control", NO_STORE)
  @documentReorderProducts()
  reorder(
    @Body({ schema: productOrderRequestSchema }) body: ProductOrderRequest,
  ): Promise<AdminProductListResponse> {
    return this.catalogue.reorder(body);
  }

  @Patch(":id/availability")
  @UseGuards(JsonContentTypeGuard)
  @Header("Cache-Control", NO_STORE)
  @documentChangeAvailability()
  changeAvailability(
    @Param("id") id: string,
    @Body({ schema: availabilityRequestSchema }) body: AvailabilityRequest,
    @currentAdmin() admin: AdminProfile,
  ): Promise<AdminProduct> {
    return this.catalogue.changeAvailability(id, body, admin.id);
  }

  @Post(":id/retire")
  @HttpCode(200)
  @Header("Cache-Control", NO_STORE)
  @documentRetireProduct()
  retire(@Param("id") id: string, @currentAdmin() admin: AdminProfile): Promise<AdminProduct> {
    return this.catalogue.retire(id, admin.id);
  }

  @Post(":id/restore")
  @HttpCode(200)
  @Header("Cache-Control", NO_STORE)
  @documentRestoreProduct()
  restore(@Param("id") id: string, @currentAdmin() admin: AdminProfile): Promise<AdminProduct> {
    return this.catalogue.restore(id, admin.id);
  }
}
