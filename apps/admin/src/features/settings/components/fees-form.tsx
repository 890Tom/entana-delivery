import type { DeliverySettings, DeliverySettingsField } from "@entana/contracts";
import type { ReactElement } from "react";

import { TextField } from "../../../components/text-field/text-field";
import { texts } from "../../../i18n/texts";
import { readPriceInput, showPriceInput } from "../../catalogue/rules/product-form";
import cardStyles from "../../../components/card/card.module.css";
import { useSettingsForm } from "../hooks/use-settings-form";
import { readCountInput } from "../rules/settings-form";

import { SaveButton } from "./save-button";
import { SettingsNoticeView } from "./settings-notice";
import styles from "./settings-screen.module.css";

const t = texts.settings.fees;
const FIELDS: readonly DeliverySettingsField[] = ["outOfAxisFeeAr", "freeDeliveryMinPieces"];

/** The card "Hors axe": the fee outside every axis and, quieter, the free delivery threshold. */
export function FeesForm({ settings }: { settings: DeliverySettings }): ReactElement {
  const model = useSettingsForm(settings, FIELDS);
  return (
    <form
      className={[cardStyles.card, styles.card].join(" ")}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        model.submit();
      }}
    >
      <h2 className={cardStyles.title}>{t.title}</h2>
      <TextField
        label={t.fee}
        hint={t.feeHint}
        inputMode="numeric"
        value={showPriceInput(model.values.outOfAxisFeeAr ?? "")}
        error={model.errors.outOfAxisFeeAr === undefined ? undefined : t.feeError}
        onChange={(text) => {
          model.setText("outOfAxisFeeAr", readPriceInput(text));
        }}
      />
      <TextField
        label={t.threshold}
        hint={t.thresholdHint}
        inputMode="numeric"
        width="short"
        value={model.values.freeDeliveryMinPieces ?? ""}
        error={model.errors.freeDeliveryMinPieces === undefined ? undefined : t.thresholdError}
        onChange={(text) => {
          model.setText("freeDeliveryMinPieces", readCountInput(text));
        }}
      />
      <SettingsNoticeView notice={model.notice} />
      <SaveButton model={model} />
    </form>
  );
}
