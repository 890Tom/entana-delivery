import type { PublicProduct } from "@entana/contracts";
import { formatAmount } from "@entana/contracts";
import { useState } from "react";
import type { ReactElement } from "react";

import { Button } from "../../../components/button/button";
import { texts } from "../../../i18n/texts";
import layout from "../card-layout.module.css";

import { ProductCardAction } from "./product-card-action";
import styles from "./product-card.module.css";

function ignoreClick(): void {
  // A disabled button never calls it: `Button` requires a handler.
}

/** An unavailable product keeps the place of the cart control, as a disabled button. */
function CardControl({ product }: { product: PublicProduct }): ReactElement {
  if (product.available) {
    return <ProductCardAction productId={product.id} name={product.name} />;
  }
  return (
    <Button isDisabled onClick={ignoreClick}>
      {texts.catalogue.product.unavailable}
    </Button>
  );
}

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
      </div>
      <div className={layout.text}>
        <h2 className={styles.name}>{product.name}</h2>
        <p className={styles.price}>{formatAmount(product.priceAr)}</p>
      </div>
      <div className={layout.action}>
        <CardControl product={product} />
      </div>
    </article>
  );
}
