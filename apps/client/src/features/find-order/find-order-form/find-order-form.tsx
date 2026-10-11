import type { TrackingLookupRequest, TrackingResponse } from "@entana/contracts";
import { useEffect, useId, useRef } from "react";
import type { ReactElement, RefObject, SubmitEvent } from "react";

import { BottomBar } from "../../../components/bottom-bar/bottom-bar";
import bar from "../../../components/bottom-bar/bottom-bar.module.css";
import { Notice } from "../../../components/notice/notice";
import { TextField } from "../../../components/text-field/text-field";
import { texts } from "../../../i18n/texts";
import { PhoneField } from "../../contact/contact-form/phone-field";

import styles from "../find-order-screen.module.css";
import { useLookupForm } from "./use-lookup-form";
import type { LookupFormState } from "./use-lookup-form";

function ProblemNotice({ form }: { form: LookupFormState }): ReactElement | null {
  const { notFound, rateLimited, failed } = texts.findOrder;
  switch (form.problem) {
    case null:
      return null;
    case "not_found":
      return <Notice tone="error">{notFound}</Notice>;
    case "rate_limited":
      return <Notice tone="error">{rateLimited}</Notice>;
    case "failure":
      return (
        <Notice tone="error" action={{ label: texts.common.retry, onClick: form.submit }}>
          {failed}
        </Notice>
      );
  }
}

function CodeField({ form }: { form: LookupFormState }): ReactElement {
  const { code } = texts.findOrder;
  return (
    <TextField
      ref={form.codeRef}
      label={code.label}
      hint={code.hint}
      error={form.isCodeInvalid ? code.error : undefined}
      autoComplete="off"
      autoCapitalize="characters"
      spellCheck={false}
      isUppercase
      value={form.code}
      onChange={form.setCode}
      isRequired
    />
  );
}

/** From 1024 px the bar is not displayed and this button, in the column, takes its place. */
function WideSubmit({ isSending }: { isSending: boolean }): ReactElement {
  return (
    <div className={styles.wideOnly}>
      <button
        type="submit"
        className={bar.link}
        aria-disabled={isSending ? true : undefined}
        aria-busy={isSending ? true : undefined}
      >
        {texts.findOrder.submit}
      </button>
    </div>
  );
}

/** Moves the focus to the title once, when the customer comes back from a result. */
function useFocusTitleOnReturn(isReturning: boolean): RefObject<HTMLHeadingElement | null> {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (isReturning) {
      titleRef.current?.focus();
    }
  }, [isReturning]);
  return titleRef;
}

interface FindOrderFormProps {
  /** The customer comes back from a result: the focus goes to the title, not to a field. */
  readonly isReturning: boolean;
  readonly onFound: (request: TrackingLookupRequest, view: TrackingResponse) => void;
}

/**
 * The phone number and the order code. The button of a phone is the fixed bar's; from 1024 px
 * the same button follows the fields, in the column.
 */
export function FindOrderForm({ isReturning, onFound }: FindOrderFormProps): ReactElement {
  const { findOrder } = texts;
  const form = useLookupForm(onFound);
  const formId = useId();
  const titleRef = useFocusTitleOnReturn(isReturning);
  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    form.submit();
  };
  return (
    <div className={styles.page}>
      <form id={formId} noValidate className={styles.form} onSubmit={handleSubmit}>
        <h1 ref={titleRef} tabIndex={-1} className={styles.title}>
          {findOrder.title}
        </h1>
        <p className={styles.intro}>{findOrder.intro}</p>
        <PhoneField
          form={form.phoneState}
          error={form.isPhoneRefused ? texts.contact.phone.errors.invalid : undefined}
        />
        <CodeField form={form} />
        <ProblemNotice form={form} />
        <WideSubmit isSending={form.isSending} />
      </form>
      <BottomBar
        formId={formId}
        label={findOrder.submit}
        isDisabled={form.isSending}
        isBusy={form.isSending}
      />
    </div>
  );
}
