import { describe, expect, it } from "vitest";
import { locateMediaFile } from "./locate-media-file.js";
import type { MediaFileSystem } from "./locate-media-file.js";

function failingFileSystem(): MediaFileSystem & { calls: number } {
  const spy = {
    calls: 0,
    realpath: (): Promise<string> => {
      spy.calls += 1;
      return Promise.reject(new Error("the disk must not be read"));
    },
    stat: (): Promise<{ isFile(): boolean; size: number }> => {
      spy.calls += 1;
      return Promise.reject(new Error("the disk must not be read"));
    },
  };
  return spy;
}

describe("locateMediaFile", () => {
  it.each([
    ["branding", "../x.png"],
    ["branding", "logo.svg"],
    ["branding", ".hidden.png"],
    ["secrets", "logo.png"],
  ])("refuses %s/%s without touching the disk", async (folder, name) => {
    const fileSystem = failingFileSystem();

    await expect(locateMediaFile("/media", folder, name, fileSystem)).resolves.toBeNull();
    expect(fileSystem.calls).toBe(0);
  });
});
