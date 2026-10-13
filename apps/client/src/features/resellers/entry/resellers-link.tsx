import type { ReactElement } from "react";
import { Link, useRoute } from "wouter";

import { Icon } from "../../../components/icon/icon";
import { texts } from "../../../i18n/texts";
import { RESELLERS_PATH } from "../../../routes";

import styles from "./resellers-link.module.css";

/** The link of the header (web layout): a pin and the name of the screen. */
export function ResellersLink(): ReactElement {
  const [isCurrent] = useRoute(RESELLERS_PATH);
  return (
    <Link
      href={RESELLERS_PATH}
      className={styles.link}
      aria-current={isCurrent ? "page" : undefined}
    >
      <Icon name="map-pin" />
      {texts.resellers.title}
    </Link>
  );
}
