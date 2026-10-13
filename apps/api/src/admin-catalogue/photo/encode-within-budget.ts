const START_QUALITY = 85;
const FLOOR_QUALITY = 65;
const QUALITY_STEP = 4;

/**
 * Encodes at the starting quality, then lowers it by steps until the file fits the budget. At the
 * floor the file is kept even if it is over: a photo is never refused for its weight (the source
 * is already bounded in size and pixels).
 */
export async function encodeWithinBudget(
  encode: (quality: number) => Promise<Buffer>,
  budgetBytes: number,
): Promise<Buffer> {
  let quality = START_QUALITY;
  let encoded = await encode(quality);
  while (encoded.length > budgetBytes && quality - QUALITY_STEP >= FLOOR_QUALITY) {
    quality -= QUALITY_STEP;
    encoded = await encode(quality);
  }
  return encoded;
}
