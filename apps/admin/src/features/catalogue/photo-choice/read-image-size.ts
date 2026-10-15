export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

/** The pixel size of an image file, or null when the browser cannot decode it. */
export async function readImageSize(file: Blob): Promise<ImageSize | null> {
  if (typeof createImageBitmap === "undefined") {
    return null;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    // A file that is not an image (or is cut) is refused like any other unreadable photo.
    return null;
  }
}
