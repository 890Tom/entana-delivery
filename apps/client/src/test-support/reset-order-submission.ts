import { resetOrderSubmissionState } from "../features/order-submission/order-submission";

/**
 * The order submission keeps its state in the module (it must outlive a screen): a test calls
 * this before each case so that nothing leaks from one to the next.
 */
export function resetOrderSubmission(): void {
  resetOrderSubmissionState();
  sessionStorage.clear();
  localStorage.clear();
}
