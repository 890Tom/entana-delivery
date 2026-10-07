export interface SchemaObjects {
  readonly tables: readonly string[];
  readonly columns: readonly string[];
  readonly constraints: readonly string[];
  readonly indexes: readonly string[];
}

export interface ForbiddenStringInputs {
  readonly databaseName: string;
  readonly schemaObjects: SchemaObjects;
  /** The exact values inserted and the UUIDs used by the request under test. */
  readonly usedValues: readonly string[];
  readonly password: string;
  /** The connection string of the throwaway database (it holds the password). */
  readonly connectionString: string;
}

/**
 * What nothing the API sends or logs may contain, all lowercase (matching is case-insensitive).
 * - `valueScan`: broad names, looked for in parsed VALUES only (see findLeak).
 * - `rawScan`: high-signal strings, looked for in the RAW text, keys included.
 * - `tokenScan`: short codes, looked for as whole tokens, so that "23505" is not found inside a
 *   longer run of digits (a timestamp, a port, a response time).
 */
export interface ForbiddenStrings {
  readonly valueScan: readonly string[];
  readonly rawScan: readonly RawEntry[];
  readonly tokenScan: readonly string[];
}

/**
 * A high-signal string and the label a failure shows instead of it: the password, the connection
 * string and the inserted values must never reach a test report, so the label is the string itself
 * only when it is public (a SQL word, a constraint or index name).
 */
interface RawEntry {
  readonly label: string;
  readonly text: string;
}

export const OUTPUT_NAMES = ["headers", "body", "access log", "failure log", "console"] as const;

export type OutputName = (typeof OUTPUT_NAMES)[number];

/** One output of a request: its raw text and its leaf values (never keys). */
export interface OutputPart {
  readonly name: OutputName;
  readonly rawTexts: readonly string[];
  readonly values: readonly string[];
}

export type CapturedOutput = readonly OutputPart[];

/**
 * Broad names that are legitimate in one output (helmet's headers, the text pino-http writes for
 * a 5xx). An exemption is scoped to the output where it was observed, never global, and it only
 * applies to the value scan: the raw scan and the token scan have no exemption.
 */
export type Exemptions = Readonly<Record<OutputName, readonly string[]>>;

export const NO_EXEMPTIONS: Exemptions = {
  headers: [],
  body: [],
  "access log": [],
  "failure log": [],
  console: [],
};

// A name shorter than this is an ordinary word of our own JSON and logs ("id", "qty", "type",
// "name", "lat"): looking for it would flag legitimate output and prove nothing.
const MINIMUM_NAME_LENGTH = 6;

const BROAD_WORDS = ["prisma", "postgres", "insert", "select"] as const;
const HIGH_SIGNAL_WORDS = ["violates", "duplicate key", "constraint", "sqlstate"] as const;
// The codes observed in packages/database (Prisma codes and SQLSTATE).
const DRIVER_CODES = [
  "P2002",
  "P2003",
  "P2010",
  "P2025",
  "23505",
  "23503",
  "23514",
  "23502",
] as const;

function lowercaseUnique(strings: readonly string[]): string[] {
  return [...new Set(strings.map((value) => value.toLowerCase()).filter((value) => value !== ""))];
}

function publicEntries(texts: readonly string[]): RawEntry[] {
  return lowercaseUnique(texts).map((text) => ({ label: text, text }));
}

function secretEntries(label: string, texts: readonly string[]): RawEntry[] {
  const long = texts.filter((text) => text.length >= MINIMUM_NAME_LENGTH);
  return lowercaseUnique(long).map((text) => ({ label, text }));
}

export function buildForbiddenStrings(inputs: ForbiddenStringInputs): ForbiddenStrings {
  const { schemaObjects } = inputs;
  const longNames = [...schemaObjects.tables, ...schemaObjects.columns].filter(
    (name) => name.length >= MINIMUM_NAME_LENGTH,
  );
  // Constraint and index names are long and specific to the schema: they cannot collide with our
  // own keys, so they are looked for in the raw text.
  return {
    valueScan: lowercaseUnique([...longNames, ...BROAD_WORDS]),
    rawScan: [
      ...secretEntries("an inserted or used value", inputs.usedValues),
      // The password in both forms (decoded, and as it is written in a URL), and the full URL.
      ...secretEntries("the password", [inputs.password, encodeURIComponent(inputs.password)]),
      ...secretEntries("the connection string", [inputs.connectionString]),
      ...secretEntries("the database name", [inputs.databaseName]),
      ...publicEntries([
        ...HIGH_SIGNAL_WORDS,
        ...schemaObjects.constraints,
        ...schemaObjects.indexes,
      ]),
    ],
    tokenScan: lowercaseUnique(DRIVER_CODES),
  };
}

