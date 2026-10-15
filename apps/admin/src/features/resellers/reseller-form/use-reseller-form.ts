import type { AdminReseller } from "@entana/contracts";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

import type { AdminResult } from "../../../data-fetching/fetch-admin";
import { RESELLERS_PATH } from "../../../routes";
import { patchReseller, postReseller } from "../api/reseller-calls";
import { describeFailure } from "../rules/describe-save-failure";
import {
  buildCreateBody,
  buildUpdateBody,
  canPublish,
  coordinateText,
  emptyResellerForm,
  formValuesOf,
  pointOf,
  RESELLER_FIELD_ORDER,
  validateResellerForm,
} from "../rules/reseller-form";
import type {
  MapPoint,
  ResellerFormErrors,
  ResellerFormField,
  ResellerFormValues,
} from "../rules/reseller-form";

import { useResellersCache } from "../api/use-resellers";
import type { ResellersCache } from "../api/use-resellers";

export type FormNotice = "failed" | "gone";

export interface ResellerFormModel {
  readonly values: ResellerFormValues;
  readonly errors: ResellerFormErrors;
  /** How many fields the last attempt refused; 0 once the form is accepted. */
  readonly refusedCount: number;
  readonly isSaving: boolean;
  readonly isPublishable: boolean;
  readonly hasPublishError: boolean;
  readonly notice: FormNotice | null;
  /** The marker: null until both coordinates are valid. */
  readonly point: MapPoint | null;
  readonly setText: (field: ResellerFormField, text: string) => void;
  readonly blur: (field: ResellerFormField) => void;
  readonly setPoint: (point: MapPoint) => void;
  readonly setConsent: (isGiven: boolean) => void;
  readonly setVisible: (isVisible: boolean) => void;
  readonly submit: () => void;
  /** The ref of the control of a field, so that the first refused one takes the focus. */
  readonly registerField: (field: ResellerFormField) => (element: HTMLInputElement | null) => void;
}

function useFieldFocus(): {
  register: ResellerFormModel["registerField"];
  focusFirst: (errors: ResellerFormErrors) => void;
} {
  const elements = useRef<Partial<Record<ResellerFormField, HTMLInputElement | null>>>({});
  const [target, setTarget] = useState<{ field: ResellerFormField } | null>(null);
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
      const field = RESELLER_FIELD_ORDER.find((candidate) => errors[candidate] !== undefined);
      if (field !== undefined) {
        // A new object each time, so that two refusals in a row move the focus twice.
        setTarget({ field });
      }
    },
  };
}

interface Fields {
  readonly values: ResellerFormValues;
  readonly errors: ResellerFormErrors;
  readonly setErrors: (errors: ResellerFormErrors) => void;
  readonly setText: ResellerFormModel["setText"];
  readonly blur: ResellerFormModel["blur"];
  readonly setPoint: ResellerFormModel["setPoint"];
  readonly setConsent: ResellerFormModel["setConsent"];
  readonly setVisible: ResellerFormModel["setVisible"];
}

/** The values and the errors: an error is looked at again as the field is typed in. */
function useFields(reseller: AdminReseller | null): Fields {
  const [values, setValues] = useState(() =>
    reseller === null ? emptyResellerForm() : formValuesOf(reseller),
  );
  const [errors, setErrors] = useState<ResellerFormErrors>({});
  const refresh = (next: ResellerFormValues, field: ResellerFormField): void => {
    const isRefused = validateResellerForm(next)[field];
    setErrors((current) => ({ ...current, [field]: isRefused }));
  };
  return {
    values,
    errors,
    setErrors,
    setText: (field, text) => {
      const next = { ...values, [field]: text };
      setValues(next);
      if (errors[field] !== undefined) {
        refresh(next, field);
      }
    },
    blur: (field) => {
      refresh(values, field);
    },
    setPoint: (point) => {
      const next = {
        ...values,
        latitude: coordinateText(point.lat),
        longitude: coordinateText(point.lng),
      };
      setValues(next);
      setErrors((current) => ({ ...current, latitude: undefined, longitude: undefined }));
    },
    setConsent: (isGiven) => {
      setValues({ ...values, consentGiven: isGiven });
    },
    setVisible: (isVisible) => {
      setValues({ ...values, visible: isVisible });
    },
  };
}

