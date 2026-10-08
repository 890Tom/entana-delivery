import { resolveConfig } from "./lint-fixture";

export interface RestrictedEntry {
  readonly message: string;
  readonly selector?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readEntry(value: unknown): RestrictedEntry | undefined {
  if (!isRecord(value) || typeof value.message !== "string") {
    return undefined;
  }
  const selector = value.selector;
  return typeof selector === "string"
    ? { message: value.message, selector }
    : { message: value.message };
}

async function readRule(filePath: string, ruleId: string): Promise<readonly unknown[]> {
  const { rules } = await resolveConfig(filePath);
  const setting: unknown = rules?.[ruleId];
  return Array.isArray(setting) ? setting.map((item: unknown) => item) : [setting];
}

/** True when the rule is an error in the configuration that applies to `filePath`. */
export async function isRuleAnError(filePath: string, ruleId: string): Promise<boolean> {
  const [severity] = await readRule(filePath, ruleId);
  return severity === 2 || severity === "error";
}

/** The selectors or properties configured for `ruleId` in the merged configuration. */
export async function readRestrictedEntries(
  filePath: string,
  ruleId: string,
): Promise<readonly RestrictedEntry[]> {
  const [, ...options] = await readRule(filePath, ruleId);
  return options.flatMap((option) => readEntry(option) ?? []);
}
