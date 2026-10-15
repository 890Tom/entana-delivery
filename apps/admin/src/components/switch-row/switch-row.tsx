import { useId } from "react";
import type { ReactElement } from "react";

import { NoticeIcon } from "../notice/notice-icons";
import { Switch } from "../switch/switch";
import { texts } from "../../i18n/texts";

import { CatalogueIcon } from "../catalogue-icons/catalogue-icons";
import styles from "./switch-row.module.css";

interface SwitchRowProps {
  readonly label: string;
  /** The help under the label; null when the state needs none. */
  readonly help: string | null;
  /** A refusal, shown instead of the help. */
  readonly error?: string | undefined;
  readonly isOn: boolean;
  /** The switch cannot be turned on yet: it shows a lock beside its word. */
  readonly isLocked?: boolean;
  readonly isDisabled: boolean;
  readonly onToggle: () => void;
}

/** A line of the form: the label and its help, then the switch and its word (Oui or Non). */
export function SwitchRow({
  label,
  help,
  error,
  isOn,
  isLocked = false,
  isDisabled,
  onToggle,
}: SwitchRowProps): ReactElement {
  const helpId = useId();
  const message = error ?? help;
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <span className={styles.label}>{label}</span>
        {message !== null && (
          <p id={helpId} className={error === undefined ? styles.help : styles.error}>
            {error !== undefined && <NoticeIcon name="circle-alert" />}
            {message}
          </p>
        )}
      </div>
      <div className={styles.control}>
        <Switch
          label={label}
          isOn={isOn}
          isDisabled={isDisabled || isLocked}
          describedBy={message === null ? undefined : helpId}
          onToggle={onToggle}
        />
        <span className={styles.word}>
          {isLocked && <CatalogueIcon name="lock" size={18} />}
          {isOn ? texts.catalogueForm.switches.yes : texts.catalogueForm.switches.no}
        </span>
      </div>
    </div>
  );
}
