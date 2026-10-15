import type { DeliveryZone } from "@entana/contracts";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { MapZone } from "../map/map-adapter";

import { fetchDeliveryZones } from "./fetch-delivery-zones";

// One empty list for every render without zones, so that the map is not drawn again for nothing.
const NO_ZONES: readonly DeliveryZone[] = [];

function toMapZones(zones: readonly DeliveryZone[]): readonly MapZone[] {
  return zones.map((zone) => ({
    center: { lat: zone.latitude, lng: zone.longitude },
    radiusM: zone.radiusM,
  }));
}

/**
 * The circles drawn on the delivery map. They are a help, not a condition: while they load, or
 * when they fail, there are none and the screen works the same, without a message.
 */
export function useDeliveryZones(): readonly MapZone[] {
  const query = useQuery({
    queryKey: ["delivery-zones"],
    queryFn: ({ signal }) => fetchDeliveryZones(signal),
  });
  const zones = query.data?.zones ?? NO_ZONES;
  return useMemo(() => toMapZones(zones), [zones]);
}
