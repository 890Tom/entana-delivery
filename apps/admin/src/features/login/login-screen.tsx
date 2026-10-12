import type { ReactElement } from "react";
import { useId } from "react";

import { Button } from "../../components/button/button";
import { Notice } from "../../components/notice/notice";
import { ShopLogo } from "../../components/shop-logo/shop-logo";
import { TextField } from "../../components/text-field/text-field";
import visuallyHidden from "../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../i18n/texts";
import { useSessionNotice } from "../session/session-notice";

import styles from "./login-screen.module.css";
import { useLoginForm } from "./use-login-form";
import type { LoginForm, LoginNotice } from "./use-login-form";

const NOTICE_TEXTS: Readonly<Record<LoginNotice, string>> = {
  wrong_credentials: texts.login.wrongCredentials,
  rate_limited: texts.login.rateLimited,
  failure: texts.login.failure,
};

const IDENTIFIER_ERRORS = {
  required: texts.login.identifierRequired,
  invalid: texts.login.identifierInvalid,
} as const;

const PASSWORD_ERRORS = {
  required: texts.login.passwordRequired,
  "too-long": texts.login.passwordTooLong,
} as const;

function LoginNoticeBlock({ form }: { form: LoginForm }): ReactElement | null {
  const { isExpired } = useSessionNotice();
  if (form.notice !== null) {
    return (
      <Notice
        tone="error"
        action={
          form.notice === "failure" ? { label: texts.common.retry, onClick: form.retry } : undefined
        }
      >
        {NOTICE_TEXTS[form.notice]}
      </Notice>
    );
  }
  return isExpired ? <Notice tone="info">{texts.login.sessionExpired}</Notice> : null;
}

function LoginFields({ form }: { form: LoginForm }): ReactElement {
  const isWrong = form.notice === "wrong_credentials";
  const { identifier, password } = form.problems;
  return (
    <>
      <TextField
        ref={form.identifierRef}
        label={texts.login.identifier}
        type="email"
        autoComplete="username"
        value={form.identifier}
        onChange={form.setIdentifier}
        error={identifier === undefined ? undefined : IDENTIFIER_ERRORS[identifier]}
        isInvalid={isWrong}
      />
      <TextField
        ref={form.passwordRef}
        label={texts.login.password}
        type={form.isPasswordShown ? "text" : "password"}
        autoComplete="current-password"
        value={form.password}
        onChange={form.setPassword}
        error={password === undefined ? undefined : PASSWORD_ERRORS[password]}
        isInvalid={isWrong}
        action={{
          label: form.isPasswordShown ? texts.login.hidePassword : texts.login.showPassword,
          isPressed: form.isPasswordShown,
          onClick: form.togglePasswordShown,
        }}
      />
    </>
  );
}

/** The sign-in card, as on the owner's capture: logo, title, two fields, one action. */
export function LoginScreen(): ReactElement {
  const titleId = useId();
  const form = useLoginForm();
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.intro}>
          <ShopLogo size="auth" />
          <h1 id={titleId} className={styles.title}>
            {texts.login.title}
          </h1>
          <p className={styles.subtitle}>{texts.login.subtitle}</p>
        </div>
        <form className={styles.form} aria-labelledby={titleId} noValidate onSubmit={form.submit}>
          <LoginNoticeBlock form={form} />
          <LoginFields form={form} />
          <Button type="submit" isDisabled={form.isSending} isBusy={form.isSending}>
            {texts.login.submit}
          </Button>
          <p role="status" className={visuallyHidden.visuallyHidden}>
            {form.isSending ? texts.login.sending : ""}
          </p>
        </form>
      </div>
    </main>
  );
}
