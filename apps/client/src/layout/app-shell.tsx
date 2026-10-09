import type { ReactElement, ReactNode, RefObject } from "react";
import { useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";

import { Header } from "./header/header";
import styles from "./app-shell.module.css";
import { StepIndicator } from "./step-indicator/step-indicator";

/** After a change of page the focus goes to the main area: the user starts at the new content. */
function useFocusOnNavigation(): RefObject<HTMLElement | null> {
  const [location] = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const previousLocation = useRef(location);
  useEffect(() => {
    if (previousLocation.current !== location) {
      previousLocation.current = location;
      mainRef.current?.focus();
    }
  }, [location]);
  return mainRef;
}

/** The permanent structure of every page: banner, steps (catalogue only), one main area. */
export function AppShell({ children }: { children: ReactNode }): ReactElement {
  const mainRef = useFocusOnNavigation();
  const [isCatalogue] = useRoute("/");
  return (
    <>
      <Header />
      {isCatalogue ? <StepIndicator /> : null}
      <main ref={mainRef} tabIndex={-1} className={styles.main}>
        {children}
      </main>
    </>
  );
}
