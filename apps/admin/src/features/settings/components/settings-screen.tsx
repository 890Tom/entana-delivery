import type { DeliverySettings } from "@entana/contracts";
import type { ReactElement } from "react";

import { Notice } from "../../../components/notice/notice";
import { TabLinks } from "../../../components/tab-links/tab-links";
import { texts } from "../../../i18n/texts";
import { SETTINGS_PATH, SETTINGS_TEXTS_PATH } from "../../../routes";
import { useSettings } from "../hooks/use-settings";

import { FeesForm } from "./fees-form";
import styles from "./settings-screen.module.css";
import { SettingsSkeleton } from "./settings-skeleton";
import { TextsForm } from "./texts-form";

const t = texts.settings;

const TABS = [
  { href: SETTINGS_PATH, label: t.tabs.fees },
  { href: SETTINGS_TEXTS_PATH, label: t.tabs.texts },
] as const;

/** The title, the tabs, then the form of the tab once the settings are loaded. */
function SettingsPage({
  renderForm,
}: {
  renderForm: (settings: DeliverySettings) => ReactElement;
}): ReactElement {
  const model = useSettings();
  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>{t.title}</h1>
      <TabLinks label={t.tabsLabel} links={TABS} />
      {model.settings !== undefined ? (
        renderForm(model.settings)
      ) : model.hasFailed ? (
        <Notice tone="error" action={{ label: texts.common.retry, onClick: model.retry }}>
          {t.loadFailed}
        </Notice>
      ) : (
        <SettingsSkeleton />
      )}
    </div>
  );
}

/** The tab "Axes et frais": for now, the card "Hors axe" only. */
export function SettingsFeesScreen(): ReactElement {
  return <SettingsPage renderForm={(settings) => <FeesForm settings={settings} />} />;
}

/** The tab "Textes": the message shown outside every axis, with its preview. */
export function SettingsTextsScreen(): ReactElement {
  return <SettingsPage renderForm={(settings) => <TextsForm settings={settings} />} />;
}
