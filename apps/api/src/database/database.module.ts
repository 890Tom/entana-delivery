import { Inject, Injectable, Module } from "@nestjs/common";
import type { DynamicModule, OnModuleDestroy } from "@nestjs/common";
import { createPrismaClient } from "@entana/database";
import type { PrismaClient } from "@entana/database";
import type { AppConfig } from "../config/app-config.js";
import { DATABASE_CLIENT } from "./database-client.js";

// Nest only calls shutdown hooks on providers that have them: a client built by a factory has
// none. Closing the pool lets the process exit and PostgreSQL release its connections.
@Injectable()
class DatabaseShutdown implements OnModuleDestroy {
  constructor(@Inject(DATABASE_CLIENT) private readonly client: PrismaClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}

/**
 * Provides the PrismaClient under DATABASE_CLIENT. Not global: a module that needs the database
 * imports this one, so that the dependency is visible. The client connects on its first query, so
 * starting the application needs no running database. An invalid URL fails here, at startup, with
 * an error that never quotes the URL (it holds the password).
 */
@Module({})
export class DatabaseModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: DATABASE_CLIENT,
          useFactory: (): PrismaClient =>
            createPrismaClient({ connectionString: config.databaseUrl }),
        },
        DatabaseShutdown,
      ],
      exports: [DATABASE_CLIENT],
    };
  }
}
