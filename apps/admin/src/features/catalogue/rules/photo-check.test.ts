import { describe, expect, it } from "vitest";

import { checkPhotoDimensions, checkPhotoFile } from "./photo-check";

describe("checkPhotoFile", () => {
  it("accepts a JPEG, a PNG and a WebP", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(checkPhotoFile({ type, size: 1000 })).toBeNull();
    }
  });

  it("refuses another type", () => {
    expect(checkPhotoFile({ type: "image/gif", size: 1000 })).toBe("invalid");
  });

  it("refuses a file over 10 MB", () => {
    expect(checkPhotoFile({ type: "image/png", size: 10 * 1024 * 1024 + 1 })).toBe("tooLarge");
  });
});

describe("checkPhotoDimensions", () => {
  it("looks at the short side only", () => {
    expect(checkPhotoDimensions({ width: 800, height: 3000 })).toBeNull();
    expect(checkPhotoDimensions({ width: 799, height: 3000 })).toBe("tooSmall");
  });
});
