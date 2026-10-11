import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";

import { Notice } from "../../components/notice/notice";
import visuallyHidden from "../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../i18n/texts";
import { useDocumentTitle } from "../../layout/document-title/use-document-title";
import {
  dismissOrderSubmission,
  getOrderSubmissionState,
} from "../order-submission/order-submission";
import {
  addConfirmedOrder,
  removeConfirmedOrder,
} from "../order-submission/storage/confirmed-orders-storage";

import { TrackingNotFoundError } from "./api/request-tracking";
import { useTracking } from "./api/use-tracking";
import { TrackingContent } from "./content/tracking-content";
import styles from "./tracking-screen.module.css";
import { useDisplayedOrder } from "./use-displayed-order";
import type { DisplayedOrder } from "./use-displayed-order";

type TokenOrder = Exclude<DisplayedOrder, { origin: "invalid" }>;
import { useNoIndex } from "./use-no-index";

/**
 * The thanks after a send, once: it is decided when the screen opens, from the state of the
 * sending layer, which is then dismissed. A reload or a later visit finds it idle.
 */
function useThanksOnce(): boolean {
  const [isThanked] = useState(() => getOrderSubmissionState().status === "confirmed");
  useEffect(() => {
    if (isThanked) {
      dismissOrderSubmission();
    }
  }, [isThanked]);
  return isThanked;
}

function Skeleton(): ReactElement {
  return (
    <div aria-busy="true" className={styles.skeleton}>
      <span className={visuallyHidden.visuallyHidden}>{texts.common.loading}</span>
      <div aria-hidden="true" className={styles.skeleton}>
        <div className={styles.blockTitle} />
        <div className={styles.block} />
        <div className={styles.blockTall} />
      </div>
    </div>
  );
}

function Message({ title, line }: { title: string; line?: string }): ReactElement {
  return (
    <div className={styles.message}>
      <h1 className={styles.messageTitle}>{title}</h1>
      {line !== undefined && <p className={styles.messageLine}>{line}</p>}
      <Link href="/" className={styles.link}>
        {texts.tracking.viewCatalogue}
      </Link>
    </div>
  );
}

/** What is known of the order: reading, the last view, a failure, or an order that is gone. */
function Order({ order }: { order: TokenOrder }): ReactElement {
  const query = useTracking(order.token);
  const { data, error } = query;
  const isGone = error instanceof TrackingNotFoundError;
  // A token the server does not know is forgotten, even when it came from the device's own list.
  useEffect(() => {
    if (isGone) {
      removeConfirmedOrder(order.token);
    }
  }, [isGone, order.token]);
  // A token of a link is remembered once the server has confirmed the order.
  const isRemembered = useRef(false);
  useEffect(() => {
    if (order.origin === "fragment" && data !== undefined && !isRemembered.current) {
      isRemembered.current = true;
      addConfirmedOrder(
        { code: data.orderCode, token: order.token, createdAt: data.createdAt },
        Date.now(),
      );
    }
  }, [data, order]);
  const retry = (): void => {
    void query.refetch();
  };
  if (isGone) {
    return <Message title={texts.tracking.notFound.title} line={texts.tracking.notFound.line} />;
  }
  if (data !== undefined) {
    return (
      <TrackingContent view={data} token={order.token} isStale={query.isError} onRetry={retry} />
    );
  }
  if (query.isError) {
    return (
      <Notice tone="error" action={{ label: texts.common.retry, onClick: retry }}>
        {texts.tracking.loadFailed}
      </Notice>
    );
  }
  return <Skeleton />;
}

function Body({ displayed }: { displayed: DisplayedOrder | null }): ReactElement {
  if (displayed === null) {
    return <Message title={texts.tracking.empty} />;
  }
  if (displayed.origin === "invalid") {
    // A link that is not a token says nothing of any order, and shows no other one.
    return <Message title={texts.tracking.notFound.title} line={texts.tracking.notFound.line} />;
  }
  return <Order order={displayed} />;
}

/** The tracking of an order: read with its token, refreshed by itself, cancelled while allowed. */
export function TrackingScreen(): ReactElement {
  useDocumentTitle(texts.tracking.title);
  useNoIndex();
  const displayed = useDisplayedOrder();
  const isThanked = useThanksOnce();
  return (
    <div className={styles.page}>
      {isThanked && <Notice tone="success">{texts.tracking.thanks}</Notice>}
      <Body displayed={displayed} />
    </div>
  );
}
