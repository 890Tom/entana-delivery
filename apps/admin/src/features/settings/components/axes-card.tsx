import type { AdminDeliveryAxis } from "@entana/contracts";
import { useId } from "react";
import type { ReactElement } from "react";

import { Notice } from "../../../components/notice/notice";
import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";
import { OrderIcon } from "../../../order-display/order-icons";
import cardStyles from "../../order-detail/components/card.module.css";
import type { AxesModel } from "../hooks/use-axes";
import { useAxesOrder } from "../hooks/use-axes-order";
import type { OrderNotice } from "../hooks/use-axes-order";

import styles from "./axes-card.module.css";
import { AxisList } from "./axis-list";
import screenStyles from "./settings-screen.module.css";

const t = texts.settings.axes;
const SKELETON_ROWS = 3;

const ORDER_NOTICE_TEXT: Readonly<Record<OrderNotice, string>> = {
  changed: t.orderChanged,
  failed: t.orderFailed,
};

/** Rows of the same height as the loaded ones, while the list loads. */
function AxesSkeleton(): ReactElement {
  return (
    <div aria-busy="true">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <span key={index} className={styles.skeletonRow} aria-hidden="true" />
      ))}
      <span className={visuallyHidden.visuallyHidden}>{texts.common.loading}</span>
    </div>
  );
}

function AxesFooter(): ReactElement {
  return (
    <div className={styles.footer}>
      <p className={styles.info}>
        <OrderIcon name="info" size={20} />
        {t.freeInside}
      </p>
    </div>
  );
}

function LoadedAxes({
  axes,
  model,
  helpId,
}: {
  axes: readonly AdminDeliveryAxis[];
  model: AxesModel;
  helpId: string;
}): ReactElement {
  const order = useAxesOrder(model);
  return (
    <>
      {order.notice !== null && <Notice tone="error">{ORDER_NOTICE_TEXT[order.notice]}</Notice>}
      {axes.length === 0 ? (
        <p className={cardStyles.muted}>{t.empty}</p>
      ) : (
        <AxisList axes={axes} onMove={order.move} helpId={helpId} />
      )}
      <AxesFooter />
    </>
  );
}

function AxesContent({ model, helpId }: { model: AxesModel; helpId: string }): ReactElement {
  if (model.axes !== undefined) {
    return <LoadedAxes axes={model.axes} model={model} helpId={helpId} />;
  }
  if (model.hasFailed) {
    return (
      <Notice tone="error" action={{ label: texts.common.retry, onClick: model.reload }}>
        {t.loadFailed}
      </Notice>
    );
  }
  return <AxesSkeleton />;
}

/** The card « Axes de livraison »: the axes in priority order, and how many the shop may have. */
export function AxesCard({ model }: { model: AxesModel }): ReactElement {
  const helpId = useId();
  return (
    <section
      className={[cardStyles.card, screenStyles.card].join(" ")}
      aria-labelledby={`${helpId}-title`}
    >
      <h2 id={`${helpId}-title`} className={cardStyles.title}>
        {t.title}
      </h2>
      <p id={helpId} className={cardStyles.muted}>
        {t.help}
      </p>
      <AxesContent model={model} helpId={helpId} />
    </section>
  );
}
