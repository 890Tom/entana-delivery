import { describe, expect, it } from "vitest";

import type { SaveOutcome } from "../api/save-product";
import { buildProduct } from "../../../test-support/catalogue/build-product";

import { describeSaveFailure } from "./save-failure";

type Failed = Extract<SaveOutcome, { kind: "failed" }>;

const failed = (overrides: Partial<Failed>): Failed => ({
  kind: "failed",
  stage: "details",
  failure: { kind: "failure" },
  product: buildProduct(1),
  isCreation: false,
  ...overrides,
});

describe("describeSaveFailure", () => {
  it("puts a taken reference under its field", () => {
    const view = describeSaveFailure(
      failed({ failure: { kind: "conflict", problem: "skuTaken" } }),
    );

    expect(view.fieldErrors).toEqual({ sku: "skuTaken" });
    expect(view.notice).toBeNull();
  });

  it("takes the person to the created product when its photo is refused", () => {
    const view = describeSaveFailure(
      failed({
        stage: "photo",
        isCreation: true,
        failure: { kind: "invalid", problem: "photoTooSmall" },
      }),
    );

    expect(view).toMatchObject({ notice: "photoFailed", isRedirect: true });
  });

  it("puts the refusal of the photo of an existing product under the drop zone", () => {
    const view = describeSaveFailure(
      failed({ stage: "photo", failure: { kind: "failure", problem: "photoTooLarge" } }),
    );

    expect(view.photoProblem).toBe("tooLarge");
  });

  it("asks for the alternative text when the server wants it", () => {
    const view = describeSaveFailure(
      failed({ stage: "photo", failure: { kind: "invalid", problem: "photoAltRequired" } }),
    );

    expect(view.fieldErrors).toEqual({ imageAlt: "imageAltRequired" });
  });

  it("says that the product could not be published, and why when it is known", () => {
    const view = describeSaveFailure(
      failed({ stage: "publish", failure: { kind: "invalid", problem: "notPublishable" } }),
    );

    expect(view).toMatchObject({ notice: "publishFailed", hasPublishError: true });
  });

  it("says nothing of a session that ended", () => {
    const view = describeSaveFailure(failed({ failure: { kind: "unauthorized" } }));

    expect(view).toMatchObject({ isUnauthorized: true, notice: null });
  });
});