interface Saving {
  readonly isSaving: boolean;
  readonly hasPublishError: boolean;
  readonly notice: FormNotice | null;
  readonly submit: () => void;
  readonly clearOutcome: () => void;
}

interface Outcome {
  readonly cache: ResellersCache;
  readonly navigate: (path: string) => void;
  readonly setHasPublishError: (hasError: boolean) => void;
  readonly setNotice: (notice: FormNotice | null) => void;
}

/** What each end of a request does on screen. */
function applyResult(result: AdminResult<AdminReseller>, outcome: Outcome): void {
  const { cache, navigate } = outcome;
  if (result.kind === "ok") {
    // The list is read again: the order of the API (neighborhood, then name) is the truth.
    cache.invalidate();
    navigate(RESELLERS_PATH);
    return;
  }
  const view = describeFailure(result);
  if (view.isUnauthorized) {
    cache.invalidate();
    return;
  }
  outcome.setHasPublishError(view.hasPublishError);
  outcome.setNotice(view.notice);
  if (view.notice === "gone") {
    cache.invalidate();
  }
}

/** Shows what is wrong with the form and moves the focus to the first of it. */
function isFormRefused(fields: Fields, focusFirst: (errors: ResellerFormErrors) => void): boolean {
  const errors = validateResellerForm(fields.values);
  fields.setErrors(errors);
  const isRefused = RESELLER_FIELD_ORDER.some((field) => errors[field] !== undefined);
  if (isRefused) {
    focusFirst(errors);
  }
  return isRefused;
}

/** The creation or the change; null when there is nothing to send. */
function send(
  reseller: AdminReseller | null,
  values: ResellerFormValues,
): Promise<AdminResult<AdminReseller>> | null {
  if (reseller === null) {
    const body = buildCreateBody(values);
    return body === null ? null : postReseller(body);
  }
  const changes = buildUpdateBody(reseller, values);
  return changes === null ? null : patchReseller(reseller.id, changes);
}

/** Checks the form, sends it, and puts what comes back on screen. */
function useSaving(
  reseller: AdminReseller | null,
  fields: Fields,
  focusFirst: (errors: ResellerFormErrors) => void,
): Saving {
  const [isSaving, setIsSaving] = useState(false);
  const [hasPublishError, setHasPublishError] = useState(false);
  const [notice, setNotice] = useState<FormNotice | null>(null);
  const cache = useResellersCache();
  const [, navigate] = useLocation();

  const submit = (): void => {
    if (isSaving) {
      return;
    }
    setHasPublishError(false);
    setNotice(null);
    if (isFormRefused(fields, focusFirst)) {
      return;
    }
    const request = send(reseller, fields.values);
    if (request === null) {
      // Nothing changed: there is nothing to ask the server.
      navigate(RESELLERS_PATH);
      return;
    }
    setIsSaving(true);
    void request.then((result) => {
      setIsSaving(false);
      applyResult(result, { cache, navigate, setHasPublishError, setNotice });
    });
  };
  return {
    isSaving,
    hasPublishError,
    notice,
    submit,
    clearOutcome: () => {
      setHasPublishError(false);
    },
  };
}

/**
 * The state of the form of a reseller: the values, the errors (shown when a field is left and
 * when the form is sent) and the save. The server stays the authority.
 */
export function useResellerForm(reseller: AdminReseller | null): ResellerFormModel {
  const focus = useFieldFocus();
  const fields = useFields(reseller);
  const saving = useSaving(reseller, fields, focus.focusFirst);
  return {
    values: fields.values,
    errors: fields.errors,
    // How many fields are refused now: the summary follows the fields as they are fixed.
    refusedCount: RESELLER_FIELD_ORDER.filter((field) => fields.errors[field] !== undefined).length,
    isSaving: saving.isSaving,
    isPublishable: canPublish(fields.values),
    hasPublishError: saving.hasPublishError,
    notice: saving.notice,
    point: pointOf(fields.values),
    setText: fields.setText,
    blur: fields.blur,
    setPoint: fields.setPoint,
    setConsent: fields.setConsent,
    setVisible: (isVisible) => {
      saving.clearOutcome();
      fields.setVisible(isVisible);
    },
    submit: saving.submit,
    registerField: focus.register,
  };
}
