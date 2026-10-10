import { useEffect } from "react";
import type { ReactElement, RefObject } from "react";

import { Notice } from "../../../components/notice/notice";
import { texts } from "../../../i18n/texts";
import { useProducts } from "../../catalogue/api/use-products";
import { useInstance } from "../../instance/use-instance";
import { isReplayable } from "../../order-submission/order-submission-types";
import type { OrderSubmission } from "../../order-submission/use-order-submission";

import { describeSubmissionError } from "../rules/describe-submission-error";
import type { ErrorAction } from "../rules/describe-submission-error";

type NoticeAction =
  { label: string; onClick: () => void } | { label: string; href: string } | undefined;

function toNoticeAction(action: ErrorAction, onRetry: () => void): NoticeAction {
  switch (action.kind) {
    case "retry":
      return { label: texts.common.retry, onClick: onRetry };
    case "link":
      return { label: action.label, href: action.href };
    case "none":
      return undefined;
  }
}

/**
 * The one notice of the page, or null: a send error, else the failure of the configuration. The
 * focus goes to a send error when it appears: it explains why nothing was sent.
 */
export function useReviewNotice(
  submission: OrderSubmission,
  noticeRef: RefObject<HTMLDivElement | null>,
): ReactElement | null {
  const instance = useInstance();
  const products = useProducts();
  const { state } = submission;
  useEffect(() => {
    if (state.status === "error") {
      noticeRef.current?.focus();
    }
  }, [state, noticeRef]);
  if (state.status === "error") {
    const view = describeSubmissionError(state.error, products.data?.products ?? []);
    // An error that is not replayable has no stored attempt: the retry makes a new one.
    const retry = isReplayable(state.error) ? submission.retry : submission.send;
    return (
      <Notice
        tone="error"
        ref={noticeRef}
        tabIndex={-1}
        action={toNoticeAction(view.action, retry)}
      >
        {view.message}
      </Notice>
    );
  }
  if (instance.isError) {
    const retry = (): void => {
      void instance.refetch();
    };
    return (
      <Notice tone="error" action={{ label: texts.common.retry, onClick: retry }}>
        {texts.review.configurationError}
      </Notice>
    );
  }
  return null;
}
