import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InvalidInstanceConfigurationError } from "../errors/invalid-instance-configuration-error.js";
import { loadInstanceConfig } from "./load-instance-config.js";

const VALID_YAML = `
shop:
  name: Chez Test
locale:
  default: fr
  available: [fr]
currency: MGA
timezone: Indian/Antananarivo
phoneCountryCode: "261"
`;

// A value that must never come back in a message.
const SECRET = "hunter2-secret";

let directory: string;
let counter = 0;

function writeConfig(content: string): string {
  counter += 1;
  const path = join(directory, `config-${String(counter)}.yaml`);
  writeFileSync(path, content);
  return path;
}

function loadFrom(content: string): ReturnType<typeof loadInstanceConfig> {
  return loadInstanceConfig({ nodeEnv: "production", path: writeConfig(content) });
}

function failureOf(action: () => unknown): string {
  try {
    action();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(InvalidInstanceConfigurationError);
    return (error as Error).message;
  }
  throw new Error("expected the load to fail");
}

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "entana-instance-"));
});
afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("loadInstanceConfig", () => {
  it("loads a valid configuration", () => {
    expect(loadFrom(VALID_YAML)).toMatchObject({
      shop: { name: "Chez Test" },
      phoneCountryCode: "261",
    });
  });

  it("loads a valid map section", () => {
    const yaml = `${VALID_YAML}map:\n  styleUrl: /tiles/style.json\n  center: { lat: -18.8, lng: 47.4 }\n  zoom: 14\n`;

    expect(loadFrom(yaml).map).toEqual({
      styleUrl: "/tiles/style.json",
      center: { lat: -18.8, lng: 47.4 },
      zoom: 14,
    });
  });

  it("applies the default map when the section is absent", () => {
    expect(loadFrom(VALID_YAML).map).toEqual({
      styleUrl: "https://tiles.openfreemap.org/styles/liberty",
      center: { lat: -18.91, lng: 47.52 },
      zoom: 12,
    });
  });

  it.each([
    ["http", `map:\n  styleUrl: "http://${SECRET}.example.org/style"\n`, "map.styleUrl", SECRET],
    [
      "credentials in the address",
      `map:\n  styleUrl: "https://user:${SECRET}@tiles.example.org/style"\n`,
      "map.styleUrl",
      SECRET,
    ],
    ["a javascript: address", `map:\n  styleUrl: "javascript:${SECRET}"\n`, "map.styleUrl", SECRET],
    [
      "a //host address",
      `map:\n  styleUrl: "//${SECRET}.example.org/style"\n`,
      "map.styleUrl",
      SECRET,
    ],
    ["a latitude out of bounds", "map:\n  center: { lat: 9191 }\n", "map.center.lat", "9191"],
    ["a zoom out of bounds", "map:\n  zoom: 9999\n", "map.zoom", "9999"],
  ])("names the key and not the value for %s", (_label, section, key, leaked) => {
    const message = failureOf(() => loadFrom(`${VALID_YAML}${section}`));

    expect(message).toContain(`- ${key}`);
    expect(message).not.toContain(leaked);
  });

  it("uses the demo file outside production when no path is given", () => {
    const config = loadInstanceConfig({ nodeEnv: "development", path: undefined });

    expect(config.shop.name).toBe("Boutique de démonstration");
    expect(config.phoneCountryCode).toBe("261");
  });

  it("refuses to start in production without a path", () => {
    const message = failureOf(() => loadInstanceConfig({ nodeEnv: "production", path: undefined }));

    expect(message).toContain("INSTANCE_CONFIG_PATH");
  });

  it("refuses to start when the file does not exist", () => {
    const missing = join(directory, "absent.yaml");

    expect(failureOf(() => loadInstanceConfig({ nodeEnv: "production", path: missing }))).toContain(
      "introuvable",
    );
  });

  it("refuses a file larger than 64 KiB", () => {
    const message = failureOf(() => loadFrom(`${VALID_YAML}# ${"x".repeat(64 * 1024)}\n`));

    expect(message).toContain("trop volumineux");
  });

  it.each([
    ["an empty shop name", VALID_YAML.replace("Chez Test", `""`), "shop.name"],
    [
      "an unknown time zone",
      VALID_YAML.replace("Indian/Antananarivo", `Mars/${SECRET}`),
      "timezone",
    ],
    ["a bad phone country code", VALID_YAML.replace(`"261"`, `"0${SECRET}"`), "phoneCountryCode"],
    [
      "a logo with a path separator",
      `${VALID_YAML}branding:\n  logoFile: ../${SECRET}.png\n`,
      "branding.logoFile",
    ],
    [
      "an svg logo",
      `${VALID_YAML}branding:\n  appIconFile: ${SECRET}.svg\n`,
      "branding.appIconFile",
    ],
    ["an unknown key", `${VALID_YAML}extra: ${SECRET}\n`, "extra"],
  ])("names the key and not the value for %s", (_label, yaml, key) => {
    const message = failureOf(() => loadFrom(yaml));

    expect(message).toContain(`- ${key}\n`.trimEnd());
    expect(message).not.toContain(SECRET);
  });

  it("refuses a custom tag, without quoting the file", () => {
    const message = failureOf(() =>
      loadFrom(VALID_YAML.replace("Chez Test", `!!js/function ${SECRET}`)),
    );

    expect(message).toContain("YAML");
    expect(message).not.toContain(SECRET);
  });

  it("refuses any alias", () => {
    const aliased = VALID_YAML.replace("Chez Test", "&name Chez Test") + "other: *name\n";

    expect(failureOf(() => loadFrom(aliased))).toContain("YAML");
  });

  it("refuses a document nested deeply enough to overflow the parser", () => {
    expect(failureOf(() => loadFrom("[".repeat(30000)))).toContain("YAML");
  });
});
