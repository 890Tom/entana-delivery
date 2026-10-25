import { Inject, Injectable } from "@nestjs/common";
import type { InstanceConfig, PlaceSearchResponse } from "@entana/contracts";
import { INSTANCE_CONFIG } from "../instance/config-token/instance-config.token.js";
import { PhotonPlaceSearch } from "./provider/photon-place-search.js";
import { selectSuggestions } from "./rules/select-suggestions.js";

@Injectable()
export class PlacesService {
  constructor(
    @Inject(INSTANCE_CONFIG) private readonly instance: InstanceConfig,
    private readonly provider: PhotonPlaceSearch,
  ) {}

  /**
   * The suggestions for a typed text, searched near the map centre of the instance. A failure of
   * the provider propagates as `PlaceSearchUnavailableError`.
   */
  async search(text: string): Promise<PlaceSearchResponse> {
    const candidates = await this.provider.search(text, this.instance.map.center);
    return { suggestions: selectSuggestions(candidates) };
  }
}
