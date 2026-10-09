import type { PublicProduct } from "@entana/contracts";
import { formatAmount } from "@entana/contracts";
import { useState } from "react";
import type { ReactElement } from "react";

import { Badge } from "../../../components/badge/badge";
import { texts } from "../../../i18n/texts";
import layout from "../card-layout.module.css";

import { ProductCardAction } from "./product-card-action";
import styles from "./product-card.module.css";

/** The description is not shown: the validated design has none on the card. */
export function ProductCard({ product }: { product: PublicProduct }): ReactElement {
  const [hasPhotoFailed, setHasPhotoFailed] = useState(false);
  const { url, alt } = product.image;
  const dimmed = product.available ? undefined : styles.dimmed;
  return (
    <article className={layout.card}>
      {/* The square is sized by the layout, so a late or failed photo moves nothing. The URL is the API's own. */}
      <div className={[layout.photo, styles.photo].join(" ")}>
        {url !== null && !hasPhotoFailed ? (
          <img
            className={[styles.image, dimmed].join(" ")}
            src={url}
            alt={alt}
            loading="lazy"
            decoding="async"
            onError={() => {
              setHasPhotoFailed(true);
            }}
          />
        ) : (
          <div className={[styles.placeholder, dimmed].join(" ")}>
            <p className={styles.alt}>{alt}</p>
          </div>
        )}
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
      <div className={layout.action}>
        {product.available && <ProductCardAction productId={product.id} name={product.name} />}
      </div>
    </article>
  );
}
