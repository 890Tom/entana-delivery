import type { DeliverySettings, DeliverySettingsField } from "@entana/contracts";
import type { ReactElement } from "react";

import { TextField } from "../../../components/text-field/text-field";
import { texts } from "../../../i18n/texts";
import cardStyles from "../../../components/card/card.module.css";
import { useSettingsForm } from "../hooks/use-settings-form";
import type { SettingsFieldError } from "../rules/settings-form";

import { ClientPreview } from "./client-preview";
import { SaveButton } from "./save-button";
import { SettingsNoticeView } from "./settings-notice";
import styles from "./settings-screen.module.css";

const t = texts.settings.texts;
const FIELDS: readonly DeliverySettingsField[] = ["outOfAxisMessage"];

function messageErrorOf(error: SettingsFieldError | undefined): string | undefined {
  if (error === undefined) {
    return undefined;
  }
  return error === "tooLong" ? t.messageTooLong : t.messageEmpty;
}

/** The card "Textes" and, beside it, the preview that follows the typing. */
export function TextsForm({ settings }: { settings: DeliverySettings }): ReactElement {
  const model = useSettingsForm(settings, FIELDS);
  const message = model.values.outOfAxisMessage ?? "";
  return (
    <div className={styles.columns}>
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
          label={t.message}
          hint={t.messageHint}
          isMultiline
          value={message}
          error={messageErrorOf(model.errors.outOfAxisMessage)}
          onChange={(text) => {
            model.setText("outOfAxisMessage", text);
          }}
        />
        <SettingsNoticeView notice={model.notice} />
        <SaveButton model={model} />
      </form>
      <ClientPreview message={message} feeAr={settings.outOfAxisFeeAr} />
    </div>
  );
}
