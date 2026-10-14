import type { ReactElement } from "react";
import { Redirect, Route, Switch } from "wouter";

import { Notice } from "../../../components/notice/notice";
import { texts } from "../../../i18n/texts";
import { AdminShell } from "../../../layout/admin-shell";
import { AuthSkeleton } from "../../../layout/auth-skeleton/auth-skeleton";
import { NotFound } from "../../../layout/not-found/not-found";
import {
  CATALOGUE_NEW_PATH,
  CATALOGUE_PATH,
  CATALOGUE_PRODUCT_PATTERN,
  HOME_PATH,
  LOGIN_PATH,
  ORDER_PATH_PATTERN,
  ORDERS_PATH,
  RESELLER_PATTERN,
  RESELLERS_NEW_PATH,
  RESELLERS_PATH,
  SETTINGS_PATH,
  SETTINGS_TEXTS_PATH,
} from "../../../routes";
import { CatalogueScreen } from "../../catalogue/components/catalogue-screen";
import {
  EditProductScreen,
  NewProductScreen,
} from "../../catalogue/components/product-form-screen";
import { CatalogueFlashProvider } from "../../catalogue/notice/catalogue-flash";
import { OrderDetailScreen } from "../../order-detail/components/order-detail-screen";
import { OrdersScreen } from "../../orders/components/orders-screen";
import {
  EditResellerScreen,
  NewResellerScreen,
} from "../../resellers/components/reseller-form-screen";
import { ResellersScreen } from "../../resellers/components/resellers-screen";
import { SettingsFeesScreen, SettingsTextsScreen } from "../../settings/components/settings-screen";
import { useSession } from "../hooks/use-session";

import styles from "./protected-area.module.css";

/**
 * Every address except the sign-in, the unknown ones included: nothing is shown, not even "not
 * found", to someone who is not signed in. Without a session the person goes to the sign-in,
 * and the page they asked for is not remembered (no `next` parameter).
 */
export function ProtectedArea(): ReactElement {
  const session = useSession();
  switch (session.status) {
    case "loading":
      return <AuthSkeleton />;
    case "anonymous":
      return <Redirect to={LOGIN_PATH} replace />;
    case "failed":
      // Not known to be signed out: no redirect, the person may simply be offline.
      return (
        <main className={styles.failure}>
          <Notice tone="error" action={{ label: texts.common.retry, onClick: session.retry }}>
            {texts.login.failure}
          </Notice>
        </main>
      );
    case "authenticated":
      return (
        <CatalogueFlashProvider>
          <AdminShell>
            <Switch>
              <Route path={HOME_PATH}>
                <Redirect to={ORDERS_PATH} replace />
              </Route>
              <Route path={ORDERS_PATH} component={OrdersScreen} />
              <Route path={ORDER_PATH_PATTERN} component={OrderDetailScreen} />
              <Route path={CATALOGUE_PATH} component={CatalogueScreen} />
              <Route path={CATALOGUE_NEW_PATH} component={NewProductScreen} />
              <Route path={CATALOGUE_PRODUCT_PATTERN} component={EditProductScreen} />
              <Route path={RESELLERS_PATH} component={ResellersScreen} />
              <Route path={RESELLERS_NEW_PATH} component={NewResellerScreen} />
              <Route path={RESELLER_PATTERN} component={EditResellerScreen} />
              <Route path={SETTINGS_PATH} component={SettingsFeesScreen} />
              <Route path={SETTINGS_TEXTS_PATH} component={SettingsTextsScreen} />
              <Route component={NotFound} />
            </Switch>
          </AdminShell>
        </CatalogueFlashProvider>
      );
  }
}
