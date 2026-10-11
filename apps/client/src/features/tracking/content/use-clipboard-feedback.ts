import { useState } from "react";

import { texts } from "../../../i18n/texts";

export interface ClipboardFeedback {
  /** The sentence read by the polite region; empty until something was done. */
  readonly message: string;
  readonly copy: (text: string, success: string) => void;
  readonly share: (text: string) => void;
}

/**
 * Copying and sharing, guarded: the clipboard may be missing or refused, and a sharing that the
 * customer closes is not a failure. The outcome is a text for a live region.
 */
export function useClipboardFeedback(): ClipboardFeedback {
  const [message, setMessage] = useState("");
  const { feedback } = texts.tracking;
  return {
    message,
    copy: (text, success) => {
      void (async () => {
        try {
          await navigator.clipboard.writeText(text);
          setMessage(success);
        } catch {
          setMessage(feedback.copyFailed);
        }
      })();
    },
    share: (text) => {
      void (async () => {
        try {
          await navigator.share({ text });
          setMessage("");
        } catch (error: unknown) {
          const isClosedByCustomer = error instanceof DOMException && error.name === "AbortError";
          setMessage(isClosedByCustomer ? "" : feedback.shareFailed);
        }
      })();
    },
  };
}
