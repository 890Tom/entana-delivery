import type { PrismaClient } from "@entana/database";
import type { StoredAdminReseller } from "../rules/to-admin-reseller.js";
import type { ResellerWrite } from "../rules/to-reseller-write.js";

/** What the queries need from the client: the PrismaClient and its transaction client both fit. */
export type AdminResellerDatabase = Pick<PrismaClient, "reseller" | "auditLog">;

// An explicit allow-list of the columns the administration reads and shows.
const RESELLER_SELECT = {
  id: true,
  name: true,
  area: true,
  landmarkText: true,
  lat: true,
  lng: true,
  active: true,
  consentAt: true,
  verifiedAt: true,
} as const;

/** Every reseller, by neighborhood then name. The id makes the order total. */
export function listResellers(database: AdminResellerDatabase): Promise<StoredAdminReseller[]> {
  return database.reseller.findMany({
    select: RESELLER_SELECT,
    orderBy: [{ area: "asc" }, { name: "asc" }, { id: "asc" }],
  });
}

export function findReseller(
  database: AdminResellerDatabase,
  id: string,
): Promise<StoredAdminReseller | null> {
  return database.reseller.findUnique({ where: { id }, select: RESELLER_SELECT });
}

export interface NewReseller {
  readonly name: string;
  readonly area: string;
  readonly landmarkText: string;
  readonly lat: number;
  readonly lng: number;
  readonly active: boolean;
  readonly consentAt: Date | null;
  readonly verifiedAt: Date;
}

export function insertReseller(
  database: AdminResellerDatabase,
  reseller: NewReseller,
): Promise<StoredAdminReseller> {
  return database.reseller.create({ data: reseller, select: RESELLER_SELECT });
}

export function updateReseller(
  database: AdminResellerDatabase,
  id: string,
  data: ResellerWrite & { readonly verifiedAt?: Date },
): Promise<StoredAdminReseller> {
  return database.reseller.update({ where: { id }, data, select: RESELLER_SELECT });
}

/** True when a row was removed. A reseller is removed for good: nothing points at it. */
export async function deleteReseller(
  database: AdminResellerDatabase,
  id: string,
): Promise<boolean> {
  const { count } = await database.reseller.deleteMany({ where: { id } });
  return count === 1;
}

/** What an audit entry may hold: flags and field names, never a name, a position or a phone. */
type AuditValue = boolean | readonly string[] | Readonly<Record<string, boolean>>;

export interface ResellerAudit {
  readonly actorId: string;
  readonly action:
    | "reseller.created"
    | "reseller.updated"
    | "reseller.consent_changed"
    | "reseller.published"
    | "reseller.unpublished"
    | "reseller.verified"
    | "reseller.deleted";
  readonly resellerId: string;
  readonly diff: Readonly<Record<string, AuditValue>>;
}

export async function insertResellerAudit(
  database: AdminResellerDatabase,
  audit: ResellerAudit,
): Promise<void> {
  await database.auditLog.create({
    data: {
      actorId: audit.actorId,
      action: audit.action,
      entity: "reseller",
      entityId: audit.resellerId,
      diff: audit.diff,
    },
    select: { id: true },
  });
}
