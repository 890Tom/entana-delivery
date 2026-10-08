import { Body, Controller, Get, Module, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";

const probeBodySchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
});

const strictProbeSchema = z.strictObject({
  name: z.string().min(2).max(5),
  count: z.number().int().min(1).max(3),
  kind: z.enum(["a", "b"]),
  choice: z.union([z.string().length(1), z.number()]),
  code: z.string().refine((value) => value === "ok", { message: "custom text with secret-refine" }),
  tags: z.array(z.strictObject({ label: z.string().min(1) })).max(2),
  labels: z.record(z.string(), z.number()),
  email: z.email().optional(),
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

  @Post("strict")
  validateStrictly(
    @Body({ schema: strictProbeSchema }) body: z.infer<typeof strictProbeSchema>,
  ): unknown {
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
