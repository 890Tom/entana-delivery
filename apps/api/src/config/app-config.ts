import { z } from "zod";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

function isOrigin(value: string): boolean {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}

// An origin is a scheme, a host and an optional port, with no path: the exact form that
// browsers send in the Origin header, so that comparing strings is enough.
const originSchema = z
  .string()
  .refine(isOrigin, "Must be an origin such as https://shop.example.mg (no path, no wildcard).");

const corsOriginsSchema = z
  .string()
  .default("")
  .transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ""),
  )
  .pipe(z.array(originSchema));

// Only a number of hops is accepted. `true` would trust every X-Forwarded-For entry, which lets
// any client choose the address that the application sees.
const trustProxySchema = z
  .string()
  .default("false")
  .transform((value, context) => {
    if (value === "false") {
      return false;
    }
    if (/^[1-9]\d*$/.test(value)) {
      return Number(value);
    }
    context.issues.push({
      code: "custom",
      message: "Must be false or a number of proxy hops (1 or more).",
      input: value,
    });
    return z.NEVER;
  });

// No whitespace or control character anywhere: a trailing newline from an env file is the likely
// case. The value is neither trimmed nor parsed, because createPrismaClient validates the URL.
// The message must not echo the value, which holds the password.
const databaseUrlSchema = z
  .string()
  .regex(/^[^\s\p{Cc}]+$/u, "Must not contain whitespace or control characters.");

// A country calling code is 1 to 3 digits and never starts with 0 (what normalizePhone accepts).
// The message must not echo the value. Moving it to the instance configuration is a later task.
const phoneCountryCodeSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,2}$/, "Must be 1 to 3 digits and must not start with 0.")
  .default("261");

const configSchema = z
  .object({
    // Production when unset: a deployment that forgets the variable must not expose the API
    // documentation or relax the security headers.
    NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
    // 0.0.0.0 listens on every interface, which a container needs. Local development sets
    // HOST=127.0.0.1 in .env so that the API is not reachable from the network.
    HOST: z.string().min(1).default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
    CORS_ORIGINS: corsOriginsSchema,
    TRUST_PROXY: trustProxySchema,
    BODY_LIMIT_KB: z.coerce.number().int().min(1).max(10240).default(100),
    SWAGGER_ENABLED: z.stringbool().optional(),
    DATABASE_URL: databaseUrlSchema,
    DEFAULT_PHONE_COUNTRY_CODE: phoneCountryCodeSchema,
  })
  .transform((env) => ({
    nodeEnv: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    corsOrigins: env.CORS_ORIGINS,
    trustProxy: env.TRUST_PROXY,
    bodyLimitKb: env.BODY_LIMIT_KB,
    // The API documentation is off in production unless it is asked for.
    isSwaggerEnabled: env.SWAGGER_ENABLED ?? env.NODE_ENV !== "production",
    databaseUrl: env.DATABASE_URL,
    defaultPhoneCountryCode: env.DEFAULT_PHONE_COUNTRY_CODE,
  }));

export type AppConfig = Readonly<z.output<typeof configSchema>>;

/** Thrown when the environment is invalid. It names the variables, never their values. */
export class InvalidConfigurationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(["Invalid configuration:", ...issues.map((issue) => `  - ${issue}`)].join("\n"));
    this.name = "InvalidConfigurationError";
  }
}

function withoutEmptyValues(
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const entries = Object.entries(env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== "",
  );
  return Object.fromEntries(entries);
}

/** Validates the environment variables. Pure: pass `process.env` from the entry point only. */
export function parseConfig(env: Readonly<Record<string, string | undefined>>): AppConfig {
  const result = configSchema.safeParse(withoutEmptyValues(env));
  if (!result.success) {
    throw new InvalidConfigurationError(
      result.error.issues.map((issue) => `${issue.path.slice(0, 1).join("")}: ${issue.message}`),
    );
  }
  return result.data;
}
