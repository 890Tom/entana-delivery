import { Inject, Injectable } from "@nestjs/common";
import { toPublicInstance } from "@entana/contracts";
import type { InstanceConfig, PublicInstance } from "@entana/contracts";
import { INSTANCE_CONFIG } from "./config-token/instance-config.token.js";

@Injectable()
export class InstanceService {
  constructor(@Inject(INSTANCE_CONFIG) private readonly config: InstanceConfig) {}

  getPublicInstance(): PublicInstance {
    return toPublicInstance(this.config);
  }
}
