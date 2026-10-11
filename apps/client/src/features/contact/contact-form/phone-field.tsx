import { formatNationalNumber, operatorPrefixes } from "@entana/contracts";
import { useLayoutEffect, useState } from "react";
import type { ChangeEvent, ReactElement, RefObject } from "react";

import { Notice } from "../../../components/notice/notice";
import { TextField } from "../../../components/text-field/text-field";
import { texts } from "../../../i18n/texts";
import { caretAfterDigits, readPhoneEdit } from "../rules/phone-input";
import type { PhoneIssue } from "../rules/phone-input";

import type { ContactFormState } from "./use-contact-form";

/** What the field needs of a form: the contact form and the order lookup both provide it. */
export type PhoneFieldState = Pick<
  ContactFormState,
  | "phone"
  | "setPhone"
  | "countryCode"
  | "phoneRef"
  | "noticeRef"
  | "isConfigurationFailed"
  | "retryConfiguration"
  | "isPhoneInvalid"
  | "phoneIssue"
  | "onPhoneBlur"
>;

// What is kept of a text typed before the country code is known: the same bound as the contract's.
const MAX_UNPARSED_LENGTH = 64;

/** Puts the caret after the given place once the field shows its new text. */
function useCaretRequest(ref: RefObject<HTMLElement | null>): (position: number) => void {
  // A new object for each request, so that the caret is placed again even if the text is not new.
  const [request, setRequest] = useState<{ readonly position: number } | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (request !== null && element instanceof HTMLInputElement) {
      element.setSelectionRange(request.position, request.position);
    }
  }, [request, ref]);
  return (position) => {
    setRequest({ position });
  };
}

function errorText(issue: PhoneIssue, countryCode: string | undefined): string {
  const { errors } = texts.contact.phone;
  if (issue === "missing_digits") {
    return errors.missingDigits;
  }
  if (issue === "invalid_prefix" && countryCode !== undefined) {
    return errors.invalidPrefix(operatorPrefixes(countryCode));
  }
  return errors.invalid;
}

function inputTypeOf(
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
): string | undefined {
  return event.nativeEvent instanceof InputEvent ? event.nativeEvent.inputType : undefined;
}

type ChangeHandler = (
  raw: string,
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
) => void;

/**
 * Any edit (typing, paste, autofill, deletion) ends here: the field holds only digits and the
 * spaces of the grouping, and the caret stays after the same digit.
 */
function usePhoneChange(form: PhoneFieldState): ChangeHandler {
  const requestCaret = useCaretRequest(form.phoneRef);
  const { countryCode } = form;
  return (raw, event) => {
    if (countryCode === undefined) {
      form.setPhone(raw.slice(0, MAX_UNPARSED_LENGTH));
      return;
    }
    const edit = readPhoneEdit({
      raw,
      caret: event.target.selectionStart ?? raw.length,
      previousDisplay: form.phone,
      inputType: inputTypeOf(event),
      countryCode,
    });
    const display = formatNationalNumber(edit.digits, countryCode);
    form.setPhone(display);
    requestCaret(caretAfterDigits(display, edit.caretDigits));
  };
}

interface PhoneFieldProps {
  readonly form: PhoneFieldState;
  /** Help under the field: each screen says its own, or nothing. */
  readonly hint?: string;
  readonly placeholder?: string;
  /** A refusal that comes from elsewhere (the server) and replaces the one of the local check. */
  readonly error?: string;
}

function ConfigurationNotice({ form }: { form: PhoneFieldState }): ReactElement {
  return (
    <Notice
      tone="error"
      ref={form.noticeRef}
      tabIndex={-1}
      action={{ label: texts.common.retry, onClick: form.retryConfiguration }}
    >
      {texts.contact.phone.configurationError}
    </Notice>
  );
}

/**
 * The phone number: the national part is typed and always shown grouped, the country code of the
 * instance is shown before it. Without the code there is no rule to apply: a loading slot, then a
 * notice that can retry. The code is never guessed.
 */
export function PhoneField({ form, hint, placeholder, error }: PhoneFieldProps): ReactElement {
  const handleChange = usePhoneChange(form);
  const { countryCode } = form;
  if (form.isConfigurationFailed) {
    return <ConfigurationNotice form={form} />;
  }
  const shownIssue = form.isPhoneInvalid ? form.phoneIssue : null;
  return (
    <TextField
      ref={form.phoneRef}
      label={texts.contact.phone.label}
      hint={hint}
      error={shownIssue === null ? error : errorText(shownIssue, countryCode)}
      placeholder={placeholder}
      prefix={
        countryCode === undefined
          ? { status: "loading" }
          : { status: "ready", text: texts.contact.phone.prefix(countryCode) }
      }
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      value={form.phone}
      onChange={handleChange}
      onBlur={form.onPhoneBlur}
      isRequired
    />
  );
}
