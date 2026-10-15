import { useId } from "react";
import type { ReactElement } from "react";
import { Redirect } from "wouter";

import { BottomBar } from "../../components/bottom-bar/bottom-bar";
import { Button } from "../../components/button/button";
import { Notice } from "../../components/notice/notice";
import visuallyHidden from "../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../i18n/texts";
import { useDocumentTitle } from "../../layout/document-title/use-document-title";
import { CART_PATH } from "../../routes";
import { useCart } from "../cart/cart-state/cart-context";
import { useInstance } from "../instance/api/use-instance";

import { useDeliveryZones } from "./api/use-delivery-zones";

import { DeliveryForm } from "./delivery-form/delivery-form";
import { useDeliveryForm } from "./delivery-form/use-delivery-form";
import styles from "./delivery-screen.module.css";
import { PointPicker } from "./point-picker/point-picker";
import { useDeliveryPlacement } from "./position/use-delivery-placement";
import type { DeliveryPlacement } from "./position/use-delivery-placement";
import { useDeliveryQuote } from "./quote/use-delivery-quote";
import type { DeliveryQuoteState } from "./quote/use-delivery-quote";

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

/** The position button and what it may answer: the first of the side column under "Placer ici". */
function PositionControls({ placement }: { placement: DeliveryPlacement }): ReactElement {
  const { positionFailure } = placement;
  return (
    <>
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
    </>
  );
}

/** The fixed bar of a phone: inactive (still focusable) and busy until the fee is known. */
function ContinueBar({ formId, fee }: { formId: string; fee: DeliveryQuoteState }): ReactElement {
  return (
    <BottomBar
      formId={formId}
      label={texts.delivery.continue}
      isDisabled={fee.status !== "ready"}
      isBusy={fee.status === "loading"}
    />
  );
}

function TitleBlock(): ReactElement {
  return (
    <div className={styles.titleBlock}>
      <h1 className={styles.title}>{texts.delivery.heading}</h1>
      <p className={styles.subtitle}>{texts.delivery.subtitle}</p>
    </div>
  );
}

/**
 * The notice of the other screens when a product was dropped from the cart: the next screens send
 * the customer back here when that changes the pieces, so it is shown here too, closed the same way.
 */
function RemovedProductNotice(): ReactElement | null {
  const { hasRemovedUnavailable } = useCart();
  return hasRemovedUnavailable ? (
    <Notice tone="info">{texts.cart.removedUnavailable}</Notice>
  ) : null;
}

function DeliveryContent({ pieces }: { pieces: number }): ReactElement {
  const instance = useInstance();
  const placement = useDeliveryPlacement();
  const fee = useDeliveryQuote(placement.point, pieces);
  const form = useDeliveryForm(fee.status === "ready");
  const zones = useDeliveryZones();
  const formId = useId();
  return (
    <div className={styles.page}>
      <TitleBlock />
      <RemovedProductNotice />
      <PointPicker
        config={instance.data?.map}
        isConfigFailed={instance.isError}
        onRetryConfig={() => {
          void instance.refetch();
        }}
        point={placement.point}
        centreOn={placement.centreOn}
        onPick={placement.place}
        zones={zones}
        notice={
          form.isPointMissing ? (
            <Notice tone="error" ref={form.noticeRef} tabIndex={-1}>
              {texts.delivery.pointMissing}
            </Notice>
          ) : undefined
        }
      >
        <PositionControls placement={placement} />
        <DeliveryForm id={formId} form={form} fee={fee} />
      </PointPicker>
      <p role="status" className={visuallyHidden.visuallyHidden}>
        {announce(placement.placementCount)}
      </p>
      <ContinueBar formId={formId} fee={fee} />
    </div>
  );
}

/** The delivery point and the landmark of the order, then the way on to the contact details. */
export function DeliveryScreen(): ReactElement {
  useDocumentTitle(texts.delivery.title);
  const { itemCount } = useCart();
  if (itemCount === 0) {
    // Nothing to deliver: back to the cart, without leaving this address in the history.
    return <Redirect href={CART_PATH} replace />;
  }
  return <DeliveryContent pieces={itemCount} />;
}
