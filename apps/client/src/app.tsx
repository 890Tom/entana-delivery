import type { ReactElement } from "react";

import { Catalogue } from "./catalogue/catalogue";
import { texts } from "./texts";

export function App(): ReactElement {
  return (
    <>
      <h1>{texts.appTitle}</h1>
      <Catalogue />
    </>
  );
}
