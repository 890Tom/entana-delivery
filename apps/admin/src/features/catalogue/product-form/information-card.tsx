import { PRODUCT_DESCRIPTION_MAX_LENGTH, PRODUCT_NAME_MAX_LENGTH } from "@entana/contracts";
import type { ReactElement, Ref } from "react";

import { TextField } from "../../../components/text-field/text-field";
import { texts } from "../../../i18n/texts";
import { OrderIcon } from "../../../order-display/order-icons";
import { CATALOGUE_PATH } from "../../../routes";
import type { ProductFormModel } from "./use-product-form";
import { showPriceInput } from "../rules/product-form";
import type { ProductFormField } from "../rules/product-form";
import cardStyles from "../../../components/card/card.module.css";

import { CatalogueIcon } from "../../../components/catalogue-icons/catalogue-icons";
import { fieldErrorText } from "./field-error-text";
import { FormButton, FormLink } from "../../../components/form-buttons/form-buttons";
import styles from "./information-card.module.css";
import { SwitchRow } from "../../../components/switch-row/switch-row";

const t = texts.catalogueForm;

interface InformationCardProps {
  readonly model: ProductFormModel;
  readonly isNew: boolean;
  /** Present on a product that is not retired: it opens the question of the retirement. */
  readonly onAskRetire: (() => void) | null;
}

interface FieldProps {
  readonly error: string | undefined;
  readonly ref: Ref<HTMLInputElement>;
  readonly onBlur: () => void;
}

/** What every field shares: its error, its place for the focus and the check when it is left. */
function fieldProps(model: ProductFormModel, name: ProductFormField): FieldProps {
  return {
    error: fieldErrorText(model.errors[name]),
    ref: model.registerField(name),
    onBlur: () => {
      model.blur(name);
    },
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

function IdentityFields({ model }: { model: ProductFormModel }): ReactElement {
  const { values } = model;
  return (
    <>
      <TextField
        label={t.information.name}
        placeholder={t.information.namePlaceholder}
        maxLength={PRODUCT_NAME_MAX_LENGTH}
        value={values.name}
        onChange={(text) => {
          model.setText("name", text);
        }}
        {...fieldProps(model, "name")}
      />
      <div className={styles.pair}>
        <TextField
          label={t.information.price}
          placeholder={t.information.pricePlaceholder}
          inputMode="numeric"
          value={showPriceInput(values.price)}
          onChange={(text) => {
            model.setText("price", text);
          }}
          {...fieldProps(model, "price")}
        />
        <TextField
          label={t.information.sku}
          placeholder={t.information.skuPlaceholder}
          hint={t.information.skuHint}
          value={values.sku}
          onChange={(text) => {
            model.setText("sku", text);
          }}
          {...fieldProps(model, "sku")}
        />
      </div>
    </>
  );
}

function DescriptionField({ model }: { model: ProductFormModel }): ReactElement {
  return (
    <TextField
      label={t.information.description}
      labelSuffix={t.information.descriptionOptional}
      placeholder={t.information.descriptionPlaceholder}
      maxLength={PRODUCT_DESCRIPTION_MAX_LENGTH}
      value={model.values.description}
      onChange={(text) => {
        model.setText("description", text);
      }}
      {...fieldProps(model, "description")}
    />
  );
}

/** The help of the visibility switch: what is missing to publish, or what turning it off does. */
function visibleHelpOf(isLocked: boolean, isVisible: boolean): string | null {
  if (isLocked) {
    return t.switches.visibleLockedHelp;
  }
  return isVisible ? t.switches.visibleOnHelp : null;
}

function Switches({ model }: { model: ProductFormModel }): ReactElement {
  const { values } = model;
  const isLocked = !model.isPublishable && !values.isVisible;
  return (
    <div>
      <SwitchRow
        label={t.switches.available}
        help={t.switches.availableHelp}
        isOn={values.isAvailable}
        isDisabled={model.isSaving}
        onToggle={() => {
          model.setAvailable(!values.isAvailable);
        }}
      />
      <SwitchRow
        label={t.switches.visible}
        help={visibleHelpOf(isLocked, values.isVisible)}
        error={model.hasPublishError ? t.errors.notPublishable : undefined}
        isOn={values.isVisible}
        isLocked={isLocked}
        isDisabled={model.isSaving}
        onToggle={() => {
          model.setVisible(!values.isVisible);
        }}
      />
    </div>
  );
}

function Actions({ model, isNew, onAskRetire }: InformationCardProps): ReactElement {
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
        href={CATALOGUE_PATH}
        variant="ghost"
        label={t.buttons.cancel}
        isDisabled={model.isSaving}
      />
      {onAskRetire !== null && (
        <span className={styles.retire}>
          <FormButton
            variant="dangerGhost"
            label={t.buttons.retire}
            icon={<CatalogueIcon name="archive" size={20} />}
            isDisabled={model.isSaving}
            onClick={onAskRetire}
          />
        </span>
      )}
    </div>
  );
}

/** The "Informations" card: the fields, the two switches and the buttons. */
export function InformationCard(props: InformationCardProps): ReactElement {
  return (
    <section className={[cardStyles.card, styles.card].join(" ")}>
      <h2 className={cardStyles.title}>{t.information.title}</h2>
      <Summary count={props.model.refusedCount} />
      <IdentityFields model={props.model} />
      <DescriptionField model={props.model} />
      <Switches model={props.model} />
      <Actions {...props} />
    </section>
  );
}
