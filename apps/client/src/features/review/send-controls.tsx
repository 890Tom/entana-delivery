import type { ReactElement } from "react";

import { BottomBar } from "../../components/bottom-bar/bottom-bar";
import visuallyHidden from "../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../i18n/texts";

interface SendControlsProps {
  readonly formId: string;
  readonly isInactive: boolean;
  readonly isSending: boolean;
  readonly onSend: () => void;
}

/**
 * What the two send buttons share: the one form they submit (the button of the amounts card is
 * elsewhere), the announcement of the sending, and the button of the fixed bar.
 */
export function SendControls({
  formId,
  isInactive,
  isSending,
  onSend,
}: SendControlsProps): ReactElement {
  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!isInactive) {
            onSend();
          }
        }}
      />
      <p aria-live="polite" className={visuallyHidden.visuallyHidden}>
        {isSending ? texts.review.sending : ""}
      </p>
      <BottomBar
        formId={formId}
        label={texts.review.send}
        isDisabled={isInactive}
        isBusy={isSending}
      />
    </>
  );
}
