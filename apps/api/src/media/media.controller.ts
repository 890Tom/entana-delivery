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
import type { MediaFileInfo } from "./locate-media-file.js";
import { MediaService } from "./media.service.js";

// The files are public and change only when someone replaces one by hand.
const MEDIA_CACHE_CONTROL = "public, max-age=3600";

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
      setMediaHeaders(response, media);
      response.end();
      return;
    }
    // O_NOFOLLOW: a file replaced by a symbolic link after the check is refused by the system.
    const handle = await open(media.path, constants.O_RDONLY | constants.O_NOFOLLOW).catch(() => {
      throw new NotFoundException();
    });
    setMediaHeaders(response, media);
    pipeline(handle.createReadStream(), response, () => undefined);
  }
}

function setMediaHeaders(response: Response, media: MediaFileInfo): void {
  response.status(200);
  response.setHeader("Content-Type", media.contentType);
  response.setHeader("Content-Length", String(media.size));
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Security-Policy", "default-src 'none'");
  // Public by design: the apps on other origins load these images (helmet says same-origin).
  response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  response.setHeader("Cache-Control", MEDIA_CACHE_CONTROL);
}
