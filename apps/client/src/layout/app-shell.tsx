import type { ReactElement, ReactNode, RefObject } from "react";
import { useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";

import { STEP_BY_PATH } from "../routes";

import { CartPanel } from "../features/cart/cart-panel/cart-panel";

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

/** The permanent structure of every page: banner, the steps of the order, one main area, and the side cart beside the catalogue. */
export function AppShell({ children }: { children: ReactNode }): ReactElement {
  const mainRef = useFocusOnNavigation();
  const [isCatalogue] = useRoute("/");
  const [location] = useLocation();
  const step = STEP_BY_PATH[location];
  return (
    <>
      <Header />
      {step === undefined ? null : <StepIndicator current={step} />}
      {/* The side cart is a complementary area: a sibling of main, not inside it. */}
      <div className={isCatalogue ? styles.withSidebar : undefined}>
        <main ref={mainRef} tabIndex={-1} className={styles.main}>
          {children}
        </main>
        {isCatalogue ? <CartPanel /> : null}
      </div>
    </>
  );
}
