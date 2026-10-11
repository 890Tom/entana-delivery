import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useLocation } from "wouter";

import { REVIEW_PATH } from "../../../routes";
import { useContactDraft } from "../contact-draft/contact-draft-context";
import { isValidContactName, isValidCustomerNote } from "../rules/contact-rules";
import type { PhoneIssue } from "../rules/phone-input";

import { usePhoneCheck } from "./use-phone-check";
import type { PhoneState } from "./use-phone-check";

type FocusTarget = "name" | "phone" | "instance" | "note";

export interface ContactFormState {
  readonly name: string;
  readonly phone: string;
  readonly note: string;
  readonly setName: (name: string) => void;
  readonly setPhone: (phone: string) => void;
  readonly setNote: (note: string) => void;
  /** Without "+": undefined while the instance loads or when it failed. */
  readonly countryCode: string | undefined;
  readonly isConfigurationFailed: boolean;
  readonly retryConfiguration: () => void;
  readonly isNameInvalid: boolean;
  readonly isPhoneInvalid: boolean;
  /** Why the number is refused, whether or not it is shown yet. */
  readonly phoneIssue: PhoneIssue | null;
  /** The field is left: an incomplete number is then told. */
  readonly onPhoneBlur: () => void;
  readonly isNoteInvalid: boolean;
  readonly nameRef: RefObject<HTMLInputElement | null>;
  readonly phoneRef: RefObject<HTMLElement | null>;
  readonly noteRef: RefObject<HTMLTextAreaElement | null>;
  readonly noticeRef: RefObject<HTMLDivElement | null>;
  readonly submit: () => void;
}

/** The first element in visual order that stops the customer, or null when all is valid. */
function firstBlocking(
  isNameValid: boolean,
  phone: PhoneState,
  isNoteValid: boolean,
): FocusTarget | null {
  if (!isNameValid) {
    return "name";
  }
  if (phone === "invalid" || phone === "loading") {
    return "phone";
  }
  if (phone === "failed") {
    return "instance";
  }
  return isNoteValid ? null : "note";
}

/** The refs of what may take the focus, and the way to ask for it once it is on the page. */
function useFocusTargets(): {
  readonly refs: Pick<ContactFormState, "nameRef" | "phoneRef" | "noteRef" | "noticeRef">;
  readonly focus: (target: FocusTarget) => void;
} {
  // A new object for each request, so that a second refusal moves the focus again.
  const [request, setRequest] = useState<{ readonly target: FocusTarget } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  // After the render that shows the errors, so that the element to focus exists.
  useEffect(() => {
    if (request !== null) {
      const targets = { name: nameRef, phone: phoneRef, note: noteRef, instance: noticeRef };
      targets[request.target].current?.focus();
    }
  }, [request]);
  return {
    refs: { nameRef, phoneRef, noteRef, noticeRef },
    focus: (target) => {
      setRequest({ target });
    },
  };
}

/**
 * The checks of "Vérifier la commande": the errors are shown together, the focus goes to the
 * first element in error in visual order, and an error goes away as soon as what it says is
 * fixed. When all is valid the draft is saved and the next screen opens. While the country code is
 * unknown the phone number cannot be checked: nothing is sent on, and the focus goes to the field.
 */
export function useContactForm(): ContactFormState {
  const draft = useContactDraft();
  const [, navigate] = useLocation();
  const [hasTried, setHasTried] = useState(false);
  const { refs, focus } = useFocusTargets();
  const phone = usePhoneCheck(draft.phone, draft.setPhone);
  const isNameValid = isValidContactName(draft.name);
  const isNoteValid = isValidCustomerNote(draft.note);

  const submit = (): void => {
    setHasTried(true);
    const blocking = firstBlocking(isNameValid, phone.state, isNoteValid);
    if (blocking !== null) {
      focus(blocking);
      return;
    }
    draft.save();
    navigate(REVIEW_PATH);
  };

  return {
    ...refs,
    name: draft.name,
    phone: draft.phone,
    note: draft.note,
    setName: draft.setName,
    setPhone: draft.setPhone,
    setNote: draft.setNote,
    countryCode: phone.countryCode,
    isConfigurationFailed: phone.state === "failed",
    retryConfiguration: phone.retry,
    isNameInvalid: hasTried && !isNameValid,
    isPhoneInvalid: (hasTried || phone.hasLeft) && phone.state === "invalid",
    phoneIssue: phone.issue,
    onPhoneBlur: phone.leave,
    isNoteInvalid: hasTried && !isNoteValid,
    submit,
  };
}
