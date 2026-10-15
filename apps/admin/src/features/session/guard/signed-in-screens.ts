import type { ComponentType } from "react";

import { texts } from "../../../i18n/texts";
import {
  CATALOGUE_NEW_PATH,
  CATALOGUE_PATH,
  CATALOGUE_PRODUCT_PATTERN,
  ORDER_PATH_PATTERN,
  ORDERS_PATH,
  RESELLER_PATTERN,
  RESELLERS_NEW_PATH,
  RESELLERS_PATH,
  SETTINGS_AXIS_NEW_PATH,
  SETTINGS_AXIS_PATTERN,
  SETTINGS_PATH,
  SETTINGS_TEXTS_PATH,
} from "../../../routes";
import { CatalogueScreen } from "../../catalogue/catalogue-screen";
import { EditProductScreen, NewProductScreen } from "../../catalogue/product-form-screen";
import { OrderDetailScreen } from "../../order-detail/order-detail-screen";
import { OrdersScreen } from "../../orders/orders-screen";
import { EditResellerScreen, NewResellerScreen } from "../../resellers/reseller-form-screen";
import { ResellersScreen } from "../../resellers/resellers-screen";
import { EditAxisScreen, NewAxisScreen } from "../../settings/axis-editor-screen";
import { SettingsFeesScreen, SettingsTextsScreen } from "../../settings/settings-screen";

interface SignedInScreen {
  readonly path: string;
  readonly component: ComponentType;
  /** The title of the document: never a name, a phone number or an address. */
  readonly title: string;
}

/** The screens of a signed-in person, in the order in which the router tries their paths. */
export const SIGNED_IN_SCREENS: readonly SignedInScreen[] = [
  { path: ORDERS_PATH, component: OrdersScreen, title: texts.orders.title },
  { path: ORDER_PATH_PATTERN, component: OrderDetailScreen, title: texts.orderDetail.loadingTitle },
  { path: CATALOGUE_PATH, component: CatalogueScreen, title: texts.catalogue.title },
  { path: CATALOGUE_NEW_PATH, component: NewProductScreen, title: texts.catalogueForm.newTitle },
  {
    path: CATALOGUE_PRODUCT_PATTERN,
    component: EditProductScreen,
    title: texts.catalogueForm.editTitle,
  },
  { path: RESELLERS_PATH, component: ResellersScreen, title: texts.resellers.title },
  { path: RESELLERS_NEW_PATH, component: NewResellerScreen, title: texts.resellers.form.newTitle },
  { path: RESELLER_PATTERN, component: EditResellerScreen, title: texts.resellers.form.editTitle },
  { path: SETTINGS_PATH, component: SettingsFeesScreen, title: texts.settings.tabs.fees },
  { path: SETTINGS_TEXTS_PATH, component: SettingsTextsScreen, title: texts.settings.tabs.texts },
  {
    path: SETTINGS_AXIS_NEW_PATH,
    component: NewAxisScreen,
    title: texts.settings.axisEditor.newTitle,
  },
  {
    path: SETTINGS_AXIS_PATTERN,
    component: EditAxisScreen,
    title: texts.settings.axisEditor.editTitle,
  },
];
