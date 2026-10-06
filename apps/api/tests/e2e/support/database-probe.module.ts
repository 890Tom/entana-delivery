import { Controller, Get, Inject, Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import type { PrismaClient } from "@entana/database";
import type { AppConfig } from "../../../src/config/app-config.js";
import { DatabaseModule } from "../../../src/database/database.module.js";
import { DATABASE_CLIENT } from "../../../src/database/database-client.js";

/**
 * A route that exists only in tests: it runs a real query, so that a failure of the database
 * reaches the exception filter exactly as a failing service will. No endpoint of the real
 * application does that yet. It must never be imported by the application.
 */
@Controller({ path: "probe", version: "1" })
class DatabaseProbeController {
  constructor(@Inject(DATABASE_CLIENT) private readonly client: PrismaClient) {}

  @Get("database")
  async query(): Promise<unknown> {
    return this.client.$queryRaw`SELECT 1 AS one`;
  }
}

@Module({})
export class DatabaseProbeModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: DatabaseProbeModule,
      imports: [DatabaseModule.register(config)],
      controllers: [DatabaseProbeController],
    };
  }
}
