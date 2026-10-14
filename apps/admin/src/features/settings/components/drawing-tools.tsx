import { useId } from "react";
import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import { OrderIcon } from "../../../order-display/order-icons";
import { FormButton } from "../../catalogue/components/form-buttons";
import type { PlaceDrawingModel } from "../hooks/use-place-drawing";

import styles from "./place-drawing.module.css";
import { ToggleButton } from "./toggle-button";

const t = texts.settings.axisEditor;

/** Over the map: the trace banner with « Terminer », or « Créer un lieu ». */
export function MapTools({ drawing }: { drawing: PlaceDrawingModel }): ReactElement {
  const fullId = useId();
  if (drawing.mode === "trace") {
    return (
      <div className={styles.tools}>
        <div className={styles.banner}>
          <OrderIcon name="route" size={20} />
          <p className={styles.bannerText}>
            <strong>{t.drawing.traceTitle}</strong> · {t.drawing.traceHint}
          </p>
          <FormButton variant="secondary" label={t.drawing.finish} onClick={drawing.toggleTrace} />
        </div>
      </div>
    );
  }
  return (
    <div className={styles.tools}>
      <ToggleButton
        label={t.drawing.create}
        isOn={drawing.mode === "create"}
        isDisabled={drawing.isFull}
        describedBy={drawing.isFull ? fullId : undefined}
        onToggle={drawing.toggleCreate}
      />
      {drawing.isFull && (
        <p id={fullId} className={styles.toolsNote}>
          {t.search.full}
        </p>
      )}
    </div>
  );
}

/** In the form: the trace on or off and, while it is on, the undo of its last point. */
export function TraceTools({ drawing }: { drawing: PlaceDrawingModel }): ReactElement {
  const isOn = drawing.mode === "trace";
  return (
    <div className={styles.traceTools}>
      <ToggleButton
        label={t.drawing.trace}
        onText={t.drawing.traceOn}
        isOn={isOn}
        icon={isOn ? <OrderIcon name="check" size={20} /> : undefined}
        isDisabled={!isOn && drawing.isFull}
        onToggle={drawing.toggleTrace}
      />
      {isOn && (
        <FormButton
          variant="secondary"
          label={t.drawing.undo}
          icon={<OrderIcon name="undo" size={20} />}
          isDisabled={!drawing.canUndo}
          onClick={drawing.undo}
        />
      )}
    </div>
  );
}
