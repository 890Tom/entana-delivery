import { useEffect, useRef, useState } from "react";
import type { PublicInstance } from "@entana/contracts";
import type { GeoPoint } from "@entana/contracts";
import type { ReactElement, ReactNode, RefObject } from "react";

import { Notice } from "../../../components/notice/notice";
import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";
import { useInstance } from "../../instance/hooks/use-instance";
import styles from "../../../map/position-map.module.css";
import { loadAxisEditorMap } from "../map/axis-editor-map-adapter";
import type { AxisEditorMapHandle } from "../map/axis-editor-map-adapter";
import type { AxisDrawing } from "../rules/axis-editor-drawing";

const t = texts.settings.axisEditor.map;

type MapStatus = "loading" | "ready" | "failed";

interface Sinks {
  readonly handleRef: RefObject<AxisEditorMapHandle | null>;
  readonly latest: RefObject<AxisDrawing>;
  /** The screen's latest handler of a click: the map is created once, the handler changes. */
  readonly pick: RefObject<(point: GeoPoint) => void>;
  readonly setStatus: (status: MapStatus) => void;
}

/** Starts a load; the function it returns cancels it and removes the map that it produced. */
function startLoad(container: HTMLElement, map: PublicInstance["map"], sinks: Sinks): () => void {
  const { handleRef, latest, pick, setStatus } = sinks;
  let isCancelled = false;
  const onPick = (point: GeoPoint): void => {
    pick.current(point);
  };
  loadAxisEditorMap({ container, ...map, drawing: latest.current, onPick }).then(
    (handle) => {
      if (isCancelled) {
        handle.destroy();
        return;
      }
      handleRef.current = handle;
      // The axis may have changed while the library was loading.
      handle.setDrawing(latest.current);
      setStatus("ready");
    },
    () => {
      if (!isCancelled) {
        setStatus("failed");
      }
    },
  );
  return () => {
    isCancelled = true;
    handleRef.current?.destroy();
    handleRef.current = null;
  };
}

/** The map is created once for a style; the axis then goes through the handle. */
function useAxisEditorMap(
  drawing: AxisDrawing,
  onPick: (point: GeoPoint) => void,
): {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly status: MapStatus;
  readonly retry: () => void;
} {
  const instance = useInstance();
  const map = instance.data?.map;
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<AxisEditorMapHandle | null>(null);
  const latest = useRef(drawing);
  const pick = useRef(onPick);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    latest.current = drawing;
    handleRef.current?.setDrawing(drawing);
  }, [drawing]);
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);
  useEffect(() => {
    const container = containerRef.current;
    if (map === undefined || container === null) {
      return undefined;
    }
    return startLoad(container, map, { handleRef, latest, pick, setStatus });
  }, [map, attempt]);
  return {
    containerRef,
    status: instance.isError ? "failed" : status,
    retry: () => {
      setStatus("loading");
      setAttempt((current) => current + 1);
    },
  };
}

interface AxisEditorMapProps {
  readonly drawing: AxisDrawing;
  readonly onPick: (point: GeoPoint) => void;
  /** The tools and the window shown over the map. */
  readonly children?: ReactNode;
}

/** The axis being edited on the shop's map, drawn again as it changes. Loaded on demand. */
export function AxisEditorMap({ drawing, onPick, children }: AxisEditorMapProps): ReactElement {
  const { containerRef, status, retry } = useAxisEditorMap(drawing, onPick);
  return (
    <div
      className={styles.frame}
      role="group"
      aria-label={t.label}
      aria-busy={status === "loading"}
    >
      <div ref={containerRef} className={styles.canvas} />
      {status === "ready" && children}
      {status === "loading" && (
        <div className={styles.skeleton}>
          <span className={visuallyHidden.visuallyHidden}>{texts.common.loading}</span>
        </div>
      )}
      {status === "failed" && (
        <div className={styles.fallback}>
          <Notice tone="error" action={{ label: texts.common.retry, onClick: retry }}>
            {texts.settings.map.failed}
          </Notice>
        </div>
      )}
    </div>
  );
}
