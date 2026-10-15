/** The notice shown when a new version of the application is ready. */
export interface AppUpdateTexts {
  readonly message: string;
  /** Applies the new version and reloads the page. */
  readonly apply: string;
  /** Hides the notice until the next load. */
  readonly later: string;
}

// To confirm: no source for these texts yet.
export const appUpdateTexts: AppUpdateTexts = {
  message: "Une nouvelle version est disponible.",
  apply: "Mettre à jour",
  later: "Plus tard",
};
