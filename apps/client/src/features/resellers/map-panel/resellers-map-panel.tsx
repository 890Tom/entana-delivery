import type { ReactElement, RefObject } from "react";

import { Notice } from "../../../components/notice/notice";
import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";

import styles from "./resellers-map-panel.module.css";

interface ResellersMapPanelProps {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly status: "loading" | "failed" | "ready";
  readonly onRetry: () => void;
}

/**
 * The box of the map: the library draws in it; a skeleton or a notice replaces it when needed.
 * The list is the accessible equivalent of the map, so a failed map leaves the screen usable.
 */
export function ResellersMapPanel({
  containerRef,
  status,
  onRetry,
}: ResellersMapPanelProps): ReactElement {
  return (
    <div
      className={styles.frame}
      role="group"
      aria-label={texts.resellers.map.label}
      aria-busy={status === "loading"}
    >
      <div ref={containerRef} className={styles.canvas} />
      {status === "loading" && (
        <div className={styles.skeleton}>
          <span className={visuallyHidden.visuallyHidden}>{texts.common.loading}</span>
        </div>
      )}
      {status === "failed" && (
        <div className={styles.fallback}>
          <Notice tone="error" action={{ label: texts.common.retry, onClick: onRetry }}>
            {texts.resellers.map.failed}
          </Notice>
        </div>
      )}
    </div>
  );
}
