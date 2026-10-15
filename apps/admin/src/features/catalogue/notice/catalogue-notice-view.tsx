import type { ReactElement } from "react";

import { Notice } from "../../../components/notice/notice";
import type { CatalogueNotice } from "./catalogue-notice";

/** The message of a screen: an information is announced politely, an error already is an alert. */
export function CatalogueNoticeView({
  notice,
}: {
  notice: CatalogueNotice | null;
}): ReactElement | null {
  if (notice === null) {
    return null;
  }
  return notice.tone === "info" ? (
    <div role="status">
      <Notice tone="info">{notice.text}</Notice>
    </div>
  ) : (
    <Notice tone="error">{notice.text}</Notice>
  );
}
