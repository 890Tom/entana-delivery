import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useLocation } from "wouter";

import { CONTACT_PATH } from "../../../routes";
import { useDeliveryDraft } from "../delivery-draft/delivery-draft-context";
import { isValidLandmark } from "../rules/validate-landmark";

type FocusTarget = "point" | "landmark";

export interface DeliveryFormState {
  readonly landmark: string;
  readonly setLandmark: (landmark: string) => void;
  /** Shown once the customer has tried to continue, until the point is placed. */
  readonly isPointMissing: boolean;
  readonly isLandmarkInvalid: boolean;
  readonly noticeRef: RefObject<HTMLDivElement | null>;
  readonly landmarkRef: RefObject<HTMLInputElement | null>;
  readonly submit: () => void;
}

/**
 * The checks of "Continuer": both errors are shown together, the focus goes to the first element
 * in error in visual order (the map's notice, then the field), and an error goes away as soon as
 * what it says is fixed. When all is valid the draft is saved and the next screen opens.
 */
export function useDeliveryForm(): DeliveryFormState {
  const { point, landmark, setLandmark, save } = useDeliveryDraft();
  const [, navigate] = useLocation();
  const [hasTried, setHasTried] = useState(false);
  // A new object for each attempt, so that a second refusal moves the focus again.
  const [focusRequest, setFocusRequest] = useState<{ readonly target: FocusTarget } | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const landmarkRef = useRef<HTMLInputElement>(null);

  const isLandmarkValid = isValidLandmark(landmark);

  // After the render that shows the errors, so that the element to focus exists.
  useEffect(() => {
    if (focusRequest !== null) {
      (focusRequest.target === "point" ? noticeRef : landmarkRef).current?.focus();
    }
  }, [focusRequest]);

  const submit = (): void => {
    setHasTried(true);
    if (point === null || !isLandmarkValid) {
      setFocusRequest({ target: point === null ? "point" : "landmark" });
      return;
    }
    save();
    navigate(CONTACT_PATH);
  };

  return {
    landmark,
    setLandmark,
    isPointMissing: hasTried && point === null,
    isLandmarkInvalid: hasTried && !isLandmarkValid,
    noticeRef,
    landmarkRef,
    submit,
  };
}
