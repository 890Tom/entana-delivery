/** The one message of a screen of the catalogue: an information, or an error that stays. */
export interface CatalogueNotice {
  readonly tone: "info" | "error";
  readonly text: string;
}
