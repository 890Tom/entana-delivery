import type { ReactElement } from "react";

import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";

import line from "./cart-line.module.css";
import styles from "./cart-skeleton.module.css";

const LINE_COUNT = 3;
const LINE_INDEXES = Array.from({ length: LINE_COUNT }, (_unused, index) => index);

function SkeletonLine(): ReactElement {
  const block = [styles.block, line.text].join(" ");
  return (
    <li className={line.line}>
      <div className={[styles.block, line.thumbnail].join(" ")} />
      <div>
        <div className={[block, styles.name].join(" ")} />
        <div className={[block, styles.amount].join(" ")} />
      </div>
      <div className={[styles.block, styles.control, line.stepper].join(" ")} />
    </li>
  );
}

/** Lines of the shape of the loaded ones: the cart is not editable until the catalogue is there. */
export function CartSkeleton(): ReactElement {
  return (
    <div aria-busy="true">
      <span className={visuallyHidden.visuallyHidden}>{texts.common.loading}</span>
      <ul className={styles.list} aria-hidden="true">
        {LINE_INDEXES.map((index) => (
          <SkeletonLine key={index} />
        ))}
      </ul>
    </div>
  );
}
