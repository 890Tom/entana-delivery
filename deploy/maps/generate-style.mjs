// Writes the style.json of the self-hosted map (deploy/maps/README.md):
//   node generate-style.mjs <archive>.pmtiles
// Run it from a temporary folder outside the repository, where the two libraries below are
// installed at exact versions: they are not dependencies of the repository.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { layers, namedFlavor } from "@protomaps/basemaps";

const SOURCE_ID = "protomaps";
const FLAVOR = "light";
const LANGUAGE = "fr";
// Same origin as the site: Caddy serves the maps folder under /maps/ (deploy/web/Caddyfile).
const MAPS_PATH = "/maps";
const GLYPHS = `${MAPS_PATH}/fonts/{fontstack}/{range}.pbf`;
// Required by the licences of the data (ODbL) and of the style (BSD-3-Clause).
const ATTRIBUTION =
  '<a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const ARCHIVE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.pmtiles$/;
// An address that would load something from another site: with a scheme, or protocol-relative.
const EXTERNAL_URL = /^(?:https?:)?\/\//i;

function readArchiveName(args) {
  const [name] = args;
  if (args.length !== 1 || name === undefined || !ARCHIVE_NAME.test(name)) {
    throw new Error(
      "Usage: node generate-style.mjs <archive>.pmtiles (letters, digits, '.', '_', '-').",
    );
  }
  return name;
}

const isIconProperty = (key) => key.startsWith("icon-");

const withoutIconProperties = (properties) =>
  Object.fromEntries(Object.entries(properties ?? {}).filter(([key]) => !isIconProperty(key)));

/**
 * No sprite is served: a layer that shows only an icon is dropped, and a layer that also has a
 * label keeps the label without its icon. Returns the layers and what changed, for the report.
 */
function removeIcons(styleLayers) {
  const kept = [];
  const changes = [];
  for (const layer of styleLayers) {
    if (layer.layout?.["icon-image"] === undefined) {
      kept.push(layer);
    } else if (layer.layout["text-field"] === undefined) {
      changes.push(`${layer.id}: removed (icon only)`);
    } else {
      kept.push({
        ...layer,
        layout: withoutIconProperties(layer.layout),
        paint: withoutIconProperties(layer.paint),
      });
      changes.push(`${layer.id}: icon removed, label kept`);
    }
  }
  return { kept, changes };
}

function buildStyle(archiveName, styleLayers) {
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      [SOURCE_ID]: {
        type: "vector",
        url: `pmtiles://${MAPS_PATH}/${archiveName}`,
        attribution: ATTRIBUTION,
      },
    },
    layers: styleLayers,
  };
}

/** Every address the browser would load. The attribution is text with links, not a resource. */
function resourceUrls(style) {
  const sources = Object.values(style.sources).flatMap((source) => [
    source.url,
    ...(source.tiles ?? []),
    typeof source.data === "string" ? source.data : undefined,
  ]);
  const sprites = Array.isArray(style.sprite)
    ? style.sprite.map((sprite) => sprite.url)
    : [style.sprite];
  return [...sources, style.glyphs, ...sprites].filter((url) => typeof url === "string");
}

const isNameList = (value) =>
  Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string");

/** Inside an expression, a font stack is a ["literal", [...]]; ["get", "min_zoom"] is not one. */
function collectLiteralStacks(expression, stacks) {
  if (!Array.isArray(expression)) {
    return;
  }
  if (expression[0] === "literal" && isNameList(expression[1])) {
    stacks.add(expression[1].join(","));
    return;
  }
  for (const item of expression) {
    collectLiteralStacks(item, stacks);
  }
}

/** A text-font is a list of names, or an expression that chooses between such lists. */
function fontStacksOf(styleLayers) {
  const stacks = new Set();
  for (const layer of styleLayers) {
    const textFont = layer.layout?.["text-font"];
    if (isNameList(textFont)) {
      stacks.add(textFont.join(","));
    } else {
      collectLiteralStacks(textFont, stacks);
    }
  }
  return [...stacks].sort();
}

function checkStyle(style) {
  const external = resourceUrls(style).filter((url) => EXTERNAL_URL.test(url));
  if (external.length > 0) {
    throw new Error(`External addresses in the style: ${external.join(", ")}`);
  }
  const errors = validateStyleMin(style);
  if (errors.length > 0) {
    throw new Error(`Invalid style:\n${errors.map((error) => `  ${error.message}`).join("\n")}`);
  }
}

function main() {
  const archiveName = readArchiveName(process.argv.slice(2));
  const { kept, changes } = removeIcons(layers(SOURCE_ID, namedFlavor(FLAVOR), { lang: LANGUAGE }));
  const style = buildStyle(archiveName, kept);
  checkStyle(style);
  const output = resolve("style.json");
  writeFileSync(output, `${JSON.stringify(style, null, 2)}\n`);
  const lines = [
    `Written: ${output} (${String(kept.length)} layers, source ${style.sources[SOURCE_ID].url})`,
    "Every resource address is on the site; the style is valid.",
    "Layers changed (no sprite):",
    ...changes.map((change) => `  ${change}`),
    "Font stacks to copy to <MAPS_DIR>/fonts/:",
    ...fontStacksOf(kept).map((stack) => `  ${stack}`),
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
