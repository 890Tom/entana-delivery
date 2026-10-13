// The texts of the resellers screens: apart from the others to keep each file short. The texts
// that the owner's captures and the design system sheet do not give are marked "to confirm".
const plural = (count: number): string => (count >= 2 ? "s" : "");

export const resellersTexts = {
  title: "Revendeurs",
  count: (count: number): string => `${String(count)} revendeur${plural(count)}`,
  staleCount: (count: number): string => `${String(count)} à vérifier`,
  add: "Ajouter un revendeur",
  loading: "Chargement des revendeurs…",
  loadFailed: "Les revendeurs n'ont pas pu être chargés. Vérifiez la connexion.",
  tabsLabel: "Filtrer les revendeurs",
  tabs: { all: "Tous", active: "Actifs", inactive: "Inactifs", stale: "À vérifier" },
  searchLabel: "Rechercher un nom ou un quartier",
  searchPlaceholder: "Nom ou quartier",
  tableLabel: "Revendeurs",
  columns: {
    reseller: "Revendeur",
    neighborhood: "Quartier",
    verification: "Dernière vérification",
    visible: "Visible",
  },
  banner: {
    one: "1 revendeur n'a pas été vérifié depuis plus de 90 jours.",
    many: (count: number): string =>
      `${String(count)} revendeurs n'ont pas été vérifiés depuis plus de 90 jours.`,
    show: "Les afficher",
  },
  footnote:
    "Un revendeur apparaît sur la carte client seulement s'il est visible, avec son accord et une position.",
  row: {
    edit: (name: string): string => `Modifier ${name}`,
    yes: "Oui",
    no: "Non",
    switchLabel: (name: string): string => `Visible sur la carte client : ${name}`,
    consentPending: "Accord à confirmer",
    // "À vérifier" alone for a reseller that was never verified.
    stale: (months: number | null): string =>
      months === null ? "À vérifier" : `À vérifier · ${String(months)} mois`,
    today: "aujourd'hui",
    yesterday: "hier",
    daysAgo: (days: number): string => `il y a ${String(days)} jours`,
  },
  notices: {
    // To confirm: the texts of the owner's design sheet, kept as they are.
    notPublishable: (name: string): string =>
      `Impossible de publier ${name} : son accord n'est pas confirmé.`,
    openSheet: "Ouvrir la fiche",
    changeFailed: "Le changement n'a pas pu être enregistré. Réessayez.",
  },
  empty: {
    none: "Aucun revendeur pour le moment.",
    emptyList: "Aucun revendeur dans cette liste.",
    noMatch: (term: string): string => `Aucun revendeur ne correspond à « ${term} ».`,
    showAll: "Tout afficher",
  },
  form: {
    back: "Revendeurs",
    newTitle: "Nouveau revendeur",
    // Page shown for an id that the list does not hold: the shared "not found" page is used.
    status: { visible: "Visible", hidden: "Non visible" },
    information: {
      title: "Informations",
      name: "Nom",
      namePlaceholder: "Ex. Épicerie Soa",
      neighborhood: "Quartier",
      neighborhoodPlaceholder: "Ex. Analakely",
      landmark: "Repère pour la trouver",
      landmarkPlaceholder: "Ex. Face à la pharmacie, portail vert",
    },
    publication: {
      title: "Publication",
      consent: "J'ai l'accord du revendeur pour publier ses coordonnées",
      consentLockedHelp: "Retirez d'abord la visibilité pour décocher l'accord.",
      visible: "Visible sur la carte client",
      visibleLockedHelp: "Cochez l'accord pour publier.",
      visibleHelp: "Nécessite l'accord et une position.",
      yes: "Oui",
      no: "Non",
    },
    verification: {
      never: "Pas encore vérifié",
      verifiedOn: (date: string): string => `Vérifié le ${date}`,
      newHelp: "Il sera marqué vérifié aujourd'hui à la création.",
      today: "Aujourd'hui.",
      daysAgo: (days: number): string => `Il y a ${String(days)} jours.`,
      staleHelp: "Il y a plus de 90 jours : appelez le revendeur pour confirmer.",
      mark: "Marquer comme vérifié aujourd'hui",
      marked: "Le revendeur est marqué vérifié aujourd'hui.",
    },
    map: {
      title: "Position sur la carte",
      label: "Carte : position du revendeur",
      markerLabel: "Position du revendeur",
      canvasLabel: "Carte",
      zoomIn: "Zoom avant",
      zoomOut: "Zoom arrière",
      toggleAttribution: "Afficher les crédits de la carte",
      failed: "La carte n'a pas pu être chargée. La position reste modifiable ci-dessous.",
      helpNew: "Cliquez sur la carte pour placer le pin.",
      helpEdit: "Cliquez sur la carte ou faites glisser le pin.",
      latitude: "Latitude",
      latitudePlaceholder: "Ex. -18,9097",
      longitude: "Longitude",
      longitudePlaceholder: "Ex. 47,5236",
    },
    buttons: {
      create: "Créer le revendeur",
      save: "Enregistrer",
      cancel: "Annuler",
      delete: "Supprimer",
    },
    errors: {
      name: "Indiquez le nom du revendeur.",
      neighborhood: "Indiquez le quartier.",
      landmark: "Indiquez le repère.",
      latitude: "Indiquez la latitude (de -90 à 90) ou placez le pin sur la carte.",
      longitude: "Indiquez la longitude (de -180 à 180) ou placez le pin sur la carte.",
      summaryOne: "Un champ est à corriger. Votre saisie est gardée.",
      summaryMany: (count: number): string =>
        `${String(count)} champs sont à corriger. Votre saisie est gardée.`,
      notPublishable:
        "Impossible de publier : l'accord du revendeur doit être confirmé pour le rendre visible.",
    },
    notices: {
      saveFailed: "Le revendeur n'a pas pu être enregistré. Votre saisie est gardée. Réessayez.",
      verifyFailed: "La vérification n'a pas pu être enregistrée. Réessayez.",
      deleteFailed: "Le revendeur n'a pas pu être supprimé. Réessayez.",
      gone: "Ce revendeur n'existe plus. La liste a été mise à jour.",
    },
    dialog: {
      title: (name: string): string => `Supprimer « ${name} » ?`,
      body: "Cette suppression est définitive : le revendeur disparaît de la liste et de la carte client, et ne peut pas être récupéré.",
      cancel: "Garder",
      confirm: "Supprimer",
    },
  },
} as const;
