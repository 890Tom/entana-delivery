import type { ReactElement } from "react";
import { Redirect } from "wouter";

import { Button } from "../../components/button/button";
import { Notice } from "../../components/notice/notice";
import visuallyHidden from "../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../i18n/texts";
import { useDocumentTitle } from "../../layout/document-title/use-document-title";
import { CART_PATH } from "../../routes";
import { useCart } from "../cart/cart-context";
import { useInstance } from "../instance/use-instance";

import styles from "./delivery-screen.module.css";
import { PointPicker } from "./point-picker/point-picker";
import { useDeliveryPlacement } from "./use-delivery-placement";

/**
 * The announcement of a placed point. The same sentence twice in a row would not be read again by
 * a screen reader, so a no-break space is added every other time.
 */
function announce(placementCount: number): string {
  if (placementCount === 0) {
    return "";
  }
  return placementCount % 2 === 1 ? texts.delivery.placed : `${texts.delivery.placed}\u00a0`;
}

function DeliveryContent(): ReactElement {
  const instance = useInstance();
  const placement = useDeliveryPlacement();
  const { positionFailure } = placement;
  return (
    <div className={styles.page}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{texts.delivery.heading}</h1>
        <p className={styles.subtitle}>{texts.delivery.subtitle}</p>
      </div>
      <PointPicker
        config={instance.data?.map}
        isConfigFailed={instance.isError}
        onRetryConfig={() => {
          void instance.refetch();
        }}
        point={placement.point}
        centreOn={placement.centreOn}
        onPick={placement.place}
      >
        <Button
          variant="accent"
          icon="locate-fixed"
          isDisabled={placement.isLocating}
          onClick={placement.askForPosition}
        >
          {texts.delivery.locate}
        </Button>
        {positionFailure !== null && (
          <Notice tone="error">{texts.delivery.geo[positionFailure]}</Notice>
        )}
      </PointPicker>
      <p role="status" className={visuallyHidden.visuallyHidden}>
        {announce(placement.placementCount)}
      </p>
    </div>
  );
}

/** The delivery point of the order: the customer places it on the map or uses their position. */
export function DeliveryScreen(): ReactElement {
  useDocumentTitle(texts.delivery.title);
  const { itemCount } = useCart();
  if (itemCount === 0) {
    // Nothing to deliver: back to the cart, without leaving this address in the history.
    return <Redirect href={CART_PATH} replace />;
  }
  return <DeliveryContent />;
}
