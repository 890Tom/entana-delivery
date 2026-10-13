import sharp from "sharp";

/** A smooth JPEG: it compresses like a photo. */
export async function gradientJpeg(width: number, height: number): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let index = 0; index < pixels.length; index += 3) {
    const x = (index / 3) % width;
    pixels[index] = (x * 255) / width;
    pixels[index + 1] = 100;
    pixels[index + 2] = 160;
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg()
    .toBuffer();
}
