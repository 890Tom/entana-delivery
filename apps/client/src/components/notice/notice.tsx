import type { ReactElement, ReactNode, Ref } from "react";
import { Link } from "wouter";

import { NoticeIcon } from "./notice-icons";
import styles from "./notice.module.css";

/** A button that does something here, or a link to another screen (a fixed address). */
type NoticeAction =
  | { readonly label: string; readonly onClick: () => void }
  | { readonly label: string; readonly href: string };

interface NoticeProps {
  readonly tone: "error" | "info";
  readonly children: ReactNode;
  readonly action?: NoticeAction;
  /** False when another notice on the page already announces the same thing (no live role). */
  readonly isAnnounced?: boolean;
  /** Makes the notice a place that a script can move the focus to (not a stop of the Tab key). */
  readonly ref?: Ref<HTMLDivElement>;
  readonly tabIndex?: -1;
}

const TONES = {
  error: { className: styles.error, role: "alert", icon: "circle-alert" },
  info: { className: styles.info, role: "note", icon: "info" },
} as const;

function NoticeActionControl({ action }: { action: NoticeAction }): ReactElement {
  if ("href" in action) {
    return (
      <Link href={action.href} className={styles.action}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" className={styles.action} onClick={action.onClick}>
      {action.label}
    </button>
  );
}

export function Notice({
  tone,
  children,
  action,
  isAnnounced = true,
  ref,
  tabIndex,
}: NoticeProps): ReactElement {
  const { className, role, icon } = TONES[tone];
  return (
    <div
      ref={ref}
      tabIndex={tabIndex}
      className={[styles.notice, className].join(" ")}
      role={isAnnounced ? role : undefined}
    >
      <NoticeIcon name={icon} />
      <p className={styles.text}>{children}</p>
      {action !== undefined && <NoticeActionControl action={action} />}
    </div>
  );
}
