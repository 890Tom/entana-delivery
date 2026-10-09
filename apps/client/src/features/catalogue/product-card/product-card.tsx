import type { PublicProduct } from "@entana/contracts";
import { formatAmount } from "@entana/contracts";
import type { ReactElement } from "react";

import { Badge } from "../../../components/badge/badge";
import { texts } from "../../../i18n/texts";
import layout from "../card-layout.module.css";

import styles from "./product-card.module.css";

/** The description is not shown: the validated design has none on the card. */
export function ProductCard({ product }: { product: PublicProduct }): ReactElement {
  return (
    <article className={layout.card}>
      {/* Photo storage is undecided: the alt text stands in, no URL is built from image.key. */}
      <div className={[layout.photo, styles.photo].join(" ")}>
        <div
          className={[styles.placeholder, product.available ? undefined : styles.dimmed].join(" ")}
        >
          <p className={styles.alt}>{product.image.alt}</p>
        </div>
        {!product.available && (
          <div className={styles.badge}>
            <Badge>{texts.catalogue.product.unavailable}</Badge>
          </div>
        )}
      </div>
      <div>
        <h2 className={styles.name}>{product.name}</h2>
        <p className={styles.price}>{formatAmount(product.priceAr)}</p>
      </div>
      <div className={layout.action} />
    </article>
  );
}
