import { useId } from "react";
import type { HTMLAttributes, ReactElement, Ref } from "react";

import { NoticeIcon } from "../notice/notice-icons";

import styles from "./text-field.module.css";

interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Muted help under the field; replaced by the error while there is one. */
  readonly hint?: string;
  /** What to do to fix the value: shown with an icon, never by colour alone. */
  readonly error?: string;
  readonly inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  readonly autoComplete?: string;
  readonly maxLength?: number;
  /** A mandatory field: announced as such (the visible label stays the plain name). */
  readonly isRequired?: boolean;
  readonly ref?: Ref<HTMLInputElement>;
}

function FieldMessage({
  id,
  hint,
  error,
}: {
  id: string;
  hint: string | undefined;
  error: string | undefined;
}): ReactElement | null {
  if (error !== undefined) {
    return (
      <p id={id} className={styles.error}>
        <NoticeIcon name="circle-alert" />
        {error}
      </p>
    );
  }
  return hint === undefined ? null : (
    <p id={id} className={styles.hint}>
      {hint}
    </p>
  );
}

/** The single-line text field of the design system: label, control, then the hint or the error. */
export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  inputMode,
  autoComplete,
  maxLength,
  isRequired = false,
  ref,
}: TextFieldProps): ReactElement {
  const id = useId();
  const messageId = `${id}-message`;
  const hasError = error !== undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        type="text"
        className={[styles.control, hasError ? styles.invalid : ""].join(" ")}
        value={value}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        aria-required={isRequired ? true : undefined}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={hasError || hint !== undefined ? messageId : undefined}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <FieldMessage id={messageId} hint={hint} error={error} />
    </div>
  );
}
