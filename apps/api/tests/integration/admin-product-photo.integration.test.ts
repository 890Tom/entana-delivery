import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { adminProductSchema } from "@entana/contracts";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { useAdminOrdersHarness } from "./support/admin-orders-harness.js";
import { gradientJpeg } from "./support/gradient-image.js";
import { insertProduct } from "./support/insert-product.js";

const PRODUCTS_PATH = "/api/v1/admin/products";
const PUBLIC_PRODUCTS_PATH = "/api/v1/products";
const VALID = { name: "Savon", priceAr: 4500, sku: "SAV-001" };

describe("the photo of a product on a real PostgreSQL", () => {
  const h = useAdminOrdersHarness();
  const photoPath = (id: string): string => `${PRODUCTS_PATH}/${id}/photo`;
  const productPath = (id: string): string => `${PRODUCTS_PATH}/${id}`;
  const auditRows = () => h.client.auditLog.findMany({ orderBy: { id: "asc" } });
  const stored = (id: string) => h.client.product.findUniqueOrThrow({ where: { id } });
  const productFiles = (): string[] => readdirSync(join(h.mediaRoot, "products"));
  const create = async (body: object = VALID): Promise<string> => {
    const answer = await h.post(PRODUCTS_PATH, body);
    return adminProductSchema.parse(answer.body).id;
  };

  describe("the photo", () => {
    it("writes one square WebP of 1000 px, updates the product and shows it publicly once visible", async () => {
      const id = await create({ ...VALID, imageAlt: "Un savon blanc", description: "Un savon" });

      const answer = await h.putPhoto(photoPath(id), await gradientJpeg(1300, 1300));

      const product = adminProductSchema.parse(answer.body);
      expect(answer.status).toBe(200);
      expect(answer.headers["cache-control"]).toBe("no-store");
      const files = productFiles();
      const [file = ""] = files;
      expect(files).toHaveLength(1);
      expect(file).toMatch(/^[0-9a-f-]{36}\.webp$/);
      expect(product).toMatchObject({
        image: { url: `/media/products/${file}` },
        imageAlt: "Un savon blanc",
      });
      const bytes = await sharp(join(h.mediaRoot, "products", file)).metadata();
      expect(bytes).toMatchObject({ format: "webp", width: 1000, height: 1000 });
      expect(bytes.exif).toBeUndefined();
      expect((await auditRows()).map((row) => row.action)).toEqual([
        "product.created",
        "product.photo_replaced",
      ]);

      await h.patch(productPath(id), { retired: false });
      const catalogue = await h.get(PUBLIC_PRODUCTS_PATH, null);
      expect(catalogue.body).toMatchObject({
        products: [
          {
            id,
            description: "Un savon",
            image: { url: `/media/products/${file}`, alt: "Un savon blanc" },
          },
        ],
      });
    });

    it("keeps the size of a 900 px source, within 150 KB", async () => {
      const id = await create({ ...VALID, imageAlt: "Un savon" });

      await h.putPhoto(photoPath(id), await gradientJpeg(900, 900));

      const file = productFiles()[0] ?? "";
      const metadata = await sharp(join(h.mediaRoot, "products", file)).metadata();
      expect(metadata).toMatchObject({ width: 900, height: 900 });
      expect(statSync(join(h.mediaRoot, "products", file)).size).toBeLessThanOrEqual(150_000);
    });

    it("deletes the old file after the replacement", async () => {
      const id = await create({ ...VALID, imageAlt: "Un savon" });
      await h.putPhoto(photoPath(id), await gradientJpeg(900, 900));
      const [first] = productFiles();

      const answer = await h.putPhoto(photoPath(id), await gradientJpeg(1000, 900));

      expect(answer.status).toBe(200);
      expect(productFiles()).toHaveLength(1);
      expect(productFiles()[0]).not.toBe(first);
      expect(existsSync(join(h.mediaRoot, "products", first ?? ""))).toBe(false);
    });

    it("keeps an old file that another product still references", async () => {
      writeFileSync(join(h.mediaRoot, "products", "shared.jpg"), "shared");
      const id = await insertProduct(h.client, { imageKey: "shared.jpg" });
      await insertProduct(h.client, { imageKey: "shared.jpg" });

      const answer = await h.putPhoto(photoPath(id), await gradientJpeg(900, 900));

      expect(answer.status).toBe(200);
      expect(existsSync(join(h.mediaRoot, "products", "shared.jpg"))).toBe(true);
    });

    it("answers 422 photo_alt_required when the product has no alternative text", async () => {
      const id = await create();

      const answer = await h.putPhoto(photoPath(id), await gradientJpeg(900, 900));

      expect(answer.status).toBe(422);
      expect(answer.body).toMatchObject({ type: "urn:entana:problem:photo_alt_required" });
      expect(productFiles()).toEqual([]);
    });

    it("answers 422 photo_too_small under 800 px and writes nothing", async () => {
      const id = await create({ ...VALID, imageAlt: "Un savon" });

      const answer = await h.putPhoto(photoPath(id), await gradientJpeg(1200, 799));

      expect(answer.status).toBe(422);
      expect(answer.body).toMatchObject({ type: "urn:entana:problem:photo_too_small" });
      expect(productFiles()).toEqual([]);
      expect((await stored(id)).imageKey).toBeNull();
    });

    it("answers 415 photo_invalid for a text file named .jpg", async () => {
      const id = await create({ ...VALID, imageAlt: "Un savon" });

      const answer = await h.putPhoto(photoPath(id), Buffer.from("just some text"));

      expect(answer.status).toBe(415);
      expect(answer.body).toMatchObject({ type: "urn:entana:problem:photo_invalid" });
    });

    it("answers 413 photo_too_large over 10 MB", async () => {
      const id = await create({ ...VALID, imageAlt: "Un savon" });

      const answer = await h.putPhoto(photoPath(id), Buffer.alloc(10 * 1024 * 1024 + 1024));

      expect(answer.status).toBe(413);
      expect(answer.body).toMatchObject({ type: "urn:entana:problem:photo_too_large" });
    });

    it("answers 400 when the field is not named photo", async () => {
      const id = await create({ ...VALID, imageAlt: "Un savon" });

      const answer = await h.putPhoto(photoPath(id), await gradientJpeg(900, 900), {
        field: "file",
      });

      expect(answer.status).toBe(400);
      expect(productFiles()).toEqual([]);
    });

    it("answers a fixed 400 for a multipart body that is malformed", async () => {
      const id = await create({ ...VALID, imageAlt: "Un savon" });
      const truncated =
        '--XBOUNDARY\r\nContent-Disposition: form-data; name="photo"; filename="a.jpg"\r\n\r\nabc';

      const answer = await h
        .put(photoPath(id), truncated)
        .set("Content-Type", "multipart/form-data; boundary=XBOUNDARY");

      expect(answer.status).toBe(400);
      expect(answer.body).toMatchObject({ detail: "The request is invalid." });
      expect(productFiles()).toEqual([]);
    });

    it("answers 415 for a body that is not multipart", async () => {
      const id = await create({ ...VALID, imageAlt: "Un savon" });

      const answer = await h.put(photoPath(id), { photo: "x" });

      expect(answer.status).toBe(415);
    });
  });
});
