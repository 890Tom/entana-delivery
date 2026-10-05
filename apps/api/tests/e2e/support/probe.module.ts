import { Body, Controller, Get, Module, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";

const probeBodySchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
});

/**
 * Routes that exist only in tests, to exercise what the real application has no route for yet:
 * validation, an unexpected error, a path parameter and the client address.
 * They must never be imported by the application.
 */
@Controller({ path: "probe", version: "1" })
class ProbeController {
  @Post("validation")
  validate(@Body({ schema: probeBodySchema }) body: z.infer<typeof probeBodySchema>): unknown {
    return body;
  }

  @Get("boom")
  explode(): never {
    throw new Error("secret internal detail: db.internal:5432");
  }

  @Get("items/:token")
  readItem(@Param("token") token: string): unknown {
    return { received: token.length };
  }

  @Get("client")
  readClient(@Req() request: Request): unknown {
    return { ip: request.ip };
  }
}

@Module({ controllers: [ProbeController] })
export class ProbeModule {}
