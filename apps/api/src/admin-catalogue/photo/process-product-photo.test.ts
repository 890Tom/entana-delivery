import sharp from "sharp";
import type { Sharp } from "sharp";
import { describe, expect, it } from "vitest";
import {
  PhotoCorruptError,
  PhotoFormatNotRecognizedError,
  PhotoTooSmallError,
} from "../errors/admin-catalogue-errors.js";
import { processProductPhoto } from "./process-product-photo.js";

// A smooth gradient: it compresses like a real photo, unlike noise.
function gradient(width: number, height: number): Buffer {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      pixels[offset] = (x * 255) / width;
      pixels[offset + 1] = (y * 255) / height;
      pixels[offset + 2] = 128;
    }
  }
  return pixels;
}

function source(width: number, height: number): Sharp {
  return sharp(gradient(width, height), { raw: { width, height, channels: 3 } });
}

describe("processProductPhoto", () => {
  it("makes one square WebP of 1000 px, under 150 KB, without metadata", async () => {
    const input = await source(1300, 1100)
      .jpeg()
      .withExif({ IFD0: { Copyright: "someone" } })
      .toBuffer();

    const output = await processProductPhoto(input);

    const metadata = await sharp(output).metadata();
    expect(metadata).toMatchObject({ format: "webp", width: 1000, height: 1000 });
    expect(metadata.exif).toBeUndefined();
    expect(output.length).toBeLessThanOrEqual(150_000);
  });

  it("never enlarges: a 900 px source stays at 900 px", async () => {
    const input = await source(900, 900).png().toBuffer();

    const metadata = await sharp(await processProductPhoto(input)).metadata();

    expect(metadata).toMatchObject({ width: 900, height: 900 });
  });

  it("crops the centre of a rectangle to a square of its short side", async () => {
    const input = await source(900, 1200).webp().toBuffer();

    const metadata = await sharp(await processProductPhoto(input)).metadata();

    expect(metadata).toMatchObject({ width: 900, height: 900 });
  });

  it("applies the EXIF rotation before the crop", async () => {
    // 1200 wide, 900 high, stored rotated: the displayed image is 900 wide and 1200 high.
    const input = await source(1200, 900).jpeg().withMetadata({ orientation: 6 }).toBuffer();

    const output = await processProductPhoto(input);

    const top = await sharp(output)
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .raw()
      .toBuffer();
    // Without the rotation, the top-left of the gradient is dark red; rotated by 90 degrees clockwise
    // the top-left comes from the bottom-left of the source: green is high.
    expect(top[1]).toBeGreaterThan(150);
  });

  it("flattens a transparent PNG on white", async () => {
    const input = await sharp({
      create: { width: 900, height: 900, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();

    const pixel = await sharp(await processProductPhoto(input))
      .raw()
      .toBuffer();

    expect(pixel[0]).toBeGreaterThan(250);
    expect(pixel[1]).toBeGreaterThan(250);
    expect(pixel[2]).toBeGreaterThan(250);
  });

  it("refuses an image whose short side is under 800 px", async () => {
    const input = await source(2000, 799).jpeg().toBuffer();

    await expect(processProductPhoto(input)).rejects.toBeInstanceOf(PhotoTooSmallError);
  });

  it("refuses a text file as an unrecognised format", async () => {
    await expect(processProductPhoto(Buffer.from("hello, not an image"))).rejects.toBeInstanceOf(
      PhotoFormatNotRecognizedError,
    );
  });

  it("refuses a format that is not JPEG, PNG or WebP, whatever its name", async () => {
    const gif = await source(900, 900).gif().toBuffer();

    await expect(processProductPhoto(gif)).rejects.toBeInstanceOf(PhotoFormatNotRecognizedError);
  });

  it("refuses a truncated image as corrupt", async () => {
    const whole = await source(1000, 1000).jpeg().toBuffer();

    await expect(processProductPhoto(whole.subarray(0, 2000))).rejects.toBeInstanceOf(
      PhotoCorruptError,
    );
  });

  it("refuses an image over 40 megapixels as corrupt, without decoding it", async () => {
    // 7000 x 6000 = 42 Mpx of one colour: small in bytes, large in pixels.
    const input = await sharp({
      create: { width: 7000, height: 6000, channels: 3, background: "#808080" },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();

    await expect(processProductPhoto(input)).rejects.toBeInstanceOf(PhotoCorruptError);
  });
});
