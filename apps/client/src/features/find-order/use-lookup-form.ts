import type { TrackingLookupRequest, TrackingResponse } from "@entana/contracts";
import { useRef, useState } from "react";
import type { RefObject } from "react";

import type { PhoneFieldState } from "../contact/contact-form/phone-field";
import { usePhoneCheck } from "../contact/contact-form/use-phone-check";

import { useLookup } from "./api/use-lookup";
import { readOrderCode, toLookupRequest } from "./rules/read-lookup-form";

/** What the lookup answered that is not an order: shown under the fields, in words. */
type Problem = "invalid_phone" | "not_found" | "rate_limited" | "failure";

export interface LookupFormState {
  readonly phoneState: PhoneFieldState;
  readonly code: string;
  readonly setCode: (code: string) => void;
  readonly codeRef: RefObject<HTMLInputElement | null>;
  readonly isCodeInvalid: boolean;
  /** The number the server refused although it passed the local check. */
  readonly isPhoneRefused: boolean;
  readonly problem: Exclude<Problem, "invalid_phone"> | null;
  readonly isSending: boolean;
  readonly submit: () => void;
}

type PhoneCheck = ReturnType<typeof usePhoneCheck>;

interface Refs {
  readonly phone: RefObject<HTMLElement | null>;
  readonly notice: RefObject<HTMLDivElement | null>;
  readonly code: RefObject<HTMLInputElement | null>;
}

function useRefs(): Refs {
  const phone = useRef<HTMLElement>(null);
  const notice = useRef<HTMLDivElement>(null);
  const code = useRef<HTMLInputElement>(null);
  return { phone, notice, code };
}

/** The first element in error, in visual order: the number, or the notice of its configuration. */
function focusFirstError(check: PhoneCheck, refs: Refs): void {
  if (check.state === "valid") {
    refs.code.current?.focus();
  } else {
    (check.state === "failed" ? refs.notice : refs.phone).current?.focus();
  }
}

interface SubmitInput {
  readonly phone: string;
  readonly code: string;
  readonly check: PhoneCheck;
  readonly refs: Refs;
  readonly setProblem: (problem: Problem | null) => void;
  readonly onFound: (request: TrackingLookupRequest, view: TrackingResponse) => void;
}

/** The sending: checked together, sent at most once at a time, the answer told in words. */
function useSubmit(input: SubmitInput): { isSending: boolean; send: () => void } {
  const { phone, code, check, refs, setProblem, onFound } = input;
  const lookup = useLookup();
  const send = (): void => {
    if (lookup.isPending) {
      return;
    }
    setProblem(null);
    const request =
      check.countryCode === undefined ? null : toLookupRequest(phone, code, check.countryCode);
    if (request === null) {
      focusFirstError(check, refs);
      return;
    }
    lookup.mutate(request, {
      onSuccess: (result) => {
        if (result.kind === "ok") {
          onFound(request, result.view);
          return;
        }
        setProblem(result.kind);
        if (result.kind === "invalid_phone") {
          refs.phone.current?.focus();
        }
      },
    });
  };
  return { isSending: lookup.isPending, send };
}

interface PhoneStateInput {
  readonly phone: string;
  readonly check: PhoneCheck;
  readonly refs: Refs;
  readonly hasTried: boolean;
  readonly setPhone: (phone: string) => void;
}

/** What the shared phone field needs of this form. */
function toPhoneFieldState(input: PhoneStateInput): PhoneFieldState {
  const { phone, check, refs, hasTried, setPhone } = input;
  return {
    phone,
    setPhone,
    countryCode: check.countryCode,
    phoneRef: refs.phone,
    noticeRef: refs.notice,
    isConfigurationFailed: check.state === "failed",
    retryConfiguration: check.retry,
    isPhoneInvalid: (hasTried || check.hasLeft) && check.state === "invalid",
    phoneIssue: check.issue,
    onPhoneBlur: check.leave,
  };
}

/**
 * The two values live here, in the state of the screen, and nowhere else. They are checked
 * together on sending, the focus goes to the first one in error, and they leave with the screen.
 */
export function useLookupForm(
  onFound: (request: TrackingLookupRequest, view: TrackingResponse) => void,
): LookupFormState {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [hasTried, setHasTried] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const refs = useRefs();
  const check = usePhoneCheck(phone, setPhone);
  const { isSending, send } = useSubmit({ phone, code, check, refs, setProblem, onFound });
  // Any edit takes the last answer away: it was about the values as they were.
  const editing = (set: (value: string) => void) => (value: string) => {
    setProblem(null);
    set(value);
  };
  return {
    phoneState: toPhoneFieldState({
      phone,
      check,
      refs,
      hasTried,
      setPhone: editing(setPhone),
    }),
    code,
    setCode: editing(setCode),
    codeRef: refs.code,
    isCodeInvalid: hasTried && readOrderCode(code) === null,
    isPhoneRefused: problem === "invalid_phone",
    problem: problem === "invalid_phone" ? null : problem,
    isSending,
    submit: () => {
      setHasTried(true);
      send();
    },
  };
}
