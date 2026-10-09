import type { ReactElement } from "react";
import { Link } from "wouter";

import { texts } from "../../i18n/texts";
import { useDocumentTitle } from "../use-document-title";

import styles from "./not-found.module.css";

export function NotFound(): ReactElement {
  useDocumentTitle(texts.notFound.title);
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{texts.notFound.title}</h1>
      <p className={styles.message}>{texts.notFound.message}</p>
      <Link href="/" className={styles.back}>
        {texts.notFound.back}
      </Link>
    </div>
  );
}
