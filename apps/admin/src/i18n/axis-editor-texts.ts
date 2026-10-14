import { MAX_PLACES_PER_AXIS } from "@entana/contracts";

// The texts of the screen of one axis. The texts that the owner's capture does not give are
// marked "to confirm".
export const axisEditorTexts = {
  back: "Axes",
  newTitle: "Nouvel axe",
  // To confirm.
  loadFailed: "L'axe n'a pas pu être chargé. Vérifiez la connexion.",
  name: "Nom de l'axe",
  namePlaceholder: "Ex. Axe Nord",
  // To confirm.
  nameEmpty: "Indiquez un nom pour cet axe.",
  nameTaken: "Un axe porte déjà ce nom. Choisissez-en un autre.",
  // To confirm: the field is not on the capture.
  color: "Couleur",
  places: {
    title: "Lieux de l'axe, dans l'ordre",
    // To confirm.
    empty: "Aucun lieu pour le moment. Recherchez un lieu existant.",
    // To confirm.
    none: "Ajoutez au moins un lieu.",
    alsoIn: (axes: readonly string[]): string => `Aussi dans ${axes.join(", ")}.`,
    inactive: "Inactif",
    // To confirm.
    handle: (name: string, position: number, total: number): string =>
      `Déplacer ${name}, position ${String(position)} sur ${String(total)}.`,
    // To confirm.
    remove: (name: string): string => `Retirer ${name} de l'axe`,
    // To confirm: what assistive technology says during a move.
    drag: {
      instructions:
        "Pour déplacer ce lieu, appuyez sur Espace, puis sur les flèches haut et bas, et enfin sur Espace pour le déposer. Échap annule.",
      picked: (name: string, position: number, total: number): string =>
        `${name} saisi, position ${String(position)} sur ${String(total)}.`,
      moved: (name: string, position: number, total: number): string =>
        `${name} déplacé en position ${String(position)} sur ${String(total)}.`,
      dropped: (name: string, position: number, total: number): string =>
        `${name} déposé en position ${String(position)} sur ${String(total)}.`,
      cancelled: "Déplacement annulé.",
    },
  },
  search: {
    label: "Rechercher un lieu à ajouter",
    // To confirm: the name of the list of results.
    results: "Lieux existants",
    // To confirm.
    noResult: (search: string): string => `Aucun lieu ne s'appelle « ${search} ».`,
    // To confirm.
    full: `${String(MAX_PLACES_PER_AXIS)} lieux au maximum.`,
  },
  active: "Axe actif",
  yes: "Oui",
  no: "Non",
  priority: "Un lieu peut être dans plusieurs axes : l'axe du haut dans la liste s'applique.",
  save: "Enregistrer",
  cancel: "Annuler",
  delete: "Supprimer…",
  notices: {
    // To confirm.
    placeUnavailable: "Ce lieu n'est plus disponible. La liste des lieux a été rechargée.",
    // To confirm.
    inUse: "Cet axe est lié à des commandes : désactivez-le plutôt.",
    // To confirm.
    gone: "Cet axe n'existe plus. Revenez à la liste.",
    // To confirm.
    deleteFailed: "L'axe n'a pas pu être supprimé. Réessayez.",
  },
  dialog: {
    title: (name: string): string => `Supprimer « ${name} » ?`,
    body: "Les lieux de l'axe sont conservés.",
    cancel: "Garder l'axe",
    confirm: "Supprimer",
  },
  map: {
    title: "Carte de l'axe",
    // To confirm: the name of the map for assistive technology.
    label: "Carte de l'axe.",
    legend: "Les cercles gris en pointillé sont les lieux existants.",
  },
} as const;
