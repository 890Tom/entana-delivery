import type { ReactElement } from "react";

import { Notice } from "../../../components/notice/notice";
import { TextField } from "../../../components/text-field/text-field";
import { texts } from "../../../i18n/texts";
import { MAX_PHONE_INPUT_LENGTH } from "../rules/phone-number";

import type { ContactFormState } from "./use-contact-form";

/**
 * The phone number: the national part is typed, the country code of the instance is shown before
 * it. Without the code there is no field to fill: a loading slot, then a notice that can retry.
 * The code is never guessed.
 */
export function PhoneField({ form }: { form: ContactFormState }): ReactElement {
  if (form.isConfigurationFailed) {
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
  return (
    <TextField
      ref={form.phoneRef}
      label={texts.contact.phone.label}
      hint={texts.contact.phone.hint}
      error={form.isPhoneInvalid ? texts.contact.phone.error : undefined}
      placeholder={texts.contact.phone.placeholder}
      prefix={
        form.countryCode === undefined
          ? { status: "loading" }
          : { status: "ready", text: texts.contact.phone.prefix(form.countryCode) }
      }
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      maxLength={MAX_PHONE_INPUT_LENGTH}
      value={form.phone}
      onChange={form.setPhone}
      isRequired
    />
  );
}
