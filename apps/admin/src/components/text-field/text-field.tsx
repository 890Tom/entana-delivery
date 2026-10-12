import { useId } from "react";
import type { ReactElement, Ref } from "react";

import { NoticeIcon } from "../notice/notice-icons";

import styles from "./text-field.module.css";

/** A button inside the field, after the control: the show / hide of a password. */
interface FieldAction {
  readonly label: string;
  readonly isPressed: boolean;
  readonly onClick: () => void;
}

interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** What to do to fix the value: shown with an icon, never by colour alone. */
  readonly error?: string;
  /** Error border and `aria-invalid` with no message of its own (the notice above says it). */
  readonly isInvalid?: boolean;
  readonly type?: "text" | "email" | "password";
  readonly autoComplete?: string;
  readonly action?: FieldAction;
  /** The control, so that a screen can move the focus to it. */
  readonly ref?: Ref<HTMLInputElement>;
}

function ActionButton({
  action,
  controlId,
}: {
  action: FieldAction;
  controlId: string;
}): ReactElement {
  return (
    <button
      type="button"
      className={styles.action}
      aria-pressed={action.isPressed}
      aria-controls={controlId}
      onClick={action.onClick}
    >
      {action.label}
    </button>
  );
}

function FieldLabel({ id, children }: { id: string; children: string }): ReactElement {
  return (
    <label htmlFor={id} className={styles.label}>
      {children}
    </label>
  );
}

function FieldError({ id, message }: { id: string; message: string }): ReactElement {
  return (
    <p id={id} className={styles.error}>
      <NoticeIcon name="circle-alert" />
      {message}
    </p>
  );
}

/**
 * The single-line text field of the design system: label, control (with an optional action in
 * the border), then the error. Autocapitalisation and spell checking are off: the field holds
 * an identifier or a password, never prose.
 */
export function TextField({
  label,
  value,
  onChange,
  error,
  isInvalid = false,
  type = "text",
  autoComplete,
  action,
  ref,
}: TextFieldProps): ReactElement {
  const id = useId();
  const messageId = `${id}-message`;
  const hasError = error !== undefined || isInvalid;
  return (
    <div className={styles.field}>
      <FieldLabel id={id}>{label}</FieldLabel>
      <div className={[styles.frame, hasError ? styles.invalid : ""].join(" ")}>
        <input
          ref={ref}
          id={id}
          className={styles.control}
          type={type}
          value={value}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={error === undefined ? undefined : messageId}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
        {action !== undefined && <ActionButton action={action} controlId={id} />}
      </div>
      {error !== undefined && <FieldError id={messageId} message={error} />}
    </div>
  );
}
