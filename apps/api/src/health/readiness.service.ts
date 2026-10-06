import { Inject, Injectable } from "@nestjs/common";
import { InjectPinoLogger } from "nestjs-pino";
import type { ReadinessResponse } from "@entana/contracts";
import { DATABASE_CLIENT } from "../database/database-client.js";
import { ServiceNotReadyError } from "../errors/service-not-ready-error.js";
import { classifyReadinessFailure } from "./classify-readiness-failure.js";
import type { ReadinessFailureReason } from "./classify-readiness-failure.js";
import { ReadinessTimeoutError } from "./readiness-timeout-error.js";
import { READINESS_TIMEOUT_MS } from "./readiness-timeout.js";

/** What the check needs from the database client: the PrismaClient fits. */
export interface ReadinessDatabase {
  $queryRaw(query: TemplateStringsArray): Promise<unknown>;
}

export interface ReadinessLogger {
  warn(context: { reason: ReadinessFailureReason }, message: string): void;
}

const FAILURE_MESSAGE = "Readiness check failed.";

@Injectable()
export class ReadinessService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: ReadinessDatabase,
    @Inject(READINESS_TIMEOUT_MS) private readonly timeoutMs: number,
    @InjectPinoLogger(ReadinessService.name) private readonly logger: ReadinessLogger,
  ) {}

  /** Answers when the database answers a trivial query in time, otherwise raises ServiceNotReadyError. */
  async check(): Promise<ReadinessResponse> {
    try {
      await this.queryWithinTimeout();
    } catch (error) {
      // Only the reason is logged: the error itself can hold the host, the user or SQL.
      this.logger.warn({ reason: classifyReadinessFailure(error) }, FAILURE_MESSAGE);
      throw new ServiceNotReadyError();
    }
    return { status: "ready" };
  }

  private async queryWithinTimeout(): Promise<void> {
    // Raw SQL is justified: Prisma has no model-free "ping", and SELECT 1 touches no table.
    const query = this.database.$queryRaw`SELECT 1`;
    // If the timeout wins, the query is abandoned and may still fail later: this catch keeps that
    // late failure from becoming an unhandled rejection. When the query wins, Promise.race
    // still observes its result.
    query.catch(() => undefined);
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new ReadinessTimeoutError());
      }, this.timeoutMs);
    });
    try {
      await Promise.race([query, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