export function countForbiddenStrings(forbidden: ForbiddenStrings): number {
  return forbidden.valueScan.length + forbidden.rawScan.length + forbidden.tokenScan.length;
}

function containsToken(text: string, token: string): boolean {
  // The token is alphanumeric and fixed (see DRIVER_CODES): no pattern can backtrack.
  return new RegExp(`(?<![0-9a-z])${token}(?![0-9a-z])`, "i").test(text);
}

function lowercased(texts: readonly string[]): string[] {
  return texts.map((text) => text.toLowerCase());
}

function findNamesInValues(forbidden: ForbiddenStrings, part: OutputPart): string[] {
  const values = lowercased(part.values);
  return forbidden.valueScan.filter((name) => values.some((value) => value.includes(name)));
}

function findLeakInPart(
  forbidden: ForbiddenStrings,
  part: OutputPart,
  exemptions: Exemptions,
): string | undefined {
  const exempt = new Set(exemptions[part.name]);
  const rawTexts = lowercased(part.rawTexts);
  return (
    findNamesInValues(forbidden, part).find((name) => !exempt.has(name)) ??
    forbidden.rawScan.find((entry) => rawTexts.some((raw) => raw.includes(entry.text)))?.label ??
    forbidden.tokenScan.find((token) => rawTexts.some((raw) => containsToken(raw, token)))
  );
}

/**
 * The first forbidden string found in the output, or undefined. The result is the label of the
 * forbidden string (see RawEntry), never the content that contained it: a failure never prints
 * the output, and never the password.
 * Keys are the limit of the value scan: a table or column name that is also one of our own keys
 * (`status`, for instance) cannot be looked for in keys, so only values are scanned for the broad
 * names. The raw scan, which includes keys, only holds strings that cannot be our own keys.
 */
export function findLeak(
  forbidden: ForbiddenStrings,
  output: CapturedOutput,
  exemptions: Exemptions = NO_EXEMPTIONS,
): string | undefined {
  for (const part of output) {
    const leak = findLeakInPart(forbidden, part, exemptions);
    if (leak !== undefined) {
      return leak;
    }
  }
  return undefined;
}

/** Every exemption as an (output, name) pair, to print them or to try them elsewhere. */
export function listExemptions(exemptions: Exemptions): { output: OutputName; name: string }[] {
  return OUTPUT_NAMES.flatMap((output) => exemptions[output].map((name) => ({ output, name })));
}

/** The broad names found in each output of a request that is known to hold no database detail. */
export function observeBaseline(forbidden: ForbiddenStrings, output: CapturedOutput): Exemptions {
  const observed: Record<OutputName, string[]> = {
    headers: [],
    body: [],
    "access log": [],
    "failure log": [],
    console: [],
  };
  for (const part of output) {
    observed[part.name].push(...findNamesInValues(forbidden, part));
  }
  return observed;
}

/** The broad names that only appear as keys in the output (so the value scan ignores them). */
export function findNamesIgnoredAsKeys(
  forbidden: ForbiddenStrings,
  output: CapturedOutput,
): string[] {
  return output.flatMap((part) => {
    const rawTexts = lowercased(part.rawTexts);
    const found = new Set(findNamesInValues(forbidden, part));
    return forbidden.valueScan.filter(
      (name) => rawTexts.some((raw) => raw.includes(name)) && !found.has(name),
    );
  });
}

/** Every leaf (string, number, boolean) of a parsed JSON value, as text: never a key. */
export function collectLeafValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item: unknown) => collectLeafValues(item));
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap((item: unknown) => collectLeafValues(item));
  }
  if (typeof value === "string") {
    return [value];
  }
  const isPrimitiveLeaf =
    typeof value === "number" || typeof value === "boolean" || typeof value === "bigint";
  return isPrimitiveLeaf ? [String(value)] : [];
}
