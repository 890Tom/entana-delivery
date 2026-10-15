import { Inject, Injectable } from "@nestjs/common";
import { planAxisReorder, planAxisUpdate } from "@entana/contracts";
import type {
  AdminDeliveryAxis,
  AdminDeliveryAxisListResponse,
  DeliveryAxisField,
  ReorderDeliveryAxesRequest,
  SaveDeliveryAxisRequest,
} from "@entana/contracts";
import type { PrismaClient } from "@entana/database";
import { z } from "zod";
import { DATABASE_CLIENT } from "../database/client-token/database-client.js";
import { resolveAxisPlaces } from "./persistence/delivery-axis-places.js";
import type { ResolvedPlaces } from "./persistence/delivery-axis-places.js";
import {
  AdminDeliveryAxisNotFoundError,
  DeliveryAxisInUseError,
  DeliveryAxisNameTakenError,
  DeliveryAxisOrderMismatchError,
} from "./errors/admin-delivery-errors.js";
import {
  deferRankConstraint,
  deleteAxis,
  findAxisContent,
  hasOrders,
  insertAxis,
  insertDeliveryAudit,
  isAxisNameTaken,
  listAxisSummaries,
  lockDeliveryAxes,
  replaceAxisPlaces,
  setAxisRank,
  updateAxisColumns,
} from "./persistence/admin-delivery-axis-queries.js";
import type { AdminDeliveryAxisDatabase } from "./persistence/admin-delivery-axis-queries.js";
import { listAxesWithPlaces } from "./persistence/admin-delivery-queries.js";
import { toAdminDeliveryAxes } from "./rules/to-admin-delivery.js";

/** What the service needs from the database client: the PrismaClient fits. */
export type AdminDeliveryAxesClient = Pick<PrismaClient, "$transaction"> &
  AdminDeliveryAxisDatabase;

const axisIdSchema = z.uuid();
const NO_LINKED_PLACE: ReadonlySet<string> = new Set();

// A malformed id is the same "not found" as an unknown one, and never reaches the database.
function parseAxisId(id: string): string {
  const parsed = axisIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new AdminDeliveryAxisNotFoundError();
  }
  return parsed.data.toLowerCase();
}

async function assertAxisNameFree(
  database: AdminDeliveryAxisDatabase,
  name: string,
  exceptId: string | null,
): Promise<void> {
  if (await isAxisNameTaken(database, name, exceptId)) {
    throw new DeliveryAxisNameTakenError();
  }
}

async function listAxes(
  database: AdminDeliveryAxisDatabase,
): Promise<AdminDeliveryAxisListResponse> {
  return toAdminDeliveryAxes(await listAxesWithPlaces(database));
}

async function readAxis(
  database: AdminDeliveryAxisDatabase,
  id: string,
): Promise<AdminDeliveryAxis> {
  const axis = (await listAxes(database)).axes.find((candidate) => candidate.id === id);
  if (axis === undefined) {
    throw new AdminDeliveryAxisNotFoundError();
  }
  return axis;
}

async function auditCreatedPlaces(
  database: AdminDeliveryAxisDatabase,
  actorId: string,
  places: ResolvedPlaces,
): Promise<void> {
  for (const entityId of places.createdIds) {
    await insertDeliveryAudit(database, {
      actorId,
      action: "delivery_place.created",
      entity: "delivery_place",
      entityId,
      diff: {},
    });
  }
}

interface AxisChanges {
  readonly axisId: string;
  readonly request: SaveDeliveryAxisRequest;
  readonly fields: readonly DeliveryAxisField[];
  readonly placeIds: readonly string[];
}

async function applyAxisChanges(
  database: AdminDeliveryAxisDatabase,
  { axisId, request, fields, placeIds }: AxisChanges,
): Promise<void> {
  await updateAxisColumns(database, axisId, {
    ...(fields.includes("name") ? { name: request.name } : {}),
    ...(fields.includes("active") ? { active: request.active } : {}),
    ...(fields.includes("color") ? { color: request.color } : {}),
  });
  if (fields.includes("places")) {
    await replaceAxisPlaces(database, axisId, placeIds);
  }
}

