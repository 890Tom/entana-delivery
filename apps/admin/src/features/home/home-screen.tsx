import type { AdminProfile } from "@entana/contracts";
import type { ReactElement } from "react";

import { texts } from "../../i18n/texts";

import styles from "./home-screen.module.css";

/** The provisional home page: who is signed in, nothing else yet. */
export function HomeScreen({ profile }: { profile: AdminProfile }): ReactElement {
  return (
    <>
      <h1 className={styles.title}>{texts.home.title}</h1>
      <p className={styles.welcome}>{texts.home.welcome(profile.displayName)}</p>
    </>
  );
}
