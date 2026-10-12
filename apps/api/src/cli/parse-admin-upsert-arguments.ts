import { parseArgs } from "node:util";
import { adminEmailSchema } from "@entana/contracts";

interface AdminUpsertArguments {
  readonly email: string;
  /** Absent: the part of the e-mail before the @ on creation, the current name otherwise. */
  readonly displayName: string | undefined;
  readonly isDisable: boolean;
}

export const ADMIN_UPSERT_USAGE =
  'Usage: admin:upsert <email> [--name "Display name"] [--disable]\n' +
  "The password is typed on the terminal when asked, never given as an argument.";

export type ParsedAdminUpsertArguments =
  | { readonly isValid: true; readonly arguments: AdminUpsertArguments }
  | { readonly isValid: false; readonly message: string };

/** The command line of the script. Messages are fixed: they never repeat what was typed. */
export function parseAdminUpsertArguments(argv: readonly string[]): ParsedAdminUpsertArguments {
  let parsed: ReturnType<typeof readOptions>;
  try {
    parsed = readOptions(argv);
  } catch {
    return { isValid: false, message: ADMIN_UPSERT_USAGE };
  }
  const [rawEmail, ...extra] = parsed.positionals;
  if (rawEmail === undefined || extra.length > 0) {
    return { isValid: false, message: ADMIN_UPSERT_USAGE };
  }
  const email = adminEmailSchema.safeParse(rawEmail);
  if (!email.success) {
    return { isValid: false, message: "The e-mail address is not valid." };
  }
  const displayName = parsed.values.name?.trim();
  return {
    isValid: true,
    arguments: {
      email: email.data,
      displayName: displayName === "" ? undefined : displayName,
      isDisable: parsed.values.disable === true,
    },
  };
}

function readOptions(argv: readonly string[]): {
  values: { name?: string | undefined; disable?: boolean | undefined };
  positionals: string[];
} {
  return parseArgs({
    args: [...argv],
    options: { name: { type: "string" }, disable: { type: "boolean" } },
    allowPositionals: true,
    strict: true,
  });
}
