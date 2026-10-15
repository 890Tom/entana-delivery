import type { ReactElement } from "react";

import { Notice } from "../../../components/notice/notice";
import { texts } from "../../../i18n/texts";
import type { SettingsNotice } from "./use-settings-form";

const t = texts.settings.notices;

const ERROR_TEXT: Readonly<Record<Exclude<SettingsNotice, "saved">, string>> = {
  invalid: t.invalid,
  rateLimited: t.rateLimited,
  failed: t.failed,
};

/** The end of a save: a confirmation announced politely, or an error that is already an alert. */
export function SettingsNoticeView({
  notice,
}: {
  notice: SettingsNotice | null;
}): ReactElement | null {
  if (notice === null) {
    return null;
  }
  return notice === "saved" ? (
    <div role="status">
      <Notice tone="info">{t.saved}</Notice>
    </div>
  ) : (
    <Notice tone="error">{ERROR_TEXT[notice]}</Notice>
  );
}
