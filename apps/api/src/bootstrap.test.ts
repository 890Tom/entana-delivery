import { describe, expect, it } from "vitest";
import { bootstrap } from "./bootstrap.js";

const DEMO_ENV = { NODE_ENV: "production", DATABASE_URL: "postgresql://t:t@localhost:5432/t" };

async function run(env: Record<string, string>): Promise<{ code: number; output: string }> {
  let output = "";
  const code = await bootstrap(env, {
    write: (text: string) => {
      output += text;
      return true;
    },
  });
  return { code, output };
}

describe("bootstrap", () => {
  it("stops with code 1 and only the French message when the instance file is missing", async () => {
    const { code, output } = await run({ ...DEMO_ENV, MEDIA_ROOT: "/tmp" });

    expect(code).toBe(1);
    expect(output).toContain("INSTANCE_CONFIG_PATH");
    expect(output.trim().split("\n")).toHaveLength(1);
  });

  it("stops with code 1 naming MEDIA_ROOT when it is missing in production", async () => {
    const { code, output } = await run({
      ...DEMO_ENV,
      INSTANCE_CONFIG_PATH: new URL("../../../examples/demo/instance.config.yaml", import.meta.url)
        .pathname,
    });

    expect(code).toBe(1);
    expect(output).toContain("MEDIA_ROOT");
  });

  it("validates the environment first: DATABASE_URL is named before the files", async () => {
    const { code, output } = await run({ NODE_ENV: "production" });

    expect(code).toBe(1);
    expect(output).toContain("DATABASE_URL");
    expect(output).not.toContain("INSTANCE_CONFIG_PATH");
  });
});
