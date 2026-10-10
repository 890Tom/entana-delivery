import type { ReactElement, RefObject } from "react";

import { Icon } from "../../../components/icon/icon";
import { Notice } from "../../../components/notice/notice";
import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";

import styles from "./point-picker.module.css";

interface MapFrameProps {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly status: "loading" | "failed" | "ready";
  readonly onRetry: () => void;
}

/** The box of the map: the library draws in it; a skeleton or a notice replaces it when needed. */
export function MapFrame({ containerRef, status, onRetry }: MapFrameProps): ReactElement {
  return (
    <div
      className={styles.frame}
      role="group"
      aria-label={texts.delivery.map.label}
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
            {texts.delivery.map.failed}
          </Notice>
        </div>
      )}
      {status === "ready" && (
        <span className={styles.reticle} aria-hidden="true">
          <Icon name="crosshair" />
        </span>
      )}
    </div>
  );
}
