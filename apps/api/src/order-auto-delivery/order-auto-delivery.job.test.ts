import type { CronJob } from "cron";
import { describe, expect, it } from "vitest";
import { OrderAutoDeliveryJob } from "./order-auto-delivery.job.js";

describe("OrderAutoDeliveryJob", () => {
  it("registers a cron at 04:00 every day in the time zone of the instance", async () => {
    const registered = new Map<string, CronJob>();
    const registry = { addCronJob: (name: string, job: CronJob) => registered.set(name, job) };
    const job = new OrderAutoDeliveryJob(
      registry,
      { deliverOverdueOrders: () => Promise.resolve(0) },
      // Not the default zone of the project: proves the zone is read from the instance.
      { timezone: "Europe/Paris" },
    );

    job.onModuleInit();

    const cron = registered.get("order-auto-delivery");
    expect({ source: cron?.cronTime.source, timeZone: cron?.cronTime.timeZone }).toEqual({
      source: "0 4 * * *",
      timeZone: "Europe/Paris",
    });
    await cron?.stop();
  });
});
