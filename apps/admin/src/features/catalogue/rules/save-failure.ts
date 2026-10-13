import type { SaveOutcome } from "../api/save-product";

import type { PhotoProblem } from "./photo-check";
import type { ProductFormErrors } from "./product-form";

type Failed = Extract<SaveOutcome, { kind: "failed" }>;

/** What a refused save shows. Every word is chosen by the screen: nothing comes from the server. */
export interface SaveFailureView {
  readonly fieldErrors: ProductFormErrors;
  readonly photoProblem: PhotoProblem | null;
  /** The visibility switch says that a photo and its alternative text are needed. */
  readonly hasPublishError: boolean;
  readonly notice: "failed" | "photoFailed" | "publishFailed" | null;
  /** Leave the new form for the form of the product that was created. */
  readonly isRedirect: boolean;
  /** The session ended: the screen says nothing, the next read shows the sign-in. */
  readonly isUnauthorized: boolean;
}

const NOTHING: SaveFailureView = {
  fieldErrors: {},
  photoProblem: null,
  hasPublishError: false,
  notice: null,
  isRedirect: false,
  isUnauthorized: false,
};

const PHOTO_PROBLEMS: Readonly<Record<string, PhotoProblem | undefined>> = {
  photoTooSmall: "tooSmall",
  photoInvalid: "invalid",
  photoTooLarge: "tooLarge",
};

function describePhotoFailure(outcome: Failed): SaveFailureView {
  if (outcome.isCreation) {
    // The product exists now: the person is taken to its form, where the photo can be sent again.
    return { ...NOTHING, notice: "photoFailed", isRedirect: true };
  }
  const { problem } = outcome.failure;
  const photoProblem = problem === undefined ? undefined : PHOTO_PROBLEMS[problem];
  if (photoProblem !== undefined) {
    return { ...NOTHING, photoProblem };
  }
  if (problem === "photoAltRequired") {
    return { ...NOTHING, fieldErrors: { imageAlt: "imageAltRequired" } };
  }
  return { ...NOTHING, notice: "failed" };
}

export function describeSaveFailure(outcome: Failed): SaveFailureView {
  if (outcome.failure.kind === "unauthorized") {
    return { ...NOTHING, isUnauthorized: true };
  }
  switch (outcome.stage) {
    case "details":
      return outcome.failure.problem === "skuTaken"
        ? { ...NOTHING, fieldErrors: { sku: "skuTaken" } }
        : { ...NOTHING, notice: "failed" };
    case "photo":
      return describePhotoFailure(outcome);
    case "publish":
      return {
        ...NOTHING,
        hasPublishError: outcome.failure.problem === "notPublishable",
        notice: "publishFailed",
        isRedirect: outcome.isCreation,
      };
  }
}
