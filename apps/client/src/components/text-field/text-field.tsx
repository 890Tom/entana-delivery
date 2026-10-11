import { useId } from "react";
import type { ChangeEvent, HTMLAttributes, ReactElement, Ref } from "react";

import { texts } from "../../i18n/texts";
import { NoticeIcon } from "../notice/notice-icons";

import styles from "./text-field.module.css";

/** What is shown before the typed text, inside the field: not typed, not focusable, but read. */
type FieldPrefix =
  { readonly status: "ready"; readonly text: string } | { readonly status: "loading" };

interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  /** The new text, and the event for a screen that needs the caret or the kind of edit. */
  readonly onChange: (
    value: string,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  /** The field is left. */
  readonly onBlur?: () => void;
  /** Muted help under the field; replaced by the error while there is one. */
  readonly hint?: string;
  /** What to do to fix the value: shown with an icon, never by colour alone. */
  readonly error?: string;
  readonly type?: "text" | "tel";
  readonly inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  readonly autoComplete?: string;
  readonly maxLength?: number;
  readonly placeholder?: string;
  /** For a code typed in capitals: the keyboard starts in capitals (the text itself is not changed). */
  readonly autoCapitalize?: "characters";
  /** False for a code or a name that a spell checker would underline for nothing. */
  readonly spellCheck?: boolean;
  /** Shows the text in capitals without changing it. */
  readonly isUppercase?: boolean;
  /** A mandatory field: announced as such (the visible label stays the plain name). */
  readonly isRequired?: boolean;
  /** A field that may stay empty: "(facultatif)" follows its label, in words. */
  readonly isOptional?: boolean;
  /** Three lines instead of one, resizable in height. */
  readonly isMultiline?: boolean;
  /** Single line only: the text the customer does not type, such as a country code. */
  readonly prefix?: FieldPrefix;
  /** The control, so that a screen can move the focus to it. */
  readonly ref?: Ref<HTMLElement>;
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

function Prefix({ prefix, id }: { prefix: FieldPrefix; id: string }): ReactElement {
  if (prefix.status === "loading") {
    // Decoration: the field is named by its label alone until the code is known.
    return <span className={styles.prefixPlaceholder} aria-hidden="true" />;
  }
  return (
    <span id={id} className={styles.prefix}>
      {prefix.text}
    </span>
  );
}

/** Gives the control to a ref object or a ref callback, whichever the screen passed. */
function assignRef(ref: Ref<HTMLElement> | undefined, element: HTMLElement | null): void {
  if (typeof ref === "function") {
    ref(element);
  } else if (ref !== undefined && ref !== null) {
    ref.current = element;
  }
}

interface ControlProps {
  readonly id: string;
  readonly value: string;
  readonly autoComplete: string | undefined;
  readonly maxLength: number | undefined;
  readonly placeholder: string | undefined;
  readonly autoCapitalize: "characters" | undefined;
  readonly spellCheck: boolean | undefined;
  readonly "aria-required": true | undefined;
  readonly "aria-invalid": true | undefined;
  readonly "aria-describedby": string | undefined;
  readonly onBlur: (() => void) | undefined;
  readonly ref: (element: HTMLElement | null) => void;
  readonly onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

interface ControlKind {
  readonly isMultiline: boolean;
  readonly prefix: FieldPrefix | undefined;
  readonly prefixId: string;
  readonly type: "text" | "tel";
  readonly inputMode: HTMLAttributes<HTMLInputElement>["inputMode"];
  readonly hasError: boolean;
  readonly isUppercase: boolean;
}

/** The single line, the three lines, or the single line framed with its prefix. */
function Control({ shared, kind }: { shared: ControlProps; kind: ControlKind }): ReactElement {
  const { isMultiline, prefix, prefixId, type, inputMode, hasError, isUppercase } = kind;
  const invalidClass = hasError ? styles.invalid : "";
  const caseClass = isUppercase ? styles.uppercase : "";
  if (isMultiline) {
    return (
      <textarea
        {...shared}
        rows={3}
        className={[styles.control, styles.multiline, invalidClass].join(" ")}
      />
    );
  }
  if (prefix === undefined) {
    return (
      <input
        {...shared}
        type={type}
        inputMode={inputMode}
        className={[styles.control, invalidClass, caseClass].join(" ")}
      />
    );
  }
  return (
    <div className={[styles.frame, invalidClass].join(" ")}>
      <Prefix prefix={prefix} id={prefixId} />
      <input
        {...shared}
        type={type}
        inputMode={inputMode}
        className={[styles.bare, caseClass].join(" ")}
      />
    </div>
  );
}

/** The ids that describe the control: a prefix that is shown, then the hint or the error. */
function describedByOf(parts: readonly (string | null)[]): string | undefined {
  const ids = parts.filter((part) => part !== null);
  return ids.length === 0 ? undefined : ids.join(" ");
}

function controlPropsOf(
  props: TextFieldProps,
  id: string,
  describedBy: string | undefined,
): ControlProps {
  return {
    id,
    value: props.value,
    autoComplete: props.autoComplete,
    maxLength: props.maxLength,
    placeholder: props.placeholder,
    autoCapitalize: props.autoCapitalize,
    spellCheck: props.spellCheck,
    "aria-required": props.isRequired === true ? true : undefined,
    "aria-invalid": props.error === undefined ? undefined : true,
    "aria-describedby": describedBy,
    onBlur: props.onBlur,
    ref: (element) => {
      assignRef(props.ref, element);
    },
    onChange: (event) => {
      props.onChange(event.target.value, event);
    },
  };
}

/**
 * The text field of the design system: label, control, then the hint or the error. The control
 * is a single line, or three resizable lines, and may start with a fixed prefix (inside the
 * border, read by assistive technology as part of the field's description).
 */
export function TextField(props: TextFieldProps): ReactElement {
  const id = useId();
  const messageId = `${id}-message`;
  const prefixId = `${id}-prefix`;
  const isMultiline = props.isMultiline === true;
  // A prefix goes with a single line only.
  const prefix = isMultiline ? undefined : props.prefix;
  const hasMessage = props.error !== undefined || props.hint !== undefined;
  const describedBy = describedByOf([
    prefix?.status === "ready" ? prefixId : null,
    hasMessage ? messageId : null,
  ]);
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {props.label}
        {props.isOptional === true && (
          <span className={styles.optional}> {texts.common.optional}</span>
        )}
      </label>
      <Control
        shared={controlPropsOf(props, id, describedBy)}
        kind={{
          isMultiline,
          prefix,
          prefixId,
          type: props.type ?? "text",
          inputMode: props.inputMode,
          hasError: props.error !== undefined,
          isUppercase: props.isUppercase === true,
        }}
      />
      <FieldMessage id={messageId} hint={props.hint} error={props.error} />
    </div>
  );
}
