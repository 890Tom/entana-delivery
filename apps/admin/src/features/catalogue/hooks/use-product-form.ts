import type { AdminProduct } from "@entana/contracts";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

import { texts } from "../../../i18n/texts";
import { CATALOGUE_PATH, catalogueProductPath } from "../../../routes";
import { saveProduct } from "../api/save-product";
import type { SaveOutcome } from "../api/save-product";
import { useCatalogueFlash } from "../notice/catalogue-flash";
import type { CatalogueFlash } from "../notice/catalogue-flash";
import { describeSaveFailure } from "../rules/save-failure";
import {
  canPublish,
  emptyProductForm,
  FORM_FIELD_ORDER,
  formValuesOf,
  readPriceInput,
  readSkuInput,
  validateProductForm,
} from "../rules/product-form";
import type { ProductFormErrors, ProductFormField, ProductFormValues } from "../rules/product-form";

import type { NoticeState } from "./use-catalogue-notice";
import { usePhotoChoice } from "./use-photo-choice";
import type { PhotoChoice } from "./use-photo-choice";
import { useProductsCache } from "./use-products";
import type { ProductsCache } from "./use-products";

const t = texts.catalogueForm;

export interface ProductFormModel {
  readonly values: ProductFormValues;
  readonly errors: ProductFormErrors;
  /** How many fields the last attempt refused; 0 once the form is accepted. */
  readonly refusedCount: number;
  readonly isSaving: boolean;
  readonly photo: PhotoChoice;
  /** The address of the photo the product already has. */
  readonly currentPhotoUrl: string | null;
  readonly hasPhoto: boolean;
  readonly isPublishable: boolean;
  readonly hasPublishError: boolean;
  readonly setText: (field: ProductFormField, text: string) => void;
  readonly blur: (field: ProductFormField) => void;
  readonly setAvailable: (isAvailable: boolean) => void;
  readonly setVisible: (isVisible: boolean) => void;
  readonly submit: () => void;
  /** The ref of the control of a field, so that the first refused one takes the focus. */
  readonly registerField: (field: ProductFormField) => (element: HTMLInputElement | null) => void;
}

interface FormOptions {
  /** The product being changed; null for a new one. */
  readonly product: AdminProduct | null;
  readonly notices: NoticeState;
  /** The product was saved and stays on screen: the form starts again from the saved product. */
  readonly onSaved: () => void;
}

function useFieldFocus(): {
  register: ProductFormModel["registerField"];
  focusFirst: (errors: ProductFormErrors) => void;
} {
  const elements = useRef<Partial<Record<ProductFormField, HTMLInputElement | null>>>({});
  const [target, setTarget] = useState<{ field: ProductFormField } | null>(null);
  useEffect(() => {
    if (target !== null) {
      elements.current[target.field]?.focus();
    }
  }, [target]);
  return {
    register: (field) => (element) => {
      elements.current[field] = element;
    },
    focusFirst: (errors) => {
      const field = FORM_FIELD_ORDER.find((candidate) => errors[candidate] !== undefined);
      if (field !== undefined) {
        // A new object each time, so that two refusals in a row move the focus twice.
        setTarget({ field });
      }
    },
  };
}

function noticeText(notice: "failed" | "photoFailed" | "publishFailed"): string {
  switch (notice) {
    case "failed":
      return t.notices.failed;
    case "photoFailed":
      return t.notices.photoFailed;
    case "publishFailed":
      return t.notices.publishFailed;
  }
}

interface Reactions {
  readonly product: AdminProduct | null;
  readonly cache: ProductsCache;
  readonly notices: NoticeState;
  readonly photo: PhotoChoice;
  readonly onSaved: () => void;
  readonly navigate: (path: string, options?: { replace: boolean }) => void;
  readonly flash: CatalogueFlash;
  readonly setErrors: (errors: ProductFormErrors) => void;
  readonly setHasPublishError: (hasError: boolean) => void;
  readonly focusFirst: (errors: ProductFormErrors) => void;
}

/** What each end of a save does on screen. */
function applyOutcome(outcome: SaveOutcome, reactions: Reactions): void {
  const { cache, notices, navigate } = reactions;
  if (outcome.product !== null) {
    cache.upsert(outcome.product);
  }
  if (outcome.kind === "saved") {
    if (reactions.product === null) {
      reactions.flash.post({ tone: "info", text: t.notices.created(outcome.product.name) });
      navigate(CATALOGUE_PATH);
    } else {
      notices.show({ tone: "info", text: t.notices.saved });
      reactions.onSaved();
    }
    return;
  }
  const view = describeSaveFailure(outcome);
  if (view.isUnauthorized) {
    cache.invalidate();
  } else if (view.isRedirect && outcome.product !== null) {
    reactions.flash.post({ tone: "error", text: t.notices.photoFailed });
    navigate(catalogueProductPath(outcome.product.id), { replace: true });
  } else {
    reactions.photo.setProblem(view.photoProblem);
    reactions.setErrors(view.fieldErrors);
    reactions.setHasPublishError(view.hasPublishError);
    reactions.focusFirst(view.fieldErrors);
    if (view.notice !== null) {
      notices.show({ tone: "error", text: noticeText(view.notice) });
    }
  }
}

