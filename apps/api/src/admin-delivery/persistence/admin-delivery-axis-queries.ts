import type { PrismaClient } from "@entana/database";
import type { AdminDeliveryDatabase } from "./admin-delivery-queries.js";

/** What the writes need from the client: the PrismaClient and its transaction client both fit. */
export type AdminDeliveryAxisDatabase = AdminDeliveryDatabase &
  Pick<PrismaClient, "axisPlace" | "customerOrder" | "$executeRaw">;

/**
 * One key for every write of the axes and of their places: two writes never run together, so the
 * checks made before an insert (names, rank, colour, limit) cannot be outdated when it happens.
 */
const AXES_LOCK_KEY = 6_702_001;

/** Held until the end of the transaction; the second writer waits for the first one. */
export async function lockDeliveryAxes(database: AdminDeliveryAxisDatabase): Promise<void> {
  await database.$executeRaw`SELECT pg_advisory_xact_lock(${AXES_LOCK_KEY})`;
}

/** The rank constraint is checked at commit, so that the ranks can be swapped one by one. */
export async function deferRankConstraint(database: AdminDeliveryAxisDatabase): Promise<void> {
  await database.$executeRaw`SET CONSTRAINTS "delivery_axis_rank_key" DEFERRED`;
}

export interface AxisSummary {
  readonly id: string;
  readonly rank: number;
}

export function listAxisSummaries(database: AdminDeliveryAxisDatabase): Promise<AxisSummary[]> {
  return database.deliveryAxis.findMany({
    select: { id: true, rank: true },
    orderBy: { rank: "asc" },
  });
}

export interface StoredAxisContent {
  readonly name: string;
  readonly active: boolean;
  readonly color: string;
  readonly placeIds: readonly string[];
}

export async function findAxisContent(
  database: AdminDeliveryAxisDatabase,
  id: string,
): Promise<StoredAxisContent | null> {
  const axis = await database.deliveryAxis.findUnique({
    where: { id },
    select: {
      name: true,
      active: true,
      color: true,
      places: { select: { placeId: true }, orderBy: { position: "asc" } },
    },
  });
  if (axis === null) {
    return null;
  }
  const { places, ...columns } = axis;
  return { ...columns, placeIds: places.map((link) => link.placeId) };
}

/** Whether another axis than `exceptId` has this name, whatever the case. */
export async function isAxisNameTaken(
  database: AdminDeliveryAxisDatabase,
  name: string,
  exceptId: string | null,
): Promise<boolean> {
  const count = await database.deliveryAxis.count({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(exceptId === null ? {} : { id: { not: exceptId } }),
    },
  });
  return count > 0;
}

export async function areAnyPlaceNamesTaken(
  database: AdminDeliveryAxisDatabase,
  names: readonly string[],
): Promise<boolean> {
  const count = await database.place.count({
    where: { OR: names.map((name) => ({ name: { equals: name, mode: "insensitive" } })) },
  });
  return count > 0;
}

export function findPlaceStates(
  database: AdminDeliveryAxisDatabase,
  ids: readonly string[],
): Promise<{ id: string; active: boolean }[]> {
  return database.place.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, active: true },
  });
}

export interface NewPlaceRow {
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
  readonly radiusM: number;
}

export async function insertPlace(
  database: AdminDeliveryAxisDatabase,
  place: NewPlaceRow,
): Promise<string> {
  const created = await database.place.create({
    data: { ...place, active: true },
    select: { id: true },
  });
  return created.id;
}

export interface NewAxisRow {
  readonly name: string;
  readonly active: boolean;
  readonly rank: number;
  readonly color: string;
  readonly placeIds: readonly string[];
}

export async function insertAxis(
  database: AdminDeliveryAxisDatabase,
  axis: NewAxisRow,
): Promise<string> {
  const { placeIds, ...columns } = axis;
  const created = await database.deliveryAxis.create({
    data: {
      ...columns,
      places: { create: placeIds.map((placeId, index) => ({ placeId, position: index + 1 })) },
    },
    select: { id: true },
  });
  return created.id;
}

export async function updateAxisColumns(
  database: AdminDeliveryAxisDatabase,
  id: string,
  data: { readonly name?: string; readonly active?: boolean; readonly color?: string },
): Promise<void> {
  await database.deliveryAxis.update({ where: { id }, data, select: { id: true } });
}

/** The links are replaced, never the places: a place that leaves an axis stays in the table. */
export async function replaceAxisPlaces(
  database: AdminDeliveryAxisDatabase,
  axisId: string,
  placeIds: readonly string[],
): Promise<void> {
  await database.axisPlace.deleteMany({ where: { axisId } });
  await database.axisPlace.createMany({
    data: placeIds.map((placeId, index) => ({ axisId, placeId, position: index + 1 })),
  });
}

export async function setAxisRank(
  database: AdminDeliveryAxisDatabase,
  id: string,
  rank: number,
): Promise<void> {
  await database.deliveryAxis.update({ where: { id }, data: { rank }, select: { id: true } });
}

export async function hasOrders(
  database: AdminDeliveryAxisDatabase,
  axisId: string,
): Promise<boolean> {
  return (await database.customerOrder.count({ where: { axisId } })) > 0;
}

/** The links go with the axis; the places stay. */
export async function deleteAxis(database: AdminDeliveryAxisDatabase, id: string): Promise<void> {
  await database.axisPlace.deleteMany({ where: { axisId: id } });
  await database.deliveryAxis.delete({ where: { id }, select: { id: true } });
}

/** What an audit entry of the axes may hold: ids, field names and numbers, never a name. */
type DeliveryAuditDiff =
  | { readonly fields: readonly string[] }
  | { readonly from: number; readonly to: number }
  | { readonly active: boolean; readonly places: number }
  | Record<string, never>;

export interface DeliveryAudit {
  readonly actorId: string;
  readonly action:
    | "delivery_axis.created"
    | "delivery_axis.updated"
    | "delivery_axis.reordered"
    | "delivery_axis.deleted"
    | "delivery_place.created";
  readonly entity: "delivery_axis" | "delivery_place";
  readonly entityId: string;
  readonly diff: DeliveryAuditDiff;
}

export async function insertDeliveryAudit(
  database: AdminDeliveryAxisDatabase,
  audit: DeliveryAudit,
): Promise<void> {
  await database.auditLog.create({ data: audit, select: { id: true } });
}
