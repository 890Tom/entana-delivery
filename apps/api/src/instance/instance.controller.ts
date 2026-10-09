import { Controller, Get, Header } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { publicInstanceSchema } from "@entana/contracts";
import type { PublicInstance } from "@entana/contracts";
import { InstanceService } from "./instance.service.js";

// The configuration only changes with a restart: a minute of cache is harmless and spares the API
// one request per page view.
const INSTANCE_CACHE_CONTROL = "public, max-age=60";

@ApiTags("instance")
@Controller({ path: "instance", version: "1" })
export class InstanceController {
  constructor(private readonly instanceService: InstanceService) {}

  @Get()
  @Header("Cache-Control", INSTANCE_CACHE_CONTROL)
  @ApiOperation({
    summary: "Describe the shop",
    description:
      "Public. The shop name, languages, currency, phone country code and branding media URLs. Nothing internal.",
    operationId: "getInstance",
  })
  @ApiOkResponse({
    description: "The public part of the instance configuration.",
    standardSchema: publicInstanceSchema,
  })
  get(): PublicInstance {
    return this.instanceService.getPublicInstance();
  }
}
