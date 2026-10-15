import { Inject, Injectable } from "@nestjs/common";
import { planResellerUpdate } from "@entana/contracts";
import type {
  AdminReseller,
  AdminResellerListResponse,
  CreateResellerRequest,
  ResellerUpdatePlan,
  UpdateResellerRequest,
} from "@entana/contracts";
import type { PrismaClient } from "@entana/database";
import { CLOCK } from "../clock/clock.js";
import type { Clock } from "../clock/clock.js";
import { DATABASE_CLIENT } from "../database/client-token/database-client.js";
import {
  AdminResellerNotFoundError,
  ResellerNotPublishableError,
} from "./errors/admin-reseller-errors.js";
import {
  deleteReseller,
  insertReseller,
  insertResellerAudit,
  listResellers,
  updateReseller,
} from "./persistence/admin-reseller-queries.js";
import type { ResellerAudit } from "./persistence/admin-reseller-queries.js";
import { parseResellerId, requireReseller } from "./lookup/reseller-lookup.js";
import { toAdminReseller, toResellerState } from "./rules/to-admin-reseller.js";
import { toResellerWrite } from "./rules/to-reseller-write.js";

/** What the service needs from the database client: the PrismaClient fits. */
export type AdminResellersClient = Pick<PrismaClient, "$transaction" | "reseller" | "auditLog">;

type ChangedPlan = Extract<ResellerUpdatePlan, { kind: "changed" }>;
type Entry = Pick<ResellerAudit, "action" | "diff">;

// One entry per real change, in a fixed order: the fields, the consent, the visibility.
function auditEntries(plan: ChangedPlan): Entry[] {
  const entries: Entry[] = [];
  if (plan.fields.length > 0) {
    entries.push({ action: "reseller.updated", diff: { fields: plan.fields } });
  }
  if (plan.consent !== null) {
    entries.push({
      action: "reseller.consent_changed",
      diff: { consentGiven: { from: plan.consent.from, to: plan.consent.to } },
    });
  }
  if (plan.visibility !== null) {
    entries.push({
      action: plan.visibility.to ? "reseller.published" : "reseller.unpublished",
      diff: { visible: { from: plan.visibility.from, to: plan.visibility.to } },
    });
  }
  return entries;
}

@Injectable()
export class AdminResellersService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: AdminResellersClient,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(): Promise<AdminResellerListResponse> {
    const rows = await listResellers(this.database);
    return { resellers: rows.map(toAdminReseller) };
  }

  /** A reseller is verified at its creation: the shop has just seen it. */
  async create(request: CreateResellerRequest, adminId: string): Promise<AdminReseller> {
    // Checked here for a 422 of its own: the database CHECK would answer an unclassified error.
    if (request.visible && !request.consentGiven) {
      throw new ResellerNotPublishableError();
    }
    const now = this.clock.now();
    return this.database.$transaction(async (transaction) => {
      const created = await insertReseller(transaction, {
        name: request.name,
        area: request.neighborhood,
        landmarkText: request.landmark,
        lat: request.latitude,
        lng: request.longitude,
        active: request.visible,
        consentAt: request.consentGiven ? now : null,
        verifiedAt: now,
      });
      await insertResellerAudit(transaction, {
        actorId: adminId,
        action: "reseller.created",
        resellerId: created.id,
        diff: { visible: request.visible, consentGiven: request.consentGiven },
      });
      return toAdminReseller(created);
    });
  }

  async update(
    id: string,
    request: UpdateResellerRequest,
    adminId: string,
  ): Promise<AdminReseller> {
    const resellerId = parseResellerId(id);
    const now = this.clock.now();
    return this.database.$transaction(async (transaction) => {
      const before = await requireReseller(transaction, resellerId);
      const plan = planResellerUpdate(toResellerState(before), request);
      if (plan.kind === "not_publishable") {
        throw new ResellerNotPublishableError();
      }
      if (plan.kind === "unchanged") {
        return toAdminReseller(before);
      }
      const after = await updateReseller(transaction, resellerId, toResellerWrite(plan, now));
      for (const entry of auditEntries(plan)) {
        await insertResellerAudit(transaction, { ...entry, actorId: adminId, resellerId });
      }
      return toAdminReseller(after);
    });
  }

  /** The audit entry is written every time: a verification is an act, even without a change. */
  async verify(id: string, adminId: string): Promise<AdminReseller> {
    const resellerId = parseResellerId(id);
    const now = this.clock.now();
    return this.database.$transaction(async (transaction) => {
      await requireReseller(transaction, resellerId);
      const after = await updateReseller(transaction, resellerId, { verifiedAt: now });
      await insertResellerAudit(transaction, {
        actorId: adminId,
        action: "reseller.verified",
        resellerId,
        diff: {},
      });
      return toAdminReseller(after);
    });
  }

  /** Removed for good. The audit entry keeps the id only: no name, no position. */
  async delete(id: string, adminId: string): Promise<void> {
    const resellerId = parseResellerId(id);
    await this.database.$transaction(async (transaction) => {
      if (!(await deleteReseller(transaction, resellerId))) {
        throw new AdminResellerNotFoundError();
      }
      await insertResellerAudit(transaction, {
        actorId: adminId,
        action: "reseller.deleted",
        resellerId,
        diff: {},
      });
    });
  }
}
