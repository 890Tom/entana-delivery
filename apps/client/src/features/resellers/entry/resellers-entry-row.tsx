import type { ReactElement } from "react";
import { Link } from "wouter";

import { Icon } from "../../../components/icon/icon";
import { texts } from "../../../i18n/texts";
import { RESELLERS_PATH } from "../../../routes";

import styles from "./resellers-entry-row.module.css";

/** The way to the resellers from the catalogue on a phone: a row with a pin and a chevron. */
export function ResellersEntryRow(): ReactElement {
  return (
    <Link href={RESELLERS_PATH} className={styles.row}>
      <Icon name="map-pin" />
      <span className={styles.label}>{texts.resellers.title}</span>
      <Icon name="chevron-right" />
    </Link>
  );
}
