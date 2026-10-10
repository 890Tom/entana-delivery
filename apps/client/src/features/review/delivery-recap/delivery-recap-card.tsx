import { useId } from "react";
import type { ReactElement, ReactNode } from "react";
import { Link } from "wouter";

import { Icon } from "../../../components/icon/icon";
import type { IconName } from "../../../components/icon/icon";
import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";
import { CONTACT_PATH, DELIVERY_PATH } from "../../../routes";

import styles from "./delivery-recap-card.module.css";

interface RecapRowProps {
  readonly icon: IconName;
  /** Shown on the web layout only ("Adresse", "Coordonnées"). */
  readonly label?: string;
  readonly edit?: { readonly href: string; readonly name: string };
  readonly children: ReactNode;
}

function RecapRow({ icon, label, edit, children }: RecapRowProps): ReactElement {
  return (
    <div className={styles.row}>
      <span className={styles.icon}>
        <Icon name={icon} />
      </span>
      <div className={styles.text}>
        {label !== undefined && <span className={styles.label}>{label}</span>}
        {children}
      </div>
      {edit !== undefined && (
        <Link href={edit.href} className={styles.edit} aria-label={edit.name}>
          {texts.review.delivery.edit}
        </Link>
      )}
    </div>
  );
}

/** The contact line while the instance, which holds the country code, loads: one text line. */
function ContactLineSkeleton(): ReactElement {
  return (
    <span aria-busy="true">
      <span className={visuallyHidden.visuallyHidden}>{texts.common.loading}</span>
      <span aria-hidden="true" className={styles.skeleton} />
    </span>
  );
}

interface DeliveryRecapCardProps {
  readonly landmark: string;
  readonly name: string;
  /** The number as shown, with its country code; null while it cannot be made yet. */
  readonly phone: string | null;
  readonly note: string;
}

/**
 * Where, to whom and when the order goes, with a way back to each step. Every text is the
 * customer's own and is rendered as text.
 */
export function DeliveryRecapCard({
  landmark,
  name,
  phone,
  note,
}: DeliveryRecapCardProps): ReactElement {
  const titleId = useId();
  const { delivery } = texts.review;
  return (
    <section aria-labelledby={titleId} className={styles.card}>
      {/* The card has no visible title on the web layout: `display: none` there, still its name. */}
      <h2 id={titleId} className={styles.title}>
        {delivery.title}
      </h2>
      <RecapRow
        icon="map-pin"
        label={delivery.address}
        edit={{ href: DELIVERY_PATH, name: delivery.editAddress }}
      >
        <span>{landmark}</span>
      </RecapRow>
      <RecapRow
        icon="phone"
        label={delivery.contact}
        edit={{ href: CONTACT_PATH, name: delivery.editContact }}
      >
        {phone === null ? (
          <ContactLineSkeleton />
        ) : (
          <span>{delivery.contactLine(name, phone)}</span>
        )}
        {note !== "" && <span className={styles.note}>{delivery.note(note)}</span>}
      </RecapRow>
      <RecapRow icon="calendar">
        <span>{delivery.date}</span>
      </RecapRow>
    </section>
  );
}
