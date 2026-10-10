import { MAX_CONTACT_NAME_LENGTH, MAX_CUSTOMER_NOTE_LENGTH } from "@entana/contracts";
import type { ReactElement, SubmitEvent } from "react";

import { TextField } from "../../../components/text-field/text-field";
import { texts } from "../../../i18n/texts";

import styles from "./contact-form.module.css";
import { PhoneField } from "./phone-field";
import type { ContactFormState } from "./use-contact-form";

interface ContactFormProps {
  readonly id: string;
  readonly form: ContactFormState;
}

/**
 * The three fields. The buttons that submit it are elsewhere (the fixed bar, the side card) and
 * name it by its `id`. Not validated by the browser (`noValidate`): the errors are the design
 * system's own.
 */
export function ContactForm({ id, form }: ContactFormProps): ReactElement {
  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    form.submit();
  };
  return (
    <form id={id} noValidate className={styles.form} onSubmit={handleSubmit}>
      <TextField
        ref={form.nameRef}
        label={texts.contact.name.label}
        error={form.isNameInvalid ? texts.contact.name.error : undefined}
        autoComplete="name"
        maxLength={MAX_CONTACT_NAME_LENGTH}
        value={form.name}
        onChange={form.setName}
        isRequired
      />
      <PhoneField form={form} />
      <TextField
        ref={form.noteRef}
        label={texts.contact.note.label}
        error={form.isNoteInvalid ? texts.contact.note.error : undefined}
        placeholder={texts.contact.note.placeholder}
        autoComplete="off"
        maxLength={MAX_CUSTOMER_NOTE_LENGTH}
        value={form.note}
        onChange={form.setNote}
        isOptional
        isMultiline
      />
    </form>
  );
}
