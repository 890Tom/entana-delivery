import type { ReactElement, ReactNode, Ref } from "react";

import { NoticeIcon } from "./notice-icons";
import styles from "./notice.module.css";

interface NoticeProps {
  readonly tone: "error" | "info";
  readonly children: ReactNode;
  /** A button that does something here (for example "Réessayer"). */
  readonly action?: { readonly label: string; readonly onClick: () => void };
  /** Makes the notice a place that a script can move the focus to (not a stop of the Tab key). */
  readonly ref?: Ref<HTMLDivElement>;
  readonly tabIndex?: -1;
}

const TONES = {
  error: { className: styles.error, role: "alert", icon: "circle-alert" },
  info: { className: styles.info, role: "note", icon: "info" },
} as const;

/** The message block of the design system: an icon and a message, whatever the colour. */
export function Notice({ tone, children, action, ref, tabIndex }: NoticeProps): ReactElement {
  const { className, role, icon } = TONES[tone];
  return (
    <div ref={ref} tabIndex={tabIndex} className={[styles.notice, className].join(" ")} role={role}>
      <NoticeIcon name={icon} />
      <p className={styles.text}>{children}</p>
      {action !== undefined && (
        <button type="button" className={styles.action} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
