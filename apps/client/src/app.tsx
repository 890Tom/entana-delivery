import type { ReactElement } from "react";
import { Route, Switch } from "wouter";

import { CartScreen } from "./features/cart/cart-screen/cart-screen";
import { CartProvider } from "./features/cart/cart-provider";
import { Catalogue } from "./features/catalogue/catalogue";
import { ContactDraftProvider } from "./features/contact/contact-draft/contact-draft-provider";
import { ContactScreen } from "./features/contact/contact-screen";
import { DeliveryDraftProvider } from "./features/delivery/delivery-draft/delivery-draft-provider";
import { DeliveryScreen } from "./features/delivery/delivery-screen";
import { texts } from "./i18n/texts";
import { AppShell } from "./layout/app-shell";
import { NotFound } from "./layout/not-found/not-found";
import { useDocumentTitle } from "./layout/document-title/use-document-title";
import { CART_PATH, CONTACT_PATH, DELIVERY_PATH } from "./routes";

function CataloguePage(): ReactElement {
  useDocumentTitle(texts.catalogue.title);
  return <Catalogue />;
}

export function App(): ReactElement {
  return (
    <CartProvider>
      <DeliveryDraftProvider>
        <ContactDraftProvider>
          <AppShell>
            <Switch>
              <Route path="/" component={CataloguePage} />
              <Route path={CART_PATH} component={CartScreen} />
              <Route path={DELIVERY_PATH} component={DeliveryScreen} />
              <Route path={CONTACT_PATH} component={ContactScreen} />
              <Route component={NotFound} />
            </Switch>
          </AppShell>
        </ContactDraftProvider>
      </DeliveryDraftProvider>
    </CartProvider>
  );
}
