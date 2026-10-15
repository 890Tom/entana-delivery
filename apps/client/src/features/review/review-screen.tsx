import type { ReactElement } from "react";
import { Redirect } from "wouter";

import { texts } from "../../i18n/texts";
import { useDocumentTitle } from "../../layout/document-title/use-document-title";
import { TRACKING_PATH } from "../../routes";
import { useProducts } from "../catalogue/api/use-products";
import { useCartReconciliation } from "../cart/reconciliation/use-cart-reconciliation";
import { useOrderSubmission } from "../order-submission/use-order-submission";

import { ReviewContent } from "./content/review-content";
import { useReviewGate } from "./gate/use-review-gate";

/**
 * The review of the order and its sending. A confirmed order leads to the tracking address,
 * replacing this entry of the history.
 */
export function ReviewScreen(): ReactElement | null {
  useDocumentTitle(texts.review.title);
  const products = useProducts();
  // The same drop of the products that are no longer on sale as on the other screens.
  useCartReconciliation(products.data?.products);
  const submission = useOrderSubmission();
  const gate = useReviewGate(submission.state);
  switch (gate.kind) {
    case "hold":
      return null;
    case "tracking":
      return <Redirect href={TRACKING_PATH} replace />;
    case "redirect":
      return <Redirect href={gate.href} replace />;
    case "show":
      return <ReviewContent submission={submission} deliveryQuote={gate.deliveryQuote} />;
  }
}
