import { Controller, Get, Header, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { placeSearchQuerySchema } from "@entana/contracts";
import type { PlaceSearchQuery, PlaceSearchResponse } from "@entana/contracts";
import { documentSearchPlaces } from "./http/places-openapi.js";
import { PlacesService } from "./places.service.js";

// No cache anywhere: each search is answered by the provider.
const NO_STORE = "no-store";

@ApiTags("places")
@Controller({ path: "places", version: "1" })
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get("search")
  @Header("Cache-Control", NO_STORE)
  @documentSearchPlaces()
  search(
    @Query({ schema: placeSearchQuerySchema }) query: PlaceSearchQuery,
  ): Promise<PlaceSearchResponse> {
    return this.placesService.search(query.q);
  }
}
