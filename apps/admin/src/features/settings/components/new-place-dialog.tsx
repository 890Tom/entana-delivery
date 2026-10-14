import { PLACE_RADIUS_MAX_M, PLACE_RADIUS_MIN_M } from "@entana/contracts";
import { useEffect, useId, useRef } from "react";
import type { ReactElement, RefObject } from "react";

import { NoticeIcon } from "../../../components/notice/notice-icons";
import fieldStyles from "../../../components/text-field/text-field.module.css";
import { TextField } from "../../../components/text-field/text-field";
import { texts } from "../../../i18n/texts";
import { CatalogueIcon } from "../../catalogue/components/catalogue-icons";
import { FormButton } from "../../catalogue/components/form-buttons";
import { RADIUS_STEP_M, shownRadius } from "../rules/new-place";
import type { NewPlaceErrors, NewPlaceNameError } from "../rules/new-place";
import type { DraftChange, PlaceDraft } from "../rules/place-drawing";

import styles from "./place-drawing.module.css";

const t = texts.settings.axisEditor.newPlace;

const NAME_ERROR_TEXT: Readonly<Record<NewPlaceNameError, string>> = {
  empty: t.nameEmpty,
  tooLong: t.nameTooLong,
  taken: t.nameTaken,
};

interface RadiusFieldProps {
  readonly radiusText: string;
  readonly isInvalid: boolean;
  readonly onChange: (radiusText: string) => void;
}

interface RadiusInputsProps extends RadiusFieldProps {
  readonly id: string;
  readonly hintId: string;
  readonly messageId: string;
}

const RADIUS_BOUNDS = { min: PLACE_RADIUS_MIN_M, max: PLACE_RADIUS_MAX_M };

/** A slider by steps of 50 m and a field for any whole number of metres, on one line. */
function RadiusInputs(props: RadiusInputsProps): ReactElement {
  const { radiusText, isInvalid, onChange } = props;
  return (
    <div className={styles.radiusLine}>
      <input
        id={props.id}
        type="range"
        className={styles.slider}
        {...RADIUS_BOUNDS}
        step={RADIUS_STEP_M}
        value={shownRadius(radiusText)}
        aria-describedby={props.hintId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <input
        type="number"
        className={styles.radiusInput}
        {...RADIUS_BOUNDS}
        inputMode="numeric"
        value={radiusText}
        aria-label={t.radiusField}
        aria-invalid={isInvalid ? true : undefined}
        aria-describedby={isInvalid ? `${props.messageId} ${props.hintId}` : props.hintId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <span aria-hidden="true">{t.unit}</span>
    </div>
  );
}

function RadiusField(props: RadiusFieldProps): ReactElement {
  const id = useId();
  const messageId = `${id}-message`;
  const hintId = `${id}-hint`;
  return (
    <div className={styles.radius}>
      <label htmlFor={id} className={styles.radiusLabel}>
        {t.radius(shownRadius(props.radiusText))}
      </label>
      <RadiusInputs {...props} id={id} hintId={hintId} messageId={messageId} />
      {props.isInvalid && (
        <p id={messageId} className={fieldStyles.error}>
          <NoticeIcon name="circle-alert" />
          {t.radiusOutOfRange}
        </p>
      )}
      <p id={hintId} className={styles.muted}>
        {t.radiusHint}
      </p>
    </div>
  );
}

interface NewPlaceDialogProps {
  readonly draft: PlaceDraft;
  readonly errors: NewPlaceErrors;
  readonly onEdit: (change: DraftChange) => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** Focus on the name while the window is open, then back where it was. */
function useFocusWhileOpen(): RefObject<HTMLInputElement | null> {
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    nameRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus();
      }
    };
  }, []);
  return nameRef;
}

function DialogButtons({ onCancel }: { onCancel: () => void }): ReactElement {
  return (
    <div className={styles.buttons}>
      <FormButton
        type="submit"
        variant="primary"
        label={t.add}
        icon={<CatalogueIcon name="plus" size={20} />}
      />
      <FormButton variant="ghost" label={t.cancel} onClick={onCancel} />
    </div>
  );
}

/** The window « Nouveau lieu » over the map: Escape closes it (handled by the map card). */
export function NewPlaceDialog(props: NewPlaceDialogProps): ReactElement {
  const { draft, errors, onEdit } = props;
  const titleId = useId();
  const nameRef = useFocusWhileOpen();
  return (
    <form
      role="dialog"
      aria-labelledby={titleId}
      className={styles.dialog}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        props.onConfirm();
      }}
    >
      <h2 id={titleId} className={styles.dialogTitle}>
        {t.title}
      </h2>
      <TextField
        ref={nameRef}
        label={t.name}
        placeholder={t.namePlaceholder}
        value={draft.name}
        error={errors.name === undefined ? undefined : NAME_ERROR_TEXT[errors.name]}
        onChange={(name) => {
          onEdit({ name });
        }}
      />
      <RadiusField
        radiusText={draft.radiusText}
        isInvalid={errors.radius !== undefined}
        onChange={(radiusText) => {
          onEdit({ radiusText });
        }}
      />
      <DialogButtons onCancel={props.onCancel} />
    </form>
  );
}
