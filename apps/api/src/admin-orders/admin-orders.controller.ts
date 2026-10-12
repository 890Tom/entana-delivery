import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  adminOrderListQuerySchema,
  adminOrderSummaryQuerySchema,
  statusTransitionRequestSchema,
} from "@entana/contracts";
import type {
  AdminOrderDetail,
  AdminOrderListQuery,
  AdminOrderListResponse,
  AdminOrderSummaryQuery,
  AdminOrderSummaryResponse,
  AdminProfile,
  StatusTransitionRequest,
} from "@entana/contracts";
import { currentAdmin } from "../admin-auth/http/authenticated-admin.js";
import { JsonContentTypeGuard } from "../errors/request-body/json-content-type.guard.js";
import { AdminOrdersService } from "./admin-orders.service.js";
import {
  documentChangeStatus,
  documentGetOrder,
  documentListOrders,
  documentOrdersSummary,
} from "./http/admin-orders-openapi.js";

// Errors carry it too (the problem filter sets it): this is for the answers of success.
const NO_STORE = "no-store";

@ApiTags("admin")
@Controller({ path: "admin/orders", version: "1" })
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  @Header("Cache-Control", NO_STORE)
  @documentListOrders()
  list(
    @Query({ schema: adminOrderListQuerySchema }) query: AdminOrderListQuery,
  ): Promise<AdminOrderListResponse> {
    return this.orders.listOrders(query);
  }

  // Declared before `:id`, which would take "summary" for an order id.
  @Get("summary")
  @Header("Cache-Control", NO_STORE)
  @documentOrdersSummary()
  summary(
    @Query({ schema: adminOrderSummaryQuerySchema }) query: AdminOrderSummaryQuery,
  ): Promise<AdminOrderSummaryResponse> {
    return this.orders.getSummary(query);
  }

  @Get(":id")
  @Header("Cache-Control", NO_STORE)
  @documentGetOrder()
  read(@Param("id") id: string): Promise<AdminOrderDetail> {
    return this.orders.getOrder(id);
  }

  @Post(":id/transitions")
  @HttpCode(200)
  @UseGuards(JsonContentTypeGuard)
  @Header("Cache-Control", NO_STORE)
  @documentChangeStatus()
  changeStatus(
    @Param("id") id: string,
    @Body({ schema: statusTransitionRequestSchema }) body: StatusTransitionRequest,
    @currentAdmin() admin: AdminProfile,
  ): Promise<AdminOrderDetail> {
    return this.orders.changeStatus(id, body, admin.id);
  }
}
