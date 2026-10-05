import { readFileSync } from "node:fs";
import { z } from "zod";

const manifestSchema = z.object({ name: z.string().min(1), version: z.string().min(1) });

export type AppInfo = z.infer<typeof manifestSchema>;

export const APP_INFO = Symbol("APP_INFO");

/** Name and version from package.json. The path works from src/ and from dist/ alike. */
export function readAppInfo(): AppInfo {
  const manifest: unknown = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  return manifestSchema.parse(manifest);
}