function readInput(field: ProductFormField, text: string): string {
  if (field === "price") {
    return readPriceInput(text);
  }
  return field === "sku" ? readSkuInput(text) : text;
}

interface Fields {
  readonly values: ProductFormValues;
  readonly errors: ProductFormErrors;
  readonly hasPublishError: boolean;
  readonly setErrors: (errors: ProductFormErrors) => void;
  readonly setHasPublishError: (hasError: boolean) => void;
  readonly setText: ProductFormModel["setText"];
  readonly blur: ProductFormModel["blur"];
  readonly setAvailable: ProductFormModel["setAvailable"];
  readonly setVisible: ProductFormModel["setVisible"];
}

/** The values and the errors: an error is looked at again as the field is typed in. */
function useFields(product: AdminProduct | null, hasPhoto: boolean): Fields {
  const [values, setValues] = useState(() =>
    product === null ? emptyProductForm() : formValuesOf(product),
  );
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [hasPublishError, setHasPublishError] = useState(false);
  const refresh = (field: ProductFormField, next: ProductFormValues): void => {
    const found = validateProductForm(next, hasPhoto)[field];
    setErrors((current) => ({ ...current, [field]: found }));
  };
  return {
    values,
    errors,
    hasPublishError,
    setErrors,
    setHasPublishError,
    setText: (field, text) => {
      const next = { ...values, [field]: readInput(field, text) };
      setValues(next);
      if (errors[field] !== undefined) {
        refresh(field, next);
      }
    },
    blur: (field) => {
      refresh(field, values);
    },
    setAvailable: (isAvailable) => {
      setValues({ ...values, isAvailable });
    },
    setVisible: (isVisible) => {
      setValues({ ...values, isVisible });
      setHasPublishError(false);
    },
  };
}

interface Saving {
  readonly isSaving: boolean;
  readonly refusedCount: number;
  readonly submit: () => void;
}

interface SavingInputs extends FormOptions {
  readonly fields: Fields;
  readonly photo: PhotoChoice;
  readonly hasPhoto: boolean;
  readonly focusFirst: (errors: ProductFormErrors) => void;
}

/** Shows what is wrong with the form, moves the focus to the first of it; how many fields. */
function checkForm(
  fields: Fields,
  hasPhoto: boolean,
  focusFirst: (errors: ProductFormErrors) => void,
): number {
  const found = validateProductForm(fields.values, hasPhoto);
  const refused = FORM_FIELD_ORDER.filter((field) => found[field] !== undefined);
  fields.setErrors(found);
  fields.setHasPublishError(false);
  if (refused.length > 0) {
    focusFirst(found);
  }
  return refused.length;
}

/** Checks the form, then saves it; what comes back is put on screen by `applyOutcome`. */
function useSaving(inputs: SavingInputs): Saving {
  const { product, notices, onSaved, fields, photo, hasPhoto, focusFirst } = inputs;
  const [refusedCount, setRefusedCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const cache = useProductsCache();
  const flash = useCatalogueFlash();
  const [, navigate] = useLocation();

  const submit = (): void => {
    if (isSaving) {
      return;
    }
    const refusedNow = checkForm(fields, hasPhoto, focusFirst);
    setRefusedCount(refusedNow);
    if (refusedNow > 0) {
      return;
    }
    notices.clear();
    photo.setProblem(null);
    setIsSaving(true);
    void saveProduct({ product, values: fields.values, photo: photo.file }).then((outcome) => {
      setIsSaving(false);
      applyOutcome(outcome, {
        product,
        cache,
        notices,
        photo,
        onSaved,
        navigate,
        flash,
        setErrors: fields.setErrors,
        setHasPublishError: fields.setHasPublishError,
        focusFirst,
      });
    });
  };
  return { isSaving, refusedCount, submit };
}

/**
 * The state of the form of a product: the values, the errors (shown when a field is left and
 * when the form is sent), the chosen photo, and the save. The server stays the authority.
 */
export function useProductForm(options: FormOptions): ProductFormModel {
  const photo = usePhotoChoice();
  const focus = useFieldFocus();
  const currentPhotoUrl = options.product?.image?.url ?? null;
  const hasPhoto = currentPhotoUrl !== null || photo.file !== null;
  const fields = useFields(options.product, hasPhoto);
  const saving = useSaving({ ...options, fields, photo, hasPhoto, focusFirst: focus.focusFirst });
  return {
    ...fields,
    ...saving,
    photo,
    currentPhotoUrl,
    hasPhoto,
    isPublishable: canPublish(fields.values, hasPhoto),
    registerField: focus.register,
  };
}
