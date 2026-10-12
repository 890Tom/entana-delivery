import { useQueryClient } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

import { Notice } from "../components/notice/notice";
import { postLogout } from "../features/session/api/session-calls";
import { texts } from "../i18n/texts";
import { LOGIN_PATH } from "../routes";

import styles from "./admin-shell.module.css";
import { Header } from "./header/header";

interface Logout {
  readonly isLoggingOut: boolean;
  readonly hasFailed: boolean;
  readonly logout: () => void;
}

/** Ends the session on the server, then drops everything held in memory and leaves. */
function useLogout(): Logout {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const logout = (): void => {
    setIsLoggingOut(true);
    setHasFailed(false);
    void postLogout().then((result) => {
      if (result.kind === "ok") {
        // The session still exists on the server after a failure, so the person stays here.
        queryClient.clear();
        navigate(LOGIN_PATH, { replace: true });
        return;
      }
      setIsLoggingOut(false);
      setHasFailed(true);
    });
  };
  return { isLoggingOut, hasFailed, logout };
}

/** The page of a signed-in person: banner, then one main area that takes the focus on arrival. */
export function AdminShell({ children }: { children: ReactNode }): ReactElement {
  const { isLoggingOut, hasFailed, logout } = useLogout();
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.focus();
  }, []);
  return (
    <>
      <Header isLoggingOut={isLoggingOut} onLogout={logout} />
      <main ref={mainRef} tabIndex={-1} className={styles.main}>
        {hasFailed && <Notice tone="error">{texts.home.logoutFailed}</Notice>}
        {children}
      </main>
    </>
  );
}