/** The writes of the delivery axes. Each one holds the lock of the axes for its transaction. */
@Injectable()
export class AdminDeliveryAxesService {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: AdminDeliveryAxesClient) {}

  /** The axis comes last; the new places are created with it. */
  async create(request: SaveDeliveryAxisRequest, adminId: string): Promise<AdminDeliveryAxis> {
    return this.database.$transaction(async (transaction) => {
      await lockDeliveryAxes(transaction);
      const axes = await listAxisSummaries(transaction);
      await assertAxisNameFree(transaction, request.name, null);
      const places = await resolveAxisPlaces(transaction, request.places, NO_LINKED_PLACE);
      const axisId = await insertAxis(transaction, {
        name: request.name,
        active: request.active,
        rank: Math.max(0, ...axes.map((axis) => axis.rank)) + 1,
        color: request.color,
        placeIds: places.placeIds,
      });
      await insertDeliveryAudit(transaction, {
        actorId: adminId,
        action: "delivery_axis.created",
        entity: "delivery_axis",
        entityId: axisId,
        diff: { active: request.active, places: places.placeIds.length },
      });
      await auditCreatedPlaces(transaction, adminId, places);
      return readAxis(transaction, axisId);
    });
  }

  async replace(
    id: string,
    request: SaveDeliveryAxisRequest,
    adminId: string,
  ): Promise<AdminDeliveryAxis> {
    const axisId = parseAxisId(id);
    return this.database.$transaction(async (transaction) => {
      await lockDeliveryAxes(transaction);
      const before = await findAxisContent(transaction, axisId);
      if (before === null) {
        throw new AdminDeliveryAxisNotFoundError();
      }
      await assertAxisNameFree(transaction, request.name, axisId);
      const places = await resolveAxisPlaces(transaction, request.places, new Set(before.placeIds));
      const plan = planAxisUpdate(before, {
        name: request.name,
        active: request.active,
        color: request.color,
        placeIds: places.placeIds,
      });
      if (plan.kind === "changed") {
        await applyAxisChanges(transaction, {
          axisId,
          request,
          fields: plan.fields,
          placeIds: places.placeIds,
        });
        await insertDeliveryAudit(transaction, {
          actorId: adminId,
          action: "delivery_axis.updated",
          entity: "delivery_axis",
          entityId: axisId,
          diff: { fields: plan.fields },
        });
        await auditCreatedPlaces(transaction, adminId, places);
      }
      return readAxis(transaction, axisId);
    });
  }

  /** The ranks become 1..n in the order received; only the axes that move are audited. */
  async reorder(
    request: ReorderDeliveryAxesRequest,
    adminId: string,
  ): Promise<AdminDeliveryAxisListResponse> {
    return this.database.$transaction(async (transaction) => {
      await lockDeliveryAxes(transaction);
      const plan = planAxisReorder(await listAxisSummaries(transaction), request.ids);
      if (plan.kind === "mismatch") {
        throw new DeliveryAxisOrderMismatchError();
      }
      if (plan.moves.length > 0) {
        await deferRankConstraint(transaction);
      }
      for (const move of plan.moves) {
        await setAxisRank(transaction, move.id, move.to);
        await insertDeliveryAudit(transaction, {
          actorId: adminId,
          action: "delivery_axis.reordered",
          entity: "delivery_axis",
          entityId: move.id,
          diff: { from: move.from, to: move.to },
        });
      }
      return listAxes(transaction);
    });
  }

  /** An axis that an order points at is never removed: it is deactivated instead. */
  async delete(id: string, adminId: string): Promise<void> {
    const axisId = parseAxisId(id);
    await this.database.$transaction(async (transaction) => {
      await lockDeliveryAxes(transaction);
      if ((await findAxisContent(transaction, axisId)) === null) {
        throw new AdminDeliveryAxisNotFoundError();
      }
      if (await hasOrders(transaction, axisId)) {
        throw new DeliveryAxisInUseError();
      }
      await deleteAxis(transaction, axisId);
      await insertDeliveryAudit(transaction, {
        actorId: adminId,
        action: "delivery_axis.deleted",
        entity: "delivery_axis",
        entityId: axisId,
        diff: {},
      });
    });
  }
}
