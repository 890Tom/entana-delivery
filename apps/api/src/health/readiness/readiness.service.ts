import { Inject, Injectable } from "@nestjs/common";
import { InjectPinoLogger } from "nestjs-pino";
import type { ReadinessResponse } from "@entana/contracts";
import { DATABASE_CLIENT } from "../../database/database-client.js";
import { ServiceNotReadyError } from "./failure/service-not-ready-error.js";
import { classifyReadinessFailure } from "./failure/classify-readiness-failure.js";
import type { ReadinessFailureReason } from "./failure/classify-readiness-failure.js";
import { ReadinessTimeoutError } from "./timeout/readiness-timeout-error.js";
import { READINESS_TIMEOUT_MS } from "./timeout/readiness-timeout.js";

/** What the check needs from the database client: the PrismaClient fits. */
export interface ReadinessDatabase {
  $queryRaw(query: TemplateStringsArray): Promise<unknown>;
}

export interface ReadinessLogger {
  warn(context: { reason: ReadinessFailureReason }, message: string): void;
}

const FAILURE_MESSAGE = "Readiness check failed.";

// The query in flight, shared by every call that arrives while it is pending.
interface PendingCheck {
  readonly promise: Promise<void>;
  hasLoggedTimeout: boolean;
}

@Injectable()
export class ReadinessService {
  // At most one query at a time: a query abandoned by a caller's timeout still holds a pool
  // connection until it settles, so a burst of checks against a silent database would exhaust the
  // pool. The field is cleared when the QUERY settles, never when a caller gives up.
  private pending: PendingCheck | undefined;

  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: ReadinessDatabase,
    @Inject(READINESS_TIMEOUT_MS) private readonly timeoutMs: number,
    @InjectPinoLogger(ReadinessService.name) private readonly logger: ReadinessLogger,
  ) {}

  /** Answers when the database answers a trivial query in time, otherwise raises ServiceNotReadyError. */
  async check(): Promise<ReadinessResponse> {
    const pending = this.pending ?? this.startQuery();
    try {
      await this.waitWithinTimeout(pending.promise);
    } catch (error) {
      this.logTimeoutOnce(pending, error);
      throw new ServiceNotReadyError();
    }
    return { status: "ready" };
  }

  private startQuery(): PendingCheck {
    // Raw SQL is justified: Prisma has no model-free "ping", and SELECT 1 touches no table.
    // An async function, so that a client that throws at once becomes a rejected promise like any
    // other failure.
    const promise = (async (): Promise<void> => {
      await this.database.$queryRaw`SELECT 1`;
    })();
    const pending: PendingCheck = { promise, hasLoggedTimeout: false };
    this.pending = pending;
    // The state is cleared whatever the outcome, and a failure is logged once however many calls
    // joined the query. Both handlers are attached at once, so the query itself can never go unhandled.
    // A call that lands just after the query settled, before this runs, joins the settled promise.
    const clear = (): void => {
      if (this.pending === pending) {
        this.pending = undefined;
      }
    };
    promise.then(clear, (error: unknown) => {
      clear();
      // Only the reason is logged: the error itself can hold the host, the user or SQL.
      this.logger.warn({ reason: classifyReadinessFailure(error) }, FAILURE_MESSAGE);
    });
    return pending;
  }

  // The call's own timer, always cleared. Giving up here leaves the query pending on purpose.
  private async waitWithinTimeout(query: Promise<void>): Promise<void> {
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

  // A failed query logs itself (see startQuery). A timeout is not a failure of the query, so it is
  // logged here, once per pending query: a burst against a silent database is not a log flood.
  private logTimeoutOnce(pending: PendingCheck, error: unknown): void {
    if (error instanceof ReadinessTimeoutError && !pending.hasLoggedTimeout) {
      pending.hasLoggedTimeout = true;
      this.logger.warn({ reason: "timeout" }, FAILURE_MESSAGE);
    }
  }
}
