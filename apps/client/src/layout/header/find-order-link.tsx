import type { ReactElement } from "react";
import { Link } from "wouter";

import { Icon } from "../../components/icon/icon";
import { texts } from "../../i18n/texts";
import { FIND_ORDER_PATH } from "../../routes";

import badge from "./cart-badge.module.css";

/**
 * The way to find an order again with the phone number and the code, beside the cart. An icon
 * alone, so that its name is its label (and its tooltip).
 */
export function FindOrderLink(): ReactElement {
  return (
    <Link
      href={FIND_ORDER_PATH}
      className={badge.badge}
      aria-label={texts.findOrder.entry}
      title={texts.findOrder.entry}
    >
      <Icon name="search" />
    </Link>
  );
}
