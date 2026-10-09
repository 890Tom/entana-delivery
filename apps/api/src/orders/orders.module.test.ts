import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { normalizePhone } from "@entana/contracts";
import { parseConfig } from "../config/app-config.js";
import { OrdersModule } from "./orders.module.js";
import { OrdersService, PHONE_COUNTRY_CODE } from "./orders.service.js";

describe("OrdersModule", () => {
  it("provides the service wired with the database, the clock and the config, without a database running", async () => {
    const config = parseConfig({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    });

    const moduleRef = await Test.createTestingModule({
      imports: [OrdersModule.register(config)],
    }).compile();

    expect(moduleRef.get(OrdersService)).toBeInstanceOf(OrdersService);
    await moduleRef.close();
  });

  it("normalises phone numbers with the country code of the instance configuration", async () => {
    const directory = mkdtempSync(join(tmpdir(), "entana-orders-"));
    const path = join(directory, "instance.config.yaml");
    writeFileSync(
      path,
      [
        "shop: { name: Chez Test }",
        "locale: { default: fr, available: [fr] }",
        "currency: MGA",
        "timezone: Indian/Antananarivo",
        'phoneCountryCode: "33"',
      ].join("\n"),
    );
    const config = parseConfig({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      INSTANCE_CONFIG_PATH: path,
    });

    const moduleRef = await Test.createTestingModule({
      imports: [OrdersModule.register(config)],
    }).compile();

    expect(normalizePhone("06 12 34 56 78", moduleRef.get<string>(PHONE_COUNTRY_CODE))).toBe(
      "+33612345678",
    );
    await moduleRef.close();
    rmSync(directory, { recursive: true, force: true });
  });
});
