import type { ReactElement } from "react";

import { Catalogue } from "./features/catalogue/catalogue";
import { texts } from "./i18n/texts";

export function App(): ReactElement {
  return (
    <>
      <h1>{texts.appTitle}</h1>
      <Catalogue />
    </>
  );
}
