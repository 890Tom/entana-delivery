import { useState } from "react";
import type { ReactElement } from "react";

import styles from "./cart-line.module.css";

/**
 * The photo of a cart line. The name is beside it, so the image is decoration (empty alt). The
 * square keeps its size when there is no photo or it fails to load. The URL is the API's own.
 */
export function CartThumbnail({ url }: { url: string | null }): ReactElement {
  const [hasFailed, setHasFailed] = useState(false);
  return (
    <div className={styles.thumbnail}>
      {url !== null && !hasFailed && (
        <img
          className={styles.thumbnailImage}
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => {
            setHasFailed(true);
          }}
        />
      )}
    </div>
  );
}
