import { Body, Controller, Get, Header, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { deliveryResolveQuerySchema, updateDeliverySettingsRequestSchema } from "@entana/contracts";
import type {
  AdminDeliveryAxisListResponse,
  AdminDeliveryPlaceListResponse,
  AdminProfile,
  DeliveryResolveQuery,
  DeliveryResolveResponse,
  DeliverySettings,
  UpdateDeliverySettingsRequest,
} from "@entana/contracts";
import { currentAdmin } from "../admin-auth/http/authenticated-admin.js";
import { JsonContentTypeGuard } from "../errors/request-body/json-content-type.guard.js";
import { AdminDeliveryService } from "./admin-delivery.service.js";
import {
  documentGetDeliverySettings,
  documentListDeliveryAxes,
  documentListDeliveryPlaces,
  documentResolveDelivery,
  documentUpdateDeliverySettings,
} from "./http/admin-delivery-openapi.js";

// Errors carry it too (the problem filter sets it): this is for the answers of success.
const NO_STORE = "no-store";

@ApiTags("admin")
@Controller({ path: "admin/delivery", version: "1" })
export class AdminDeliveryController {
  constructor(private readonly delivery: AdminDeliveryService) {}

  @Get("axes")
  @Header("Cache-Control", NO_STORE)
  @documentListDeliveryAxes()
  listAxes(): Promise<AdminDeliveryAxisListResponse> {
    return this.delivery.listAxes();
  }

  @Get("places")
  @Header("Cache-Control", NO_STORE)
  @documentListDeliveryPlaces()
  listPlaces(): Promise<AdminDeliveryPlaceListResponse> {
    return this.delivery.listPlaces();
  }

  @Get("settings")
  @Header("Cache-Control", NO_STORE)
  @documentGetDeliverySettings()
  getSettings(): Promise<DeliverySettings> {
    return this.delivery.getSettings();
  }

  @Patch("settings")
  @UseGuards(JsonContentTypeGuard)
  @Header("Cache-Control", NO_STORE)
  @documentUpdateDeliverySettings()
  updateSettings(
    @Body({ schema: updateDeliverySettingsRequestSchema }) body: UpdateDeliverySettingsRequest,
    @currentAdmin() admin: AdminProfile,
  ): Promise<DeliverySettings> {
    return this.delivery.updateSettings(body, admin.id);
  }

  @Get("resolve")
  @Header("Cache-Control", NO_STORE)
  @documentResolveDelivery()
  resolve(
    @Query({ schema: deliveryResolveQuerySchema }) query: DeliveryResolveQuery,
  ): Promise<DeliveryResolveResponse> {
    return this.delivery.resolve(query);
  }
}
