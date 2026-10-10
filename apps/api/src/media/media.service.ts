import { Inject, Injectable } from "@nestjs/common";
import { MEDIA_ROOT } from "./media-root/media-root.token.js";
import { locateMediaFile } from "./file-lookup/locate-media-file.js";
import type { MediaFileInfo } from "./file-lookup/locate-media-file.js";

@Injectable()
export class MediaService {
  constructor(@Inject(MEDIA_ROOT) private readonly root: string) {}

  locate(folder: string, name: string): Promise<MediaFileInfo | null> {
    return locateMediaFile(this.root, folder, name);
  }
}
