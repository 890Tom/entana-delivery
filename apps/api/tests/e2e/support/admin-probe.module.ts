import { Controller, Get, Module, Post } from "@nestjs/common";

/**
 * A route under /api/v1/admin that exists only in tests and carries no decorator at all: it
 * proves that the area is closed by default, not by what each route says about itself.
 */
@Controller({ path: "admin/probe", version: "1" })
class AdminProbeController {
  @Get()
  read(): unknown {
    return { reached: "admin-probe-was-reached" };
  }

  @Post()
  change(): unknown {
    return { reached: "admin-probe-was-reached" };
  }
}

@Module({ controllers: [AdminProbeController] })
export class AdminProbeModule {}
