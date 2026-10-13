import { vi } from "vitest";

/**
 * jsdom decodes no image and has no object URLs: the size the browser would read is given, and
 * the address of a chosen photo is a fixed one.
 */
export function stubPhotoSupport(size: { width: number; height: number }): void {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(() => Promise.resolve({ ...size, close: vi.fn() })),
  );
  URL.createObjectURL = vi.fn(() => "blob:chosen-photo");
  URL.revokeObjectURL = vi.fn();
}

export const photoFile = (type = "image/png"): File => new File(["photo"], "mangue.png", { type });
