import type { AdminProduct } from "@entana/contracts";
import { PRODUCT_IMAGE_ALT_MAX_LENGTH } from "@entana/contracts";
import type { ReactElement } from "react";

import { TextField } from "../../../components/text-field/text-field";
import { texts } from "../../../i18n/texts";
import { useProductForm } from "./use-product-form";
import type { ProductFormModel } from "./use-product-form";
import type { NoticeState } from "../notice/use-catalogue-notice";

import { fieldErrorText } from "./field-error-text";
import { InformationCard } from "./information-card";
import { PhotoCard } from "./photo-card";
import styles from "./product-form.module.css";
import { PreviewCard } from "./preview-card";

const t = texts.catalogueForm;

interface ProductFormProps {
  /** The product being changed; null for a new one. */
  readonly product: AdminProduct | null;
  readonly notices: NoticeState;
  readonly onSaved: () => void;
  readonly onAskRetire: (() => void) | null;
}

/** The alternative text: obligatory as soon as the product has a photo, chosen or kept. */
function AltTextField({ model }: { model: ProductFormModel }): ReactElement {
  return (
    <TextField
      label={model.hasPhoto ? t.imageAlt.labelRequired : t.imageAlt.labelNew}
      placeholder={t.imageAlt.placeholder}
      hint={t.imageAlt.hint}
      maxLength={PRODUCT_IMAGE_ALT_MAX_LENGTH}
      value={model.values.imageAlt}
      error={fieldErrorText(model.errors.imageAlt)}
      ref={model.registerField("imageAlt")}
      onChange={(text) => {
        model.setText("imageAlt", text);
      }}
      onBlur={() => {
        model.blur("imageAlt");
      }}
    />
  );
}

function PhotoSection({ model }: { model: ProductFormModel }): ReactElement {
  const { photo } = model;
  return (
    <PhotoCard
      currentUrl={model.currentPhotoUrl}
      chosenUrl={photo.previewUrl}
      problem={photo.problem}
      isUploading={model.isSaving && photo.file !== null}
      isDisabled={model.isSaving}
      onChoose={photo.choose}
    >
      <AltTextField model={model} />
    </PhotoCard>
  );
}

/** The two columns of the form: the photo and the preview, the information. */
export function ProductForm({
  product,
  notices,
  onSaved,
  onAskRetire,
}: ProductFormProps): ReactElement {
  const model = useProductForm({ product, notices, onSaved });
  const { values } = model;
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        model.submit();
      }}
    >
      <div className={styles.photo}>
        <PhotoSection model={model} />
      </div>
      <div className={styles.information}>
        <InformationCard model={model} isNew={product === null} onAskRetire={onAskRetire} />
      </div>
      <div className={styles.preview}>
        <PreviewCard
          name={values.name}
          priceAr={Number(values.price)}
          imageUrl={model.photo.previewUrl ?? model.currentPhotoUrl}
          isVisible={values.isVisible}
          isAvailable={values.isAvailable}
        />
      </div>
    </form>
  );
}
