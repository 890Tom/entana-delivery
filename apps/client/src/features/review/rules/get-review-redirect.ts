import { CART_PATH, CONTACT_PATH, DELIVERY_PATH } from "../../../routes";
import { isValidContactName, isValidCustomerNote } from "../../contact/rules/contact-rules";
import { checkPhone } from "../../contact/rules/phone-input";
import { isValidLandmark } from "../../delivery/rules/validate-landmark";

interface ReviewGuardInput {
  readonly itemCount: number;
  readonly hasPoint: boolean;
  readonly landmark: string;
  readonly name: string;
  readonly phone: string;
  readonly note: string;
  /** Undefined while the instance is not loaded: the number cannot be judged yet. */
  readonly countryCode: string | undefined;
}

/**
 * The screen to go back to when what the review needs is missing, or null when it can be shown.
 * The checks are those of the screens before it, in their order.
 */
export function getReviewRedirect(input: ReviewGuardInput): string | null {
  if (input.itemCount === 0) {
    return CART_PATH;
  }
  if (!input.hasPoint || !isValidLandmark(input.landmark)) {
    return DELIVERY_PATH;
  }
  const isContactValid =
    isValidContactName(input.name) &&
    isValidCustomerNote(input.note) &&
    (input.countryCode === undefined || checkPhone(input.phone, input.countryCode).ok);
  return isContactValid ? null : CONTACT_PATH;
}
