import { Inject, Injectable } from "@nestjs/common";
import type { ResellerListResponse } from "@entana/contracts";
import type { PrismaClient } from "@entana/database";
import { DATABASE_CLIENT } from "../database/client-token/database-client.js";
import { toPublicReseller } from "./mapping/to-public-reseller.js";

/** What the service needs from the database client: the PrismaClient fits. */
export interface ResellersDatabase {
  reseller: Pick<PrismaClient["reseller"], "findMany">;
}

@Injectable()
export class ResellersService {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: ResellersDatabase) {}

  /** The visible resellers, by neighborhood then name. Database errors propagate unchanged. */
  async listVisibleResellers(): Promise<ResellerListResponse> {
    const rows = await this.database.reseller.findMany({
      // The database already guarantees that a visible reseller gave its consent (CHECK).
      where: { active: true },
      // An explicit allow-list: consentAt, active and verifiedAt are never read.
      select: { id: true, name: true, area: true, landmarkText: true, lat: true, lng: true },
      // The id makes the order total: two resellers with the same area and name never swap.
      orderBy: [{ area: "asc" }, { name: "asc" }, { id: "asc" }],
    });
    return { resellers: rows.map(toPublicReseller) };
  }
}
