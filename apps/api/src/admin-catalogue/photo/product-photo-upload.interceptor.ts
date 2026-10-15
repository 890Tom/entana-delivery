import {
  BadRequestException,
  HttpException,
  Injectable,
  PayloadTooLargeException,
} from "@nestjs/common";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { PRODUCT_PHOTO_MAX_BYTES } from "@entana/contracts";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import type { Observable } from "rxjs";
import { UnsupportedContentTypeError } from "../../errors/request-body/unsupported-content-type-error.js";
import { PhotoTooLargeError } from "../errors/admin-catalogue-errors.js";

// The file is read in memory (no `dest`), bounded by the limit; `fields: 0` refuses every text
// field, so nothing but the file is read and no field name or value reaches the application.
const uploadOfOnePhoto = FileInterceptor("photo", {
  limits: { fileSize: PRODUCT_PHOTO_MAX_BYTES, files: 1, fields: 0, parts: 1 },
});

/**
 * Reads the single `photo` file of the multipart body. The route is exempt from the JSON guard
 * and from the JSON size limit; its own limit is PRODUCT_PHOTO_MAX_BYTES, and the answer of a body that
 * is too large is the typed photo error instead of a bare 413.
 */
@Injectable()
export class ProductPhotoUploadInterceptor extends uploadOfOnePhoto {
  override async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.is("multipart/form-data") !== "multipart/form-data") {
      throw new UnsupportedContentTypeError();
    }
    try {
      return await super.intercept(context, next);
    } catch (error) {
      if (error instanceof PayloadTooLargeException) {
        throw new PhotoTooLargeError();
      }
      // The multipart parser fails with a plain Error on a malformed body: the client's fault,
      // and its message (which can quote the body) is dropped.
      throw error instanceof HttpException ? error : new BadRequestException();
    }
  }
}
