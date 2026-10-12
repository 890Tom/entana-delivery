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

// The browser origin of the administration when none is configured, outside production only: the
// Vite development server of the administration (port 5174), reached as `localhost`. In
// production the variable is required (see the transform below).
const DEVELOPMENT_ADMIN_ORIGINS: readonly string[] = ["http://localhost:5174"];

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
    // Origins that may send a request that changes something under /api/v1/admin: the same form
    // as CORS_ORIGINS, but a separate list. It is not a CORS setting: the administration is called
    // from its own origin through a proxy, and cookies never cross origins.
    ADMIN_ALLOWED_ORIGINS: corsOriginsSchema,
    // Secure on the session cookie (and the __Host- prefix). On unless NODE_ENV says otherwise;
    // only local development over plain HTTP turns it off.
    ADMIN_COOKIE_SECURE: z.stringbool().optional(),
    TRUST_PROXY: trustProxySchema,
    BODY_LIMIT_KB: z.coerce.number().int().min(1).max(10240).default(100),
    SWAGGER_ENABLED: z.stringbool().optional(),
    DATABASE_URL: databaseUrlSchema,
    // Path of the instance configuration file. Absent: the demo file outside production, an error
    // in production (see loadInstanceConfig).
    INSTANCE_CONFIG_PATH: z.string().optional(),
    // Absolute path of the media folder (branding/ and products/). Required in production.
    MEDIA_ROOT: z.string().optional(),
  })
  .transform((env, context) => {
    const isProduction = env.NODE_ENV === "production";
    if (isProduction && env.ADMIN_ALLOWED_ORIGINS.length === 0) {
      context.issues.push({
        code: "custom",
        message: "Required in production: the origins of the administration, separated by commas.",
        input: undefined,
        path: ["ADMIN_ALLOWED_ORIGINS"],
      });
      return z.NEVER;
    }
    return {
      nodeEnv: env.NODE_ENV,
      host: env.HOST,
      port: env.PORT,
      logLevel: env.LOG_LEVEL,
      corsOrigins: env.CORS_ORIGINS,
      adminAllowedOrigins:
        env.ADMIN_ALLOWED_ORIGINS.length > 0
          ? env.ADMIN_ALLOWED_ORIGINS
          : DEVELOPMENT_ADMIN_ORIGINS,
      isAdminCookieSecure: env.ADMIN_COOKIE_SECURE ?? isProduction,
      trustProxy: env.TRUST_PROXY,
      bodyLimitKb: env.BODY_LIMIT_KB,
      // The API documentation is off in production unless it is asked for.
      isSwaggerEnabled: env.SWAGGER_ENABLED ?? !isProduction,
      databaseUrl: env.DATABASE_URL,
      instanceConfigPath: env.INSTANCE_CONFIG_PATH,
      mediaRoot: env.MEDIA_ROOT,
    };
  });

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
