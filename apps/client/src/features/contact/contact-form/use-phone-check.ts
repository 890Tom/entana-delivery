import { useEffect, useRef, useState } from "react";

import { useInstance } from "../../instance/use-instance";
import { checkPhone, toPhoneDisplay } from "../rules/phone-input";
import type { PhoneIssue } from "../rules/phone-input";

/** The phone number depends on the country code of the instance, which may not be there yet. */
export type PhoneState = "valid" | "invalid" | "loading" | "failed";

/** Once the country code is known, a draft from the storage (or typed before) is put in form. */
function useNormalizedDraft(
  countryCode: string | undefined,
  phone: string,
  setPhone: (phone: string) => void,
): void {
  const isNormalized = useRef(false);
  useEffect(() => {
    if (countryCode === undefined || isNormalized.current) {
      return;
    }
    isNormalized.current = true;
    const display = toPhoneDisplay(phone, countryCode);
    if (display !== phone) {
      setPhone(display);
    }
  }, [countryCode, phone, setPhone]);
}

/**
 * The country code of the instance and what it makes of the number: it cannot be checked while
 * the code is not there, and the code is never guessed.
 */
export function usePhoneCheck(
  phone: string,
  setPhone: (phone: string) => void,
): {
  readonly countryCode: string | undefined;
  readonly state: PhoneState;
  readonly issue: PhoneIssue | null;
  readonly hasLeft: boolean;
  readonly leave: () => void;
  readonly retry: () => void;
} {
  const instance = useInstance();
  const [hasLeft, setHasLeft] = useState(false);
  const countryCode = instance.data?.phoneCountryCode;
  useNormalizedDraft(countryCode, phone, setPhone);

  const check = countryCode === undefined ? null : checkPhone(phone, countryCode);
  let state: PhoneState = "loading";
  if (check !== null) {
    state = check.ok ? "valid" : "invalid";
  } else if (instance.isError) {
    state = "failed";
  }
  return {
    countryCode,
    state,
    issue: check === null || check.ok ? null : check.issue,
    hasLeft,
    // An empty field that is left says nothing: it is only asked for when the form is sent.
    leave: () => {
      if (phone !== "") {
        setHasLeft(true);
      }
    },
    retry: () => {
      void instance.refetch();
    },
  };
}
