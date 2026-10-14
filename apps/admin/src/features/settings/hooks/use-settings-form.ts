import type {
  DeliverySettings,
  DeliverySettingsField,
  UpdateDeliverySettingsRequest,
} from "@entana/contracts";
import { useState } from "react";

import type { AdminFailure } from "../../../data-fetching/fetch-admin";
import { patchSettings } from "../api/settings-calls";
import { formValuesOf, hasChanges, planSettingsPatch } from "../rules/settings-form";
import type { SettingsFormErrors, SettingsFormValues } from "../rules/settings-form";

import { useSettingsCache } from "./use-settings";

export type SettingsNotice = "saved" | "invalid" | "rateLimited" | "failed";

export interface SettingsFormModel {
  readonly values: SettingsFormValues;
  readonly errors: SettingsFormErrors;
  /** False while every field holds the saved value: there is nothing to save. */
  readonly isChanged: boolean;
  readonly isSaving: boolean;
  readonly notice: SettingsNotice | null;
  readonly setText: (field: DeliverySettingsField, text: string) => void;
  readonly submit: () => void;
}

/** The fields of one form only: each tab sends its own. */
function valuesOf(
  settings: DeliverySettings,
  fields: readonly DeliverySettingsField[],
): SettingsFormValues {
  const all = formValuesOf(settings);
  return Object.fromEntries(fields.map((field) => [field, all[field]]));
}

/** The notice of a refusal; null when the session ended (the next read shows the sign-in). */
function noticeOf(failure: AdminFailure): SettingsNotice | null {
  switch (failure.kind) {
    case "unauthorized":
      return null;
    case "invalid":
      return "invalid";
    case "rate_limited":
      return "rateLimited";
    case "not_found":
    case "conflict":
    case "failure":
      return "failed";
  }
}

interface Saving {
  readonly isSaving: boolean;
  readonly notice: SettingsNotice | null;
  readonly setNotice: (notice: SettingsNotice | null) => void;
  readonly send: (body: UpdateDeliverySettingsRequest) => void;
}

/** Sends a change and keeps the answer: the settings it returns become the saved ones. */
function useSaving(onSaved: (settings: DeliverySettings) => void): Saving {
  const cache = useSettingsCache();
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<SettingsNotice | null>(null);
  const send = (body: UpdateDeliverySettingsRequest): void => {
    setIsSaving(true);
    void patchSettings(body).then((result) => {
      setIsSaving(false);
      if (result.kind === "ok") {
        cache.replace(result.data);
        onSaved(result.data);
        setNotice("saved");
        return;
      }
      if (result.kind === "unauthorized") {
        cache.invalidate();
      }
      setNotice(noticeOf(result));
    });
  };
  return { isSaving, notice, setNotice, send };
}

/**
 * One form of the settings: the text of its fields, checked with the shared schema when it is
 * sent. Only the fields that changed are sent; the answer becomes the saved values.
 */
export function useSettingsForm(
  settings: DeliverySettings,
  fields: readonly DeliverySettingsField[],
): SettingsFormModel {
  const [values, setValues] = useState(() => valuesOf(settings, fields));
  const [errors, setErrors] = useState<SettingsFormErrors>({});
  const saving = useSaving((saved) => {
    setValues(valuesOf(saved, fields));
  });

  const setText = (field: DeliverySettingsField, text: string): void => {
    setValues({ ...values, [field]: text });
    saving.setNotice(null);
    if (errors[field] !== undefined) {
      // A shown error follows the typing, so that it goes away once the value is right.
      const plan = planSettingsPatch(settings, { [field]: text });
      setErrors({ ...errors, [field]: plan.kind === "invalid" ? plan.errors[field] : undefined });
    }
  };

  const submit = (): void => {
    const plan = planSettingsPatch(settings, values);
    if (saving.isSaving || plan.kind === "unchanged") {
      return;
    }
    saving.setNotice(null);
    setErrors(plan.kind === "invalid" ? plan.errors : {});
    if (plan.kind === "ready") {
      saving.send(plan.body);
    }
  };

  return {
    values,
    errors,
    isChanged: hasChanges(settings, values),
    isSaving: saving.isSaving,
    notice: saving.notice,
    setText,
    submit,
  };
}
