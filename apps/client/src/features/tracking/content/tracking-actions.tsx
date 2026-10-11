import { useEffect, useId, useRef } from "react";
import type { KeyboardEvent, ReactElement, RefObject } from "react";

import { Button, ButtonLink } from "../../../components/button/button";
import { texts } from "../../../i18n/texts";
import { useReportedHeight } from "../../../layout/reported-height/use-reported-height";
import type { CancelFlow } from "../api/use-cancel-flow";
import { describeVisibleActions } from "../rules/describe-tracking-actions";
import type { TrackingActionsView } from "../rules/describe-tracking-actions";

import styles from "./tracking-actions.module.css";

interface TrackingActionsProps {
  /** The canonical number of the shop, to call it when the order goes on. */
  readonly phone: string | null;
  readonly available: TrackingActionsView;
  /** Null where the order cannot be cancelled from the screen. */
  readonly cancel: CancelFlow | null;
}

function CancelPanel({ cancel }: { cancel: CancelFlow }): ReactElement {
  const titleId = useId();
  const titleRef = useRef<HTMLParagraphElement>(null);
  const { cancelPanel } = texts.tracking;
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && !cancel.isSending) {
      cancel.keep();
    }
  };
  return (
    <div role="group" aria-labelledby={titleId} className={styles.panel} onKeyDown={onKeyDown}>
      <p id={titleId} ref={titleRef} tabIndex={-1} className={styles.panelTitle}>
        {cancelPanel.title}
      </p>
      <p className={styles.panelText}>{cancelPanel.text}</p>
      <div className={styles.panelButtons}>
        <Button variant="danger" isDisabled={cancel.isSending} onClick={cancel.confirm}>
          {cancelPanel.confirm}
        </Button>
        {/* Once the request is sent the order will be cancelled: "keep" is not offered any more. */}
        <Button isDisabled={cancel.isSending} onClick={cancel.keep}>
          {cancelPanel.keep}
        </Button>
      </div>
    </div>
  );
}

interface CancelAreaProps {
  readonly cancel: CancelFlow | null;
  readonly isButtonShown: boolean;
  readonly isPanelShown: boolean;
  readonly buttonRef: RefObject<HTMLButtonElement | null>;
}

/** The cancel button, or its question; nothing where the screen cannot cancel the order. */
function CancelArea({
  cancel,
  isButtonShown,
  isPanelShown,
  buttonRef,
}: CancelAreaProps): ReactElement | null {
  if (cancel === null) {
    return null;
  }
  if (isPanelShown) {
    return <CancelPanel cancel={cancel} />;
  }
  return isButtonShown ? (
    <Button variant="ghost" ref={buttonRef} onClick={cancel.ask}>
      {texts.tracking.actions.cancel}
    </Button>
  ) : null;
}

/** The focus goes back to the button that opened the question when the question is closed. */
function useFocusBackOnClose(isAsking: boolean): RefObject<HTMLButtonElement | null> {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);
  useEffect(() => {
    if (wasAsking.current && !isAsking) {
      buttonRef.current?.focus();
    }
    wasAsking.current = isAsking;
  }, [isAsking]);
  return buttonRef;
}

/**
 * What the customer can do with the order: call, cancel in two steps, or order again once it is
 * finished. Nothing is rendered, and no room is kept, when there is nothing to do.
 */
export function TrackingActions({
  phone,
  available,
  cancel,
}: TrackingActionsProps): ReactElement | null {
  const { actions } = texts.tracking;
  const visible = describeVisibleActions(available, phone !== null, cancel?.isAsking ?? false);
  const cancelRef = useFocusBackOnClose(visible.panel);
  const actionsRef = useRef<HTMLDivElement>(null);
  // On a phone this is a fixed bar, whose height changes with the question that replaces buttons.
  useReportedHeight(actionsRef, "--size-bottom-bar", visible.isAny);
  if (!visible.isAny) {
    return null;
  }
  return (
    <div ref={actionsRef} className={styles.actions}>
      {visible.call && (
        <ButtonLink variant="primary" icon="phone" href={`tel:${phone ?? ""}`}>
          {actions.call}
        </ButtonLink>
      )}
      <CancelArea
        cancel={cancel}
        isButtonShown={visible.cancel}
        isPanelShown={visible.panel}
        buttonRef={cancelRef}
      />
      {visible.reorder && (
        <ButtonLink variant="primary" href="/">
          {actions.reorder}
        </ButtonLink>
      )}
    </div>
  );
}
