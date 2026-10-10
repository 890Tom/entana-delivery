import type { ReactElement } from "react";
import { Route, Switch } from "wouter";

import { CartScreen } from "./features/cart/cart-screen/cart-screen";
import { CartProvider } from "./features/cart/cart-provider";
import { Catalogue } from "./features/catalogue/catalogue";
import { texts } from "./i18n/texts";
import { AppShell } from "./layout/app-shell";
import { NotFound } from "./layout/not-found/not-found";
import { useDocumentTitle } from "./layout/document-title/use-document-title";
import { CART_PATH } from "./routes";

function CataloguePage(): ReactElement {
  useDocumentTitle(texts.catalogue.title);
  return <Catalogue />;
}

export function App(): ReactElement {
  return (
    <CartProvider>
      <AppShell>
        <Switch>
          <Route path="/" component={CataloguePage} />
          <Route path={CART_PATH} component={CartScreen} />
          <Route component={NotFound} />
        </Switch>
      </AppShell>
    </CartProvider>
  );
}
