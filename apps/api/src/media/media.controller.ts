import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { pipeline } from "node:stream";
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  Res,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request, Response } from "express";
import type { MediaFileInfo } from "./file-lookup/locate-media-file.js";
import { MediaService } from "./media.service.js";

// The branding files are replaced by hand under the same name: a short cache.
const MEDIA_CACHE_CONTROL = "public, max-age=3600";
// An uploaded product photo is named <uuid>.webp and gets a new name at every replacement: it
// never changes. A file placed by hand under another name can be replaced under that name.
const IMMUTABLE_MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable";
const UPLOADED_PHOTO_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

/** Read-only media: GET and HEAD of a file of the branding or products folder. No listing. */
@ApiExcludeController()
@Controller({ path: "media", version: VERSION_NEUTRAL })
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get(":folder/:file")
  async serve(
    @Param("folder") folder: string,
    @Param("file") file: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const media = await this.mediaService.locate(folder, file);
    if (media === null) {
      throw new NotFoundException();
    }
    if (request.method === "HEAD") {
      // The same headers and no body: no file is opened.
      setMediaHeaders(response, media, folder, file);
      response.end();
      return;
    }
    // O_NOFOLLOW: a file replaced by a symbolic link after the check is refused by the system.
    const handle = await open(media.path, constants.O_RDONLY | constants.O_NOFOLLOW).catch(() => {
      throw new NotFoundException();
    });
    setMediaHeaders(response, media, folder, file);
    pipeline(handle.createReadStream(), response, () => undefined);
  }
}

function setMediaHeaders(
  response: Response,
  media: MediaFileInfo,
  folder: string,
  file: string,
): void {
  response.status(200);
  response.setHeader("Content-Type", media.contentType);
  response.setHeader("Content-Length", String(media.size));
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Security-Policy", "default-src 'none'");
  // Public by design: the apps on other origins load these images (helmet says same-origin).
  response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  response.setHeader(
    "Cache-Control",
    folder === "products" && UPLOADED_PHOTO_NAME.test(file)
      ? IMMUTABLE_MEDIA_CACHE_CONTROL
      : MEDIA_CACHE_CONTROL,
  );
}
