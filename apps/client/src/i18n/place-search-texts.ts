/** The place search above the delivery map: suggestions that place the point like a tap. */
export interface PlaceSearchTexts {
  readonly label: string;
  /** The name of the list of suggestions. */
  readonly results: string;
  readonly clear: string;
  readonly noResult: string;
  readonly failed: string;
}

export const placeSearchTexts: PlaceSearchTexts = {
  label: "Rechercher un lieu",
  results: "Lieux proposés",
  clear: "Effacer la recherche",
  noResult: "Aucun lieu trouvé. Placez le repère directement sur la carte.",
  failed: "La recherche est indisponible. Placez le repère directement sur la carte.",
};
