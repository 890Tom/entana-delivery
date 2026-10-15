import { useId } from "react";
import type { ReactElement } from "react";

import { Notice } from "../../../components/notice/notice";
import { texts } from "../../../i18n/texts";
import { formatAmount } from "../../../order-display/format-order";
import cardStyles from "../../../components/card/card.module.css";

import styles from "../settings-screen.module.css";

const t = texts.settings.preview;

/** What a customer outside every axis reads: the message being typed and the saved fee. */
export function ClientPreview({
  message,
  feeAr,
}: {
  message: string;
  feeAr: number;
}): ReactElement {
  const titleId = useId();
  return (
    <section className={styles.preview} aria-labelledby={titleId}>
      <h2 id={titleId} className={cardStyles.title}>
        {t.title}
      </h2>
      <div className={cardStyles.card}>
        <h3 className={styles.where}>{t.where}</h3>
        <Notice tone="info">{message.trim()}</Notice>
        <p className={styles.fee}>
          <span>{t.delivery}</span>
          <strong>{formatAmount(feeAr)}</strong>
        </p>
      </div>
    </section>
  );
}
