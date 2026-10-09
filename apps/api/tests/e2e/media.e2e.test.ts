import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { problemDetailsSchema } from "@entana/contracts";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealApp } from "./support/create-test-app.js";
import { buildTestConfig } from "./support/test-config.js";

const LOGO = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const PHOTO = Buffer.from("not really a webp");

describe("GET /media/<folder>/<file>", () => {
  let directory: string;
  let app: NestExpressApplication;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), "entana-media-"));
    const root = join(directory, "media");
    mkdirSync(join(root, "branding"), { recursive: true });
    mkdirSync(join(root, "products"));
    writeFileSync(join(root, "branding", "logo.png"), LOGO);
    writeFileSync(join(root, "products", "photo.webp"), PHOTO);
    writeFileSync(join(directory, "outside.png"), "secret");
    symlinkSync(join(directory, "outside.png"), join(root, "branding", "leak.png"));
    writeFileSync(join(root, "branding", "icon.svg"), "<svg/>");
    app = await startRealApp(buildTestConfig({ MEDIA_ROOT: root }));
  });
  afterAll(async () => {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it.each([
    ["/media/branding/logo.png", "image/png", LOGO],
    ["/media/products/photo.webp", "image/webp", PHOTO],
  ])("serves %s as it is, with the headers that stop interpretation", async (path, type, file) => {
    const response = await request(app.getHttpServer()).get(path).responseType("blob");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe(type);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["content-security-policy"]).toBe("default-src 'none'");
    expect(response.headers["cache-control"]).toBe("public, max-age=3600");
    expect(response.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(response.body).toEqual(file);
  });

  it("answers HEAD with the headers of GET and no body", async () => {
    const response = await request(app.getHttpServer()).head("/media/branding/logo.png");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("image/png");
    expect(response.headers["content-length"]).toBe(String(LOGO.length));
    expect(response.headers["cache-control"]).toBe("public, max-age=3600");
    expect(response.text).toBeUndefined();
  });

  it("answers 404 with the usual problem body for a missing file", async () => {
    const response = await request(app.getHttpServer()).get("/media/products/absent.png");

    expect(response.status).toBe(404);
    expect(problemDetailsSchema.parse(response.body).status).toBe(404);
    expect(JSON.stringify(response.body)).not.toContain(tmpdir());
  });

  it("answers 404 for a name that tries to leave the folder", async () => {
    const response = await request(app.getHttpServer()).get("/media/branding/%2e%2e%2foutside.png");

    expect(response.status).toBe(404);
  });

  it("answers 404 for an svg, even one that exists", async () => {
    const response = await request(app.getHttpServer()).get("/media/branding/icon.svg");

    expect(response.status).toBe(404);
  });

  it("does not serve a symbolic link to a file outside the folder", async () => {
    const response = await request(app.getHttpServer()).get("/media/branding/leak.png");

    expect(response.status).toBe(404);
  });
});
