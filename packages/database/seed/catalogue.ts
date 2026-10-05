import type { SeedContext } from "./sql.ts";
import { daysBefore, insertRowAndReturnId } from "./sql.ts";

export interface SeededProduct {
  readonly id: string;
  readonly name: string;
  readonly priceAr: number;
}

interface DemoProduct {
  readonly key: string;
  readonly name: string;
  readonly priceAr: number;
  readonly active: boolean;
  readonly available: boolean;
}

// One product is out of stock (available = false) and one is hidden (active = false).
const DEMO_PRODUCTS: readonly DemoProduct[] = [
  { key: "alpha", name: "Demo Product Alpha", priceAr: 4500, active: true, available: true },
  { key: "beta", name: "Demo Product Beta", priceAr: 5000, active: true, available: true },
  { key: "gamma", name: "Demo Product Gamma", priceAr: 6500, active: true, available: true },
  { key: "delta", name: "Demo Product Delta", priceAr: 8000, active: true, available: false },
  { key: "epsilon", name: "Demo Product Epsilon", priceAr: 3500, active: true, available: true },
  { key: "zeta", name: "Demo Product Zeta", priceAr: 7000, active: false, available: true },
];

export async function seedCatalogue({ db, now }: SeedContext): Promise<Map<string, SeededProduct>> {
  const products = new Map<string, SeededProduct>();
  for (const [index, product] of DEMO_PRODUCTS.entries()) {
    const id = await insertRowAndReturnId(db, "product", {
      sku: `DEMO-SKU-${String(index + 1).padStart(3, "0")}`,
      name: product.name,
      description: `${product.name}: a fake product for the demo.`,
      price_ar: product.priceAr,
      active: product.active,
      available: product.available,
      availability_changed_at: product.available ? now : daysBefore(now, 3),
      position: index + 1,
      // An active product needs a photo and its alternative text (ck_product_photo_when_active).
      image_key: product.active ? `demo/placeholder-${product.key}.jpg` : null,
      image_alt: product.active ? `Placeholder picture of ${product.name}` : null,
    });
    products.set(product.key, { id, name: product.name, priceAr: product.priceAr });
  }
  return products;
}
