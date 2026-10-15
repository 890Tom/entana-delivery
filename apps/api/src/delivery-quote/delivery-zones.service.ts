import { Inject, Injectable } from "@nestjs/common";
import type { DeliveryZoneListResponse } from "@entana/contracts";
import { DATABASE_CLIENT } from "../database/client-token/database-client.js";
import { toDeliveryZone } from "./mapping/to-delivery-zone.js";
import { listCoveredPlaces } from "./persistence/delivery-zone-queries.js";
import type { DeliveryZoneReader } from "./persistence/delivery-zone-queries.js";

@Injectable()
export class DeliveryZonesService {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: DeliveryZoneReader) {}

  /** The covered places, by name. Database errors propagate unchanged. */
  async listZones(): Promise<DeliveryZoneListResponse> {
    const rows = await listCoveredPlaces(this.database);
    return { zones: rows.map(toDeliveryZone) };
  }
}
