import { createContext, useContext } from "react";

/** Whether the person was sent back to the sign-in because the session ended elsewhere. */
export interface SessionNotice {
  readonly isExpired: boolean;
  readonly dismiss: () => void;
}

export const SESSION_NOTICE_CONTEXT = createContext<SessionNotice>({
  isExpired: false,
  dismiss: () => undefined,
});

export function useSessionNotice(): SessionNotice {
  return useContext(SESSION_NOTICE_CONTEXT);
}
