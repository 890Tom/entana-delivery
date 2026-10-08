import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { parseConfig } from "../config/app-config.js";
import { OrdersModule } from "./orders.module.js";
import { OrdersService } from "./orders.service.js";

describe("OrdersModule", () => {
  it("provides the service wired with the database, the clock and the config, without a database running", async () => {
    const config = parseConfig({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      DEFAULT_PHONE_COUNTRY_CODE: "33",
    });

    const moduleRef = await Test.createTestingModule({
      imports: [OrdersModule.register(config)],
    }).compile();

    expect(moduleRef.get(OrdersService)).toBeInstanceOf(OrdersService);
    await moduleRef.close();
  });
});
