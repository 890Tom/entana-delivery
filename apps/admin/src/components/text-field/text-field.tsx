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
  /** A help under the field, tied to it by `aria-describedby`. */
  readonly hint?: string;
  /** What follows the label in the regular weight, such as "(facultatif)". */
  readonly labelSuffix?: string;
  readonly placeholder?: string;
  readonly inputMode?: "numeric" | "text";
  readonly maxLength?: number;
  /** Several lines of prose (a message to customers): spell checking is then on. */
  readonly isMultiline?: boolean;
  /** "short" for a number of a few digits; the label and the hint keep the full width. */
  readonly width?: "full" | "short";
  readonly onBlur?: () => void;
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

function FieldLabel({
  id,
  suffix,
  children,
}: {
  id: string;
  suffix: string | undefined;
  children: string;
}): ReactElement {
  return (
    <label htmlFor={id} className={styles.label}>
      {children}
      {suffix !== undefined && <span className={styles.suffix}> {suffix}</span>}
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

interface ControlProps {
  readonly id: string;
  readonly props: Omit<TextFieldProps, "label" | "error" | "hint" | "labelSuffix">;
  readonly hasError: boolean;
  readonly describedBy: string | undefined;
}

/** A text area for prose: capitalised and spell checked, unlike an identifier. */
function MultilineControl({ id, props, hasError, describedBy }: ControlProps): ReactElement {
  const { value, onChange } = props;
  return (
    <textarea
      id={id}
      className={styles.control}
      rows={3}
      value={value}
      placeholder={props.placeholder}
      maxLength={props.maxLength}
      aria-invalid={hasError ? true : undefined}
      aria-describedby={describedBy}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      onBlur={props.onBlur}
    />
  );
}

/** A single line: an identifier, a number or a password, never prose. */
function SingleLineControl({ id, props, hasError, describedBy }: ControlProps): ReactElement {
  const { value, onChange, type = "text" } = props;
  return (
    <input
      ref={props.ref}
      id={id}
      className={styles.control}
      type={type}
      value={value}
      autoComplete={props.autoComplete}
      autoCapitalize="none"
      spellCheck={false}
      placeholder={props.placeholder}
      inputMode={props.inputMode}
      maxLength={props.maxLength}
      aria-invalid={hasError ? true : undefined}
      aria-describedby={describedBy}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      onBlur={props.onBlur}
    />
  );
}

/** The frame with the control and, in the border, the action of the field. */
function FieldControl(control: ControlProps): ReactElement {
  const { action, isMultiline = false, width = "full" } = control.props;
  const frameClasses = [
    styles.frame,
    isMultiline ? styles.multiline : "",
    width === "short" ? styles.short : "",
    control.hasError ? styles.invalid : "",
  ];
  return (
    <div className={frameClasses.join(" ")}>
      {isMultiline ? <MultilineControl {...control} /> : <SingleLineControl {...control} />}
      {action !== undefined && <ActionButton action={action} controlId={control.id} />}
    </div>
  );
}

/**
 * The text field of the design system: label, control (with an optional action in the border),
 * then the error and the hint. On a single line, autocapitalisation and spell checking are off:
 * the field holds an identifier, a number or a password, never prose.
 */
export function TextField({
  label,
  error,
  hint,
  labelSuffix,
  isInvalid = false,
  ...props
}: TextFieldProps): ReactElement {
  const id = useId();
  const messageId = `${id}-message`;
  const hintId = `${id}-hint`;
  const describedBy = [error === undefined ? "" : messageId, hint === undefined ? "" : hintId]
    .filter((part) => part !== "")
    .join(" ");
  return (
    <div className={styles.field}>
      <FieldLabel id={id} suffix={labelSuffix}>
        {label}
      </FieldLabel>
      <FieldControl
        id={id}
        props={props}
        hasError={error !== undefined || isInvalid}
        describedBy={describedBy === "" ? undefined : describedBy}
      />
      {error !== undefined && <FieldError id={messageId} message={error} />}
      {hint !== undefined && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}
