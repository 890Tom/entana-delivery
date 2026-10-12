import type { AdminLoginRequest, AdminProfile } from "@entana/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { RefObject, SyntheticEvent } from "react";
import { useLocation } from "wouter";

import { HOME_PATH } from "../../routes";
import { postLogin } from "../session/api/session-calls";
import { SESSION_KEY } from "../session/api/use-session";
import { useSessionNotice } from "../session/session-notice";

import { readLoginForm } from "./rules/read-login-form";
import type { IdentifierProblem, PasswordProblem } from "./rules/read-login-form";

export type LoginNotice = "wrong_credentials" | "rate_limited" | "failure";

interface FieldProblems {
  readonly identifier?: IdentifierProblem | undefined;
  readonly password?: PasswordProblem | undefined;
}

const NOTICE_BY_KIND = {
  unauthorized: "wrong_credentials",
  rate_limited: "rate_limited",
  invalid: "failure",
  // The login has no state that can change in between: any other answer is a failure.
  not_found: "failure",
  conflict: "failure",
  failure: "failure",
} as const;

function useIsMounted(): RefObject<boolean> {
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  return isMounted;
}

/** Opens the session in memory, forgets the "session ended" message and goes to the home page. */
function useStartSession(): (profile: AdminProfile) => void {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { dismiss } = useSessionNotice();
  return (profile) => {
    queryClient.setQueryData(SESSION_KEY, profile);
    dismiss();
    navigate(HOME_PATH, { replace: true });
  };
}

interface AttemptHandlers {
  /** Called as a send starts: the form hides the password again. */
  readonly onSend: () => void;
  /** Called on a 401 only: the form empties the password and gives it the focus. */
  readonly onWrongCredentials: () => void;
}

interface Attempt {
  readonly notice: LoginNotice | null;
  readonly isSending: boolean;
  readonly send: (request: AdminLoginRequest) => void;
}

/** One sign-in attempt at a time. Nothing is kept after the send: a retry reads the form again. */
function useLoginAttempt({ onSend, onWrongCredentials }: AttemptHandlers): Attempt {
  const startSession = useStartSession();
  const isMounted = useIsMounted();
  const [notice, setNotice] = useState<LoginNotice | null>(null);
  const [isSending, setIsSending] = useState(false);

  const send = (request: AdminLoginRequest): void => {
    setIsSending(true);
    setNotice(null);
    onSend();
    void postLogin(request).then((result) => {
      if (!isMounted.current) {
        return;
      }
      setIsSending(false);
      if (result.kind === "ok") {
        startSession(result.data);
        return;
      }
      if (result.kind === "unauthorized") {
        onWrongCredentials();
      }
      setNotice(NOTICE_BY_KIND[result.kind]);
    });
  };
  return { notice, isSending, send };
}

/** Hidden by default, shown on request, hidden again by `hide` (at every send). */
function usePasswordVisibility(): { isShown: boolean; toggle: () => void; hide: () => void } {
  const [isShown, setIsShown] = useState(false);
  return {
    isShown,
    toggle: () => {
      setIsShown((isCurrentlyShown) => !isCurrentlyShown);
    },
    hide: () => {
      setIsShown(false);
    },
  };
}

type LoginFields = Omit<LoginForm, keyof Attempt | "submit" | "retry"> & {
  readonly setProblems: (problems: FieldProblems) => void;
  readonly hidePassword: () => void;
};

export interface LoginForm extends Attempt {
  readonly identifier: string;
  readonly password: string;
  readonly isPasswordShown: boolean;
  readonly problems: FieldProblems;
  readonly identifierRef: RefObject<HTMLInputElement | null>;
  readonly passwordRef: RefObject<HTMLInputElement | null>;
  readonly setIdentifier: (value: string) => void;
  readonly setPassword: (value: string) => void;
  readonly togglePasswordShown: () => void;
  readonly submit: (event: SyntheticEvent) => void;
  /** Sends the values the form holds now. */
  readonly retry: () => void;
}

function useLoginFields(): LoginFields {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [problems, setProblems] = useState<FieldProblems>({});
  const visibility = usePasswordVisibility();
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  return {
    identifier,
    password,
    problems,
    isPasswordShown: visibility.isShown,
    identifierRef,
    passwordRef,
    setIdentifier,
    setPassword,
    setProblems,
    togglePasswordShown: visibility.toggle,
    hidePassword: visibility.hide,
  };
}

/**
 * The state of the sign-in form. The password stays in its field, and nowhere else, until a 401
 * empties it; a retry sends what the form holds at that moment.
 */
export function useLoginForm(): LoginForm {
  const fields = useLoginFields();
  const { identifier, password, setProblems, identifierRef, passwordRef } = fields;
  const attempt = useLoginAttempt({
    onSend: () => {
      setProblems({});
      fields.hidePassword();
    },
    onWrongCredentials: () => {
      fields.setPassword("");
      passwordRef.current?.focus();
    },
  });

  const retry = (): void => {
    if (attempt.isSending) {
      return;
    }
    const reading = readLoginForm({ identifier, password });
    if (reading.isValid) {
      attempt.send(reading.request);
      return;
    }
    setProblems({ identifier: reading.identifier, password: reading.password });
    (reading.identifier === undefined ? passwordRef : identifierRef).current?.focus();
  };

  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    retry();
  };

  return { ...attempt, ...fields, submit, retry };
}
