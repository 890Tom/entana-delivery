import { randomInt, randomUUID } from "node:crypto";
import { Controller, Get, Inject, Injectable, Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import type { PrismaClient } from "@entana/database";
import type { AppConfig } from "../../../src/config/app-config.js";
import { DATABASE_CLIENT } from "../../../src/database/database-client.js";
import { DatabaseModule } from "../../../src/database/database.module.js";

/** Every value a route inserts or uses, so that the test can look for it in what comes out. */
@Injectable()
export class UsedValues {
  private readonly values = new Set<string>();

  remember(value: string): string {
    this.values.add(value);
    return value;
  }

  all(): string[] {
    return [...this.values];
  }
}

function randomPhone(): string {
  return `+2613${String(randomInt(100_000_000)).padStart(8, "0")}`;
}

/** Records a value that an operation inserts or uses, and returns it. */
type Remember = (value: string) => string;

/**
 * One REAL operation per violation, run through a client on the throwaway database, so that
 * PostgreSQL itself raises the error. The routes below and the positive control of the suite run
 * the same functions.
 */
export const FAILING_OPERATIONS = {
  async unique(client: PrismaClient, remember: Remember): Promise<void> {
    const phoneE164 = remember(randomPhone());
    await client.customer.create({ data: { phoneE164 } });
    await client.customer.create({ data: { phoneE164 } });
  },
  async foreignKey(client: PrismaClient, remember: Remember): Promise<void> {
    await client.orderItem.create({
      data: {
        orderId: remember(randomUUID()),
        productId: remember(randomUUID()),
        productName: remember(`name-${randomUUID()}`),
        qty: 1,
        unitPrice: 1000,
      },
    });
  },
  async check(client: PrismaClient, remember: Remember): Promise<void> {
    await client.customer.create({ data: { phoneE164: remember(`invalid-${randomUUID()}`) } });
  },
  async notNull(client: PrismaClient, remember: Remember): Promise<void> {
    const id = remember(randomUUID());
    // Raw SQL, because the client refuses to omit a required field.
    await client.$executeRaw`INSERT INTO customer (id) VALUES (${id}::uuid)`;
  },
  async notFound(client: PrismaClient, remember: Remember): Promise<void> {
    await client.customer.update({
      where: { id: remember(randomUUID()) },
      data: { phoneE164: remember(randomPhone()) },
    });
  },
} as const;

/** The paths of the routes of this suite: they avoid the names of tables and columns. */
export const PROBE_PATHS = {
  unique: "/api/v1/probe/unique",
  foreignKey: "/api/v1/probe/foreign-key",
  check: "/api/v1/probe/check",
  notNull: "/api/v1/probe/not-null",
  notFound: "/api/v1/probe/not-found",
  baseline: "/api/v1/probe/baseline",
} as const;

/**
 * Routes that exist only in this suite. Their paths avoid the names of tables and columns: the
 * access log holds the route. They must never be imported by the application.
 */
@Controller({ path: "probe", version: "1" })
class FailureCasesController {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly client: PrismaClient,
    private readonly used: UsedValues,
  ) {}

  private readonly remember: Remember = (value) => this.used.remember(value);

  @Get("unique")
  violateUnique(): Promise<void> {
    return FAILING_OPERATIONS.unique(this.client, this.remember);
  }

  @Get("foreign-key")
  violateForeignKey(): Promise<void> {
    return FAILING_OPERATIONS.foreignKey(this.client, this.remember);
  }

  @Get("check")
  violateCheck(): Promise<void> {
    return FAILING_OPERATIONS.check(this.client, this.remember);
  }

  @Get("not-null")
  violateNotNull(): Promise<void> {
    return FAILING_OPERATIONS.notNull(this.client, this.remember);
  }

  @Get("not-found")
  updateMissing(): Promise<void> {
    return FAILING_OPERATIONS.notFound(this.client, this.remember);
  }

  // The control of the suite: an unknown error that is not a database error. It goes through the
  // same exception filter, so its 5xx answer, helmet headers and access log are the real ones.
  @Get("baseline")
  failWithoutDatabase(): never {
    throw new Error("an unexpected failure that has nothing to do with the database");
  }
}

@Module({})
export class FailureCasesModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: FailureCasesModule,
      imports: [DatabaseModule.register(config)],
      controllers: [FailureCasesController],
      providers: [UsedValues],
    };
  }
}
