import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import { formatAmount } from "../../../order-display/format-order";

import { CatalogueIcon } from "../../../components/catalogue-icons/catalogue-icons";
import cardStyles from "../../../components/card/card.module.css";
import styles from "./preview-card.module.css";

const t = texts.catalogueForm.preview;

interface PreviewCardProps {
  readonly name: string;
  readonly priceAr: number;
  readonly imageUrl: string | null;
  readonly isVisible: boolean;
  readonly isAvailable: boolean;
}

function noteOf({ isVisible, isAvailable }: PreviewCardProps): string {
  if (!isVisible) {
    return t.hidden;
  }
  return isAvailable ? t.visible : t.unavailable;
}

/**
 * What the customer would see, live: the thumbnail, the name, the price and an "Ajouter" button
 * that only shows (disabled, hidden from assistive technology).
 */
export function PreviewCard(props: PreviewCardProps): ReactElement {
  const { name, priceAr, imageUrl } = props;
  const isComplete = name.trim() !== "" && priceAr > 0 && imageUrl !== null;
  return (
    <section className={[cardStyles.card, styles.card].join(" ")}>
      <h2 className={cardStyles.title}>{t.title}</h2>
      {isComplete ? (
        <div className={styles.product}>
          <div className={styles.top}>
            <div className={styles.thumb}>
              <img src={imageUrl} alt="" className={styles.photo} />
            </div>
            <p className={styles.note}>{noteOf(props)}</p>
          </div>
          <p className={styles.name}>{name.trim()}</p>
          <p className={styles.price}>{formatAmount(priceAr)}</p>
          <button type="button" className={styles.add} disabled aria-hidden="true" tabIndex={-1}>
            <CatalogueIcon name="plus" size={20} />
            {t.add}
          </button>
        </div>
      ) : (
        <p className={cardStyles.muted}>{t.incomplete}</p>
      )}
    </section>
  );
}
