import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mediaFileNameSchema } from "@entana/contracts";

const PRODUCTS_FOLDER = "products";

/**
 * Writes the photo under the products media folder with a random name: the name changes at every
 * replacement, so the file can be cached for ever. `wx` refuses to overwrite an existing file.
 * Returns the key stored in the database.
 */
export async function writeProductPhoto(mediaRoot: string, bytes: Buffer): Promise<string> {
  const key = `${randomUUID()}.webp`;
  const folder = join(mediaRoot, PRODUCTS_FOLDER);
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, key), bytes, { flag: "wx" });
  return key;
}

/**
 * Removes a photo file. The key comes from the database but is checked as a plain file name first:
 * a bad value must never reach a path. Returns whether the file is gone; a missing file counts.
 */
export async function removeProductPhoto(mediaRoot: string, key: string): Promise<boolean> {
  if (!mediaFileNameSchema.safeParse(key).success) {
    return false;
  }
  try {
    await unlink(join(mediaRoot, PRODUCTS_FOLDER, key));
    return true;
  } catch (error) {
    return (
      typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
    );
  }
}
