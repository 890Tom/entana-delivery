import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { createResellerRequestSchema, updateResellerRequestSchema } from "@entana/contracts";
import type {
  AdminProfile,
  AdminReseller,
  AdminResellerListResponse,
  CreateResellerRequest,
  UpdateResellerRequest,
} from "@entana/contracts";
import { currentAdmin } from "../admin-auth/http/authenticated-admin.js";
import { JsonContentTypeGuard } from "../errors/request-body/json-content-type.guard.js";
import { AdminResellersService } from "./admin-resellers.service.js";
import {
  documentCreateReseller,
  documentDeleteReseller,
  documentListResellers,
  documentUpdateReseller,
  documentVerifyReseller,
} from "./http/admin-resellers-openapi.js";

// Errors carry it too (the problem filter sets it): this is for the answers of success.
const NO_STORE = "no-store";

@ApiTags("admin")
@Controller({ path: "admin/resellers", version: "1" })
export class AdminResellersController {
  constructor(private readonly resellers: AdminResellersService) {}

  @Get()
  @Header("Cache-Control", NO_STORE)
  @documentListResellers()
  list(): Promise<AdminResellerListResponse> {
    return this.resellers.list();
  }

  @Post()
  @UseGuards(JsonContentTypeGuard)
  @Header("Cache-Control", NO_STORE)
  @documentCreateReseller()
  create(
    @Body({ schema: createResellerRequestSchema }) body: CreateResellerRequest,
    @currentAdmin() admin: AdminProfile,
  ): Promise<AdminReseller> {
    return this.resellers.create(body, admin.id);
  }

  @Patch(":id")
  @UseGuards(JsonContentTypeGuard)
  @Header("Cache-Control", NO_STORE)
  @documentUpdateReseller()
  update(
    @Param("id") id: string,
    @Body({ schema: updateResellerRequestSchema }) body: UpdateResellerRequest,
    @currentAdmin() admin: AdminProfile,
  ): Promise<AdminReseller> {
    return this.resellers.update(id, body, admin.id);
  }

  @Post(":id/verify")
  @HttpCode(200)
  @Header("Cache-Control", NO_STORE)
  @documentVerifyReseller()
  verify(@Param("id") id: string, @currentAdmin() admin: AdminProfile): Promise<AdminReseller> {
    return this.resellers.verify(id, admin.id);
  }

  @Delete(":id")
  @HttpCode(204)
  @Header("Cache-Control", NO_STORE)
  @documentDeleteReseller()
  remove(@Param("id") id: string, @currentAdmin() admin: AdminProfile): Promise<void> {
    return this.resellers.delete(id, admin.id);
  }
}
