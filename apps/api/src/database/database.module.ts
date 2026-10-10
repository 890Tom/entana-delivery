import { Inject, Injectable, Module } from "@nestjs/common";
import type { DynamicModule, OnModuleDestroy } from "@nestjs/common";
import { createPrismaClient } from "@entana/database";
import type { PrismaClient } from "@entana/database";
import type { AppConfig } from "../config/app-config.js";
import { DATABASE_CLIENT } from "./client-token/database-client.js";

// Nest only calls shutdown hooks on providers that have them: a client built by a factory has
// none. Closing the pool lets the process exit and PostgreSQL release its connections.
@Injectable()
class DatabaseShutdown implements OnModuleDestroy {
  constructor(@Inject(DATABASE_CLIENT) private readonly client: PrismaClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}

// Nest tells two dynamic modules apart by the object that describes them, not by what it contains:
// each call of `register` would be a module of its own, with its own client and its own pool. One
// object per configuration makes every module that imports the database share the one client.
// The key is the identity of the configuration object: a copy of it (`{ ...config }`) is another
// key, hence another client. database.module.test.ts and tests/e2e/products.e2e.test.ts fail then.
const registrations = new WeakMap<AppConfig, DynamicModule>();

/**
 * Provides the PrismaClient under DATABASE_CLIENT. Not global: a module that needs the database
 * imports this one, so that the dependency is visible. The client connects on its first query, so
 * starting the application needs no running database. An invalid URL fails here, at startup, with
 * an error that never quotes the URL (it holds the password).
 */
@Module({})
export class DatabaseModule {
  static register(config: AppConfig): DynamicModule {
    const known = registrations.get(config);
    if (known !== undefined) {
      return known;
    }
    const registration: DynamicModule = {
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
    registrations.set(config, registration);
    return registration;
  }
}
