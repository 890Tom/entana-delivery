import type { DeliveryResolveResponse } from "@entana/contracts";
import { useId, useMemo } from "react";
import type { ReactElement } from "react";

import { Notice } from "../../../components/notice/notice";
import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";
import { OrderIcon } from "../../../order-display/order-icons";
import cardStyles from "../../../components/card/card.module.css";
import positionStyles from "../../../map/position-map.module.css";
import { AddressSearch } from "../../address-search/address-search";
import { useAddressTest } from "./use-address-test";
import type { AddressTestState } from "./use-address-test";
import type { AxesModel } from "../api/use-axes";
import { selectDrawnAxes } from "../rules/axes-drawing";

import styles from "../axes-list/axes-card.module.css";
import { AxesMap } from "./axes-map";

const t = texts.settings.map;

/** The server's answer in words; a free delivery for the quantity reads like the fee outside. */
function resultText(result: DeliveryResolveResponse): string {
  if (result.reason === "axis" && result.match !== null) {
    return t.inside(result.match.axis.name, result.match.place.name);
  }
  return t.outside(result.feeAr);
}

function TestLineContent({ state }: { state: AddressTestState }): ReactElement | null {
  switch (state.kind) {
    case "idle":
      return (
        <>
          <OrderIcon name="mouse-pointer-click" size={20} />
          {t.prompt}
        </>
      );
    case "pending":
      return <span className={visuallyHidden.visuallyHidden}>{texts.common.loading}</span>;
    case "done":
      return <>{resultText(state.result)}</>;
    case "failed":
      return null;
  }
}

/** The card « Carte des axes »: the map, then the invitation to test or the last result. */
export function AxesMapCard({ model }: { model: AxesModel }): ReactElement {
  const titleId = useId();
  const test = useAddressTest(model.reload);
  const drawn = useMemo(() => selectDrawnAxes(model.axes ?? []), [model.axes]);
  const isListLoading = model.axes === undefined && !model.hasFailed;
  return (
    <section className={cardStyles.card} aria-labelledby={titleId}>
      <h2 id={titleId} className={cardStyles.title}>
        {t.title}
      </h2>
      {isListLoading ? (
        // The map waits for the list, so that its first view frames the axes. The search waits
        // with it, inactive, so that the card keeps its layout.
        <>
          <AddressSearch isDisabled onChoose={() => undefined} />
          <div className={positionStyles.frame} aria-busy="true">
            <div className={positionStyles.skeleton}>
              <span className={visuallyHidden.visuallyHidden}>{texts.common.loading}</span>
            </div>
          </div>
        </>
      ) : (
        <AxesMap axes={drawn} point={test.point} onPick={test.run} />
      )}
      <p className={styles.testLine} role="status">
        <TestLineContent state={test.state} />
      </p>
      {test.state.kind === "failed" && <Notice tone="error">{t.testFailed}</Notice>}
    </section>
  );
}
