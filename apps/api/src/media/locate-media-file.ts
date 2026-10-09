import { realpath, stat } from "node:fs/promises";
import { join } from "node:path";
import { brandingFileNameSchema } from "@entana/contracts";
import { isMediaFolder } from "./media-folders.js";

// Closed table: the type comes from the extension, never from the content.
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  png: "image/png",
  webp: "image/webp",
  jpg: "image/jpeg",
};

export interface MediaFileSystem {
  realpath(path: string): Promise<string>;
  stat(path: string): Promise<{ isFile(): boolean; size: number }>;
}

export interface MediaFileInfo {
  readonly path: string;
  readonly size: number;
  readonly contentType: string;
}

/**
 * Where a media file is, or null. The name is checked against the strict pattern BEFORE any disk
 * access. Then the real path of the file must be exactly the expected path under the real root: a
 * symbolic link, in the file or in a parent folder, changes it and is refused.
 */
export async function locateMediaFile(
  root: string,
  folder: string,
  name: string,
  fileSystem: MediaFileSystem = { realpath, stat },
): Promise<MediaFileInfo | null> {
  const contentType = CONTENT_TYPES[name.slice(name.lastIndexOf(".") + 1)];
  if (!isMediaFolder(folder) || !brandingFileNameSchema.safeParse(name).success) {
    return null;
  }
  if (contentType === undefined) {
    return null;
  }
  try {
    const expected = join(await fileSystem.realpath(root), folder, name);
    if ((await fileSystem.realpath(join(root, folder, name))) !== expected) {
      return null;
    }
    const file = await fileSystem.stat(expected);
    return file.isFile() ? { path: expected, size: file.size, contentType } : null;
  } catch {
    return null;
  }
}
