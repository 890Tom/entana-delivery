import { MAX_LANDMARK_LENGTH } from "@entana/contracts";
import type { ReactElement, SubmitEvent } from "react";

import bar from "../../../components/bottom-bar/bottom-bar.module.css";
import { DeliveryFeeLine } from "../../../components/delivery-fee-line/delivery-fee-line";
import { TextField } from "../../../components/text-field/text-field";
import { texts } from "../../../i18n/texts";
import { estimateDeliveryFee } from "../rules/estimate-delivery-fee";

import styles from "./delivery-form.module.css";
import type { DeliveryFormState } from "./use-delivery-form";

interface DeliveryFormProps {
  readonly id: string;
  readonly form: DeliveryFormState;
}

/**
 * The written landmark, the delivery fee and, from 1024 px, the "Continuer" button. On a phone
 * the button is the one of the fixed bar, which submits this form by its `id`. Not validated by
 * the browser (`noValidate`): the errors are the design system's own.
 */
export function DeliveryForm({ id, form }: DeliveryFormProps): ReactElement {
  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    form.submit();
  };
  return (
    <form id={id} noValidate className={styles.form} onSubmit={handleSubmit}>
      <TextField
        ref={form.landmarkRef}
        label={texts.delivery.landmark.label}
        hint={texts.delivery.landmark.hint}
        error={form.isLandmarkInvalid ? texts.delivery.landmark.error : undefined}
        value={form.landmark}
        onChange={form.setLandmark}
        inputMode="text"
        autoComplete="off"
        maxLength={MAX_LANDMARK_LENGTH}
        isRequired
      />
      <DeliveryFeeLine amountAr={estimateDeliveryFee()} />
      {/* Not displayed under 1024 px (display: none, so it is not in the tab order either). */}
      <div className={styles.desktopAction}>
        <button type="submit" className={bar.link}>
          {texts.delivery.continue}
        </button>
      </div>
    </form>
  );
}
