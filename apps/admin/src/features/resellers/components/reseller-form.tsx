import {
  RESELLER_LANDMARK_MAX_LENGTH,
  RESELLER_NAME_MAX_LENGTH,
  RESELLER_NEIGHBORHOOD_MAX_LENGTH,
} from "@entana/contracts";
import type { AdminReseller } from "@entana/contracts";
import type { ReactElement } from "react";

import { TextField } from "../../../components/text-field/text-field";
import { texts } from "../../../i18n/texts";
import { OrderIcon } from "../../../order-display/order-icons";
import { RESELLERS_PATH } from "../../../routes";
import { FormButton, FormLink } from "../../catalogue/components/form-buttons";
import cardStyles from "../../order-detail/components/card.module.css";
import type { ResellerFormModel } from "../hooks/use-reseller-form";
import type { ResellerFormField } from "../rules/reseller-form";

import { PositionMap } from "./position-map";
import { PublicationCard } from "./publication-card";
import styles from "./reseller-form.module.css";

const t = texts.resellers.form;

function fieldProps(
  model: ResellerFormModel,
  field: ResellerFormField,
): {
  error: string | undefined;
  ref: (element: HTMLInputElement | null) => void;
  onBlur: () => void;
  onChange: (text: string) => void;
  value: string;
} {
  return {
    error: model.errors[field] === undefined ? undefined : t.errors[field],
    ref: model.registerField(field),
    onBlur: () => {
      model.blur(field);
    },
    onChange: (text) => {
      model.setText(field, text);
    },
    value: model.values[field],
  };
}

function Summary({ count }: { count: number }): ReactElement | null {
  if (count === 0) {
    return null;
  }
  return (
    <p role="alert" className={styles.summary}>
      {count === 1 ? t.errors.summaryOne : t.errors.summaryMany(count)}
    </p>
  );
}

function InformationCard({ model }: { model: ResellerFormModel }): ReactElement {
  return (
    <section className={[cardStyles.card, styles.card].join(" ")}>
      <h2 className={cardStyles.title}>{t.information.title}</h2>
      <Summary count={model.refusedCount} />
      <div className={styles.pair}>
        <TextField
          label={t.information.name}
          placeholder={t.information.namePlaceholder}
          maxLength={RESELLER_NAME_MAX_LENGTH}
          {...fieldProps(model, "name")}
        />
        <TextField
          label={t.information.neighborhood}
          placeholder={t.information.neighborhoodPlaceholder}
          maxLength={RESELLER_NEIGHBORHOOD_MAX_LENGTH}
          {...fieldProps(model, "neighborhood")}
        />
      </div>
      <TextField
        label={t.information.landmark}
        placeholder={t.information.landmarkPlaceholder}
        maxLength={RESELLER_LANDMARK_MAX_LENGTH}
        {...fieldProps(model, "landmark")}
      />
    </section>
  );
}

interface PositionCardProps {
  readonly model: ResellerFormModel;
  readonly isNew: boolean;
  /** Present on a reseller that exists: it opens the question of the deletion. */
  readonly onAskDelete: (() => void) | null;
}

function FormActions({ model, isNew, onAskDelete }: PositionCardProps): ReactElement {
  return (
    <div className={styles.buttons}>
      <FormButton
        type="submit"
        variant="primary"
        label={isNew ? t.buttons.create : t.buttons.save}
        icon={<OrderIcon name="check" size={20} />}
        isDisabled={model.isSaving}
        isBusy={model.isSaving}
      />
      <FormLink
        href={RESELLERS_PATH}
        variant="ghost"
        label={t.buttons.cancel}
        isDisabled={model.isSaving}
      />
      {onAskDelete !== null && (
        <span className={styles.delete}>
          <FormButton
            variant="dangerGhost"
            label={t.buttons.delete}
            isDisabled={model.isSaving}
            onClick={onAskDelete}
          />
        </span>
      )}
    </div>
  );
}

function PositionCard(props: PositionCardProps): ReactElement {
  const { model, isNew } = props;
  return (
    <section className={[cardStyles.card, styles.card].join(" ")}>
      <h2 className={cardStyles.title}>{t.map.title}</h2>
      <PositionMap point={model.point} onPick={model.setPoint} />
      <p className={styles.help}>{isNew ? t.map.helpNew : t.map.helpEdit}</p>
      <div className={styles.pair}>
        <TextField
          label={t.map.latitude}
          placeholder={t.map.latitudePlaceholder}
          {...fieldProps(model, "latitude")}
        />
        <TextField
          label={t.map.longitude}
          placeholder={t.map.longitudePlaceholder}
          {...fieldProps(model, "longitude")}
        />
      </div>
      <FormActions {...props} />
    </section>
  );
}

interface ResellerFormProps {
  readonly model: ResellerFormModel;
  /** The reseller being changed; null for a new one. */
  readonly reseller: AdminReseller | null;
  readonly isBusy: boolean;
  readonly onVerify: () => void;
  readonly onAskDelete: (() => void) | null;
}

/** The two columns of the form: information and publication, then the position. */
export function ResellerForm({
  model,
  reseller,
  isBusy,
  onVerify,
  onAskDelete,
}: ResellerFormProps): ReactElement {
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        model.submit();
      }}
    >
      <div className={styles.column}>
        <InformationCard model={model} />
        <PublicationCard model={model} reseller={reseller} isBusy={isBusy} onVerify={onVerify} />
      </div>
      <PositionCard model={model} isNew={reseller === null} onAskDelete={onAskDelete} />
    </form>
  );
}
