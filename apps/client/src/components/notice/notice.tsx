import type { ReactElement, ReactNode } from "react";

import { NoticeIcon } from "./notice-icons";
import styles from "./notice.module.css";

interface NoticeAction {
  readonly label: string;
  readonly onClick: () => void;
}

interface NoticeProps {
  readonly tone: "error" | "info";
  readonly children: ReactNode;
  readonly action?: NoticeAction;
}

const TONES = {
  error: { className: styles.error, role: "alert", icon: "circle-alert" },
  info: { className: styles.info, role: "note", icon: "info" },
} as const;

export function Notice({ tone, children, action }: NoticeProps): ReactElement {
  const { className, role, icon } = TONES[tone];
  return (
    <div className={[styles.notice, className].join(" ")} role={role}>
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
