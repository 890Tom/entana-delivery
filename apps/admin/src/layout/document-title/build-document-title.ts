import { texts } from "../../i18n/texts";

const SEPARATOR = " — ";

/** "{screen} — Administration — {shop}", each missing part left out with its separator. */
export function buildDocumentTitle(screenTitle: string | null, shopName: string | null): string {
  return [screenTitle, texts.document.title, shopName]
    .filter((part): part is string => part !== null)
    .join(SEPARATOR);
}
