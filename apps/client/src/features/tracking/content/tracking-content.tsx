import type { TrackingResponse } from "@entana/contracts";
import { useEffect, useRef, useState } from "react";
import type { ReactElement, RefObject } from "react";

import { Notice } from "../../../components/notice/notice";
import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";
import { useInstance } from "../../instance/use-instance";
import { useCancelFlow } from "../api/use-cancel-flow";
import type { CancelFlow } from "../api/use-cancel-flow";
import { describeTrackingActions } from "../rules/describe-tracking-actions";
import { describeTrackingStatus } from "../rules/describe-tracking-status";
import type { DeliveryDay, StatusView } from "../rules/describe-tracking-status";
import { formatDeliveryDate, formatDeliveryDateTitle } from "../rules/format-delivery-date";

import { LinkActions } from "./link-actions";
import { OrderCodeBlock } from "./order-code-block";
import { OrderDetailsCard } from "./order-details-card";
import { OrderTimeline } from "./order-timeline";
import { TrackingActions } from "./tracking-actions";
import styles from "./tracking-content.module.css";

const CANONICAL_PHONE = /^\+\d{6,15}$/;

function toDeliveryDay(date: string | null): DeliveryDay | null {
  return date === null
    ? null
    : { sentence: formatDeliveryDate(date), title: formatDeliveryDateTitle(date) };
}

/** The shop's number is published by the server: only a canonical one goes into a `tel:` link. */
function toDialablePhone(phone: string | null | undefined): string | null {
  return phone !== null && phone !== undefined && CANONICAL_PHONE.test(phone) ? phone : null;
}

/**
 * A change of status is announced, and only a change: not the first reading, and not each
 * refresh. The previous status is kept in the state, compared while rendering.
 */
function StatusAnnouncer({ status, heading }: { status: string; heading: string }): ReactElement {
  const [seen, setSeen] = useState({ status, announcement: "" });
  if (seen.status !== status) {
    setSeen({ status, announcement: heading });
  }
  return (
    <p aria-live="polite" className={visuallyHidden.visuallyHidden}>
      {seen.announcement}
    </p>
  );
}

/** The title of a phone and of the web layout, and what an order that ended says. */
function StatusHead({
  status,
  reason,
  headRef,
}: {
  status: StatusView;
  reason: string | null;
  headRef: RefObject<HTMLDivElement | null>;
}): ReactElement {
  const { tracking } = texts;
  return (
    <div ref={headRef} className={styles.head}>
      <h1 tabIndex={-1} className={[styles.title, styles.narrowOnly].join(" ")}>
        {status.heading}
      </h1>
      <p className={[styles.line, styles.narrowOnly].join(" ")}>{status.line}</p>
      <h1 tabIndex={-1} className={[styles.title, styles.wideOnly].join(" ")}>
        {tracking.headingWide}
      </h1>
      {status.steps === null && (
        <div className={styles.wideOnly}>
          <h2 className={styles.title}>{status.heading}</h2>
          <p className={styles.line}>{status.line}</p>
        </div>
      )}
      {status.hasReason && reason !== null && (
        // The reason is the shop's own text: shown as text, long lines and breaks included.
        <p className={styles.reason}>{tracking.rejected.reason(reason)}</p>
      )}
    </div>
  );
}

interface FailureNoticesProps {
  readonly isStale: boolean;
  readonly onRetry: () => void;
  readonly cancel: CancelFlow;
}

/** What went wrong without making the order unreadable: a stale view, a refused cancellation. */
function FailureNotices({ isStale, onRetry, cancel }: FailureNoticesProps): ReactElement | null {
  const { cancelErrors, refreshFailed } = texts.tracking;
  if (!isStale && cancel.failure === null) {
    return null;
  }
  return (
    <div className={styles.notices}>
      {isStale && (
        <Notice tone="error" action={{ label: texts.common.retry, onClick: onRetry }}>
          {refreshFailed}
        </Notice>
      )}
      {cancel.failure !== null && (
        <Notice
          tone="error"
          // A refused cancellation is final: only a failure of the network is tried again.
          action={
            cancel.failure === "failed"
              ? { label: texts.common.retry, onClick: cancel.confirm }
              : undefined
          }
        >
          {cancelErrors[cancel.failure]}
        </Notice>
      )}
    </div>
  );
}

/** The title shown at this width: the other one is `display: none` and cannot take the focus. */
function focusVisibleTitle(head: HTMLElement | null): void {
  const titles = head?.querySelectorAll("h1") ?? [];
  [...titles].find((title) => getComputedStyle(title).display !== "none")?.focus();
}

/**
 * The cancel button is gone once the order is cancelled: the focus goes to the new status, after
 * the view that says it has been rendered.
 */
function useFocusTitleWhenCancelled(
  isDone: boolean,
  status: string,
  headRef: RefObject<HTMLElement | null>,
): void {
  const isCancelled = isDone && status === "CANCELLED";
  useEffect(() => {
    if (isCancelled) {
      focusVisibleTitle(headRef.current);
    }
  }, [isCancelled, headRef]);
}

interface TrackingContentProps {
  readonly view: TrackingResponse;
  readonly token: string;
  /** True when the last refresh failed: the view shown is the last one that was read. */
  readonly isStale: boolean;
  readonly onRetry: () => void;
}

/**
 * The order as the server last said it. The reading order of the document is the one of the
 * keyboard: the title, the steps, the code, then the card and its actions. The grid makes the
 * look of each width.
 */
export function TrackingContent({
  view,
  token,
  isStale,
  onRetry,
}: TrackingContentProps): ReactElement {
  const instance = useInstance();
  const headRef = useRef<HTMLDivElement>(null);
  const cancel = useCancelFlow(token);
  useFocusTitleWhenCancelled(cancel.isDone, view.status, headRef);
  const status = describeTrackingStatus(view.status, toDeliveryDay(view.deliveryDate));
  const phone = toDialablePhone(instance.data?.contactPhone);
  const available = describeTrackingActions(view.status, view.canCancel, phone !== null);
  return (
    <div className={styles.grid}>
      <StatusHead status={status} reason={view.rejectionReason} headRef={headRef} />
      <FailureNotices isStale={isStale} onRetry={onRetry} cancel={cancel} />
      {status.steps !== null && (
        <div className={styles.steps}>
          <OrderTimeline steps={status.steps} />
        </div>
      )}
      <div className={styles.code}>
        <OrderCodeBlock code={view.orderCode} shopName={instance.data?.name ?? null} />
      </div>
      <div className={styles.side}>
        <OrderDetailsCard
          day={status.card}
          landmark={view.landmarkText}
          itemCount={view.itemCount}
          totalAr={view.totalAr}
        >
          <TrackingActions phone={phone} available={available} cancel={cancel} />
        </OrderDetailsCard>
        <LinkActions token={token} />
      </div>
      <StatusAnnouncer status={view.status} heading={status.heading} />
    </div>
  );
}
