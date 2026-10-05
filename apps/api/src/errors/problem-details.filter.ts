import { Catch, Logger } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { Request, Response } from "express";
import { sendProblem } from "./send-problem.js";
import type { ErrorLogger } from "./send-problem.js";

/** Answers every error raised by a route with application/problem+json. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(private readonly logger: ErrorLogger = new Logger(ProblemDetailsFilter.name)) {}

  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    sendProblem(http.getRequest<Request>(), http.getResponse<Response>(), error, this.logger);
  }
}
