import {
  BadRequestException,
  Body,
  Controller,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { createProductRequestSchema, updateProductRequestSchema } from "@entana/contracts";
import type {
  AdminProduct,
  AdminProfile,
  CreateProductRequest,
  UpdateProductRequest,
} from "@entana/contracts";
import { currentAdmin } from "../admin-auth/http/authenticated-admin.js";
import { JsonContentTypeGuard } from "../errors/request-body/json-content-type.guard.js";
import { AdminProductFormService } from "./admin-product-form.service.js";
import {
  documentCreateProduct,
  documentReplacePhoto,
  documentUpdateProduct,
} from "./http/admin-product-form-openapi.js";
import { ProductPhotoUploadInterceptor } from "./photo/product-photo-upload.interceptor.js";

// Errors carry it too (the problem filter sets it): this is for the answers of success.
const NO_STORE = "no-store";

/** The part of the uploaded file the service reads. */
interface UploadedPhoto {
  readonly buffer: Buffer;
}

@ApiTags("admin")
@Controller({ path: "admin/products", version: "1" })
export class AdminProductFormController {
  constructor(private readonly form: AdminProductFormService) {}

  @Post()
  @UseGuards(JsonContentTypeGuard)
  @Header("Cache-Control", NO_STORE)
  @documentCreateProduct()
  create(
    @Body({ schema: createProductRequestSchema }) body: CreateProductRequest,
    @currentAdmin() admin: AdminProfile,
  ): Promise<AdminProduct> {
    return this.form.create(body, admin.id);
  }

  @Patch(":id")
  @UseGuards(JsonContentTypeGuard)
  @Header("Cache-Control", NO_STORE)
  @documentUpdateProduct()
  update(
    @Param("id") id: string,
    @Body({ schema: updateProductRequestSchema }) body: UpdateProductRequest,
    @currentAdmin() admin: AdminProfile,
  ): Promise<AdminProduct> {
    return this.form.update(id, body, admin.id);
  }

  // No JSON guard: the body is multipart, read by the interceptor with its own size limit.
  @Put(":id/photo")
  @HttpCode(200)
  @UseInterceptors(ProductPhotoUploadInterceptor)
  @Header("Cache-Control", NO_STORE)
  @documentReplacePhoto()
  replacePhoto(
    @Param("id") id: string,
    @UploadedFile() file: UploadedPhoto | undefined,
    @currentAdmin() admin: AdminProfile,
  ): Promise<AdminProduct> {
    if (file === undefined) {
      throw new BadRequestException();
    }
    return this.form.replacePhoto(id, file.buffer, admin.id);
  }
}
