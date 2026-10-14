import { Inject, Injectable } from "@nestjs/common";
import { planDeliverySettingsUpdate } from "@entana/contracts";
import type {
  AdminDeliveryAxisListResponse,
  AdminDeliveryPlaceListResponse,
  DeliveryResolveQuery,
  DeliveryResolveResponse,
  DeliverySettings,
  UpdateDeliverySettingsRequest,
} from "@entana/contracts";
import type { PrismaClient } from "@entana/database";
import { DATABASE_CLIENT } from "../database/client-token/database-client.js";
import {
  findSettings,
  insertSettingsAudit,
  listActivePlaces,
  listAxesWithPlaces,
  updateSettings,
} from "./persistence/admin-delivery-queries.js";
import { toAdminDeliveryAxes, toAdminDeliveryPlaces } from "./rules/to-admin-delivery.js";
import { resolveAddress } from "./rules/to-delivery-resolution.js";

/** What the service needs from the database client: the PrismaClient fits. */
export type AdminDeliveryClient = Pick<
  PrismaClient,
  "$transaction" | "deliveryAxis" | "place" | "shopSetting" | "auditLog"
>;

/** The administration of the delivery, read only for the axes and the places. */
@Injectable()
export class AdminDeliveryService {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: AdminDeliveryClient) {}

  async listAxes(): Promise<AdminDeliveryAxisListResponse> {
    return toAdminDeliveryAxes(await listAxesWithPlaces(this.database));
  }

  async listPlaces(): Promise<AdminDeliveryPlaceListResponse> {
    return toAdminDeliveryPlaces(await listActivePlaces(this.database));
  }

  getSettings(): Promise<DeliverySettings> {
    return findSettings(this.database);
  }

  async updateSettings(
    request: UpdateDeliverySettingsRequest,
    adminId: string,
  ): Promise<DeliverySettings> {
    return this.database.$transaction(async (transaction) => {
      const before = await findSettings(transaction);
      const plan = planDeliverySettingsUpdate(before, request);
      if (plan.kind === "unchanged") {
        return before;
      }
      const after = await updateSettings(transaction, plan.columns);
      await insertSettingsAudit(transaction, {
        actorId: adminId,
        diff: { fields: plan.fields, ...plan.numbers },
      });
      return after;
    });
  }

  async resolve(query: DeliveryResolveQuery): Promise<DeliveryResolveResponse> {
    const [axes, settings] = await Promise.all([
      listAxesWithPlaces(this.database),
      findSettings(this.database),
    ]);
    const point = { lat: query.latitude, lng: query.longitude };
    return resolveAddress(point, query.pieces, axes, settings);
  }
}
