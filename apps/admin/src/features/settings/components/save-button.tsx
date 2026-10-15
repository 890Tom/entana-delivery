import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import { OrderIcon } from "../../../order-display/order-icons";
import { FormButton } from "../../../components/form-buttons/form-buttons";
import type { SettingsFormModel } from "../hooks/use-settings-form";

import styles from "./settings-screen.module.css";

/** "Enregistrer": disabled while every field holds the saved value. */
export function SaveButton({ model }: { model: SettingsFormModel }): ReactElement {
  return (
    <div className={styles.actions}>
      <FormButton
        type="submit"
        label={texts.settings.save}
        variant="primary"
        icon={<OrderIcon name="check" size={20} />}
        isDisabled={!model.isChanged}
        isBusy={model.isSaving}
      />
    </div>
  );
}
