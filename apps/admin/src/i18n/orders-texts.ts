// The texts of the orders list: apart from the others to keep each file short. The texts that
// no source gives (captures, design system sheet, prototype) carry « À confirmer ».
export const ordersTexts = {
  title: "Commandes",
  navLabel: "Sections",
  summary: (toProcessCount: number, todayCount: number): string =>
    `${String(toProcessCount)} à traiter · ${String(todayCount)} aujourd'hui`,
  loading: "Chargement des commandes…",
  loadFailed: "Les commandes n'ont pas pu être chargées. Vérifiez la connexion.",
  searchInvalid: "Cette recherche n'est pas valide : saisissez un nom, ou des chiffres seulement.",
  tabsLabel: "Filtrer par statut",
  tabs: {
    all: "Toutes",
    toProcess: "À traiter",
    confirmed: "Confirmées",
    outForDelivery: "En livraison",
    delivered: "Livrées",
    closed: "Refusées ou annulées",
  },
  // À confirmer : absent des sources
  filtersLabel: "Filtres",
  // À confirmer : absent des sources
  filtersHint:
    "L'axe et la date filtrent le tableau. La recherche (2 caractères minimum) filtre aussi les cartes « À traiter ».",
  // À confirmer : absent des sources
  zoneLabel: "Zone (axe)",
  allZones: "Toutes",
  // À confirmer : absent des sources
  inactiveAxis: (name: string): string => `${name} (inactif)`,
  // À confirmer : absent des sources
  outsideAxis: "Hors axe",
  // À confirmer : absent des sources
  dateLabel: "Reçue ou à livrer le",
  allDates: "Toutes les dates",
  today: (day: string): string => `Aujourd'hui, ${day}`,
  yesterday: (day: string): string => `Hier, ${day}`,
  // À confirmer : absent des sources
  searchLabel: "Client (nom ou téléphone)",
  searchPlaceholder: "Nom ou téléphone",
  toProcessTitle: "À traiter",
  allHandled: "Tout est traité pour le moment.",
  otherTitle: "Autres commandes",
  noMatch: "Aucune commande ne correspond.",
  receivedAt: (time: string): string => `reçue à ${time}`,
  isNewCustomer: "Nouveau",
  articles: (count: number): string => (count === 1 ? "1 article" : `${String(count)} articles`),
  process: "Traiter",
  processLabel: (code: string): string => `Traiter la commande #${code}`,
  showMore: (count: number): string => `Afficher ${String(count)} de plus`,
  pagination: {
    label: "Pages des commandes",
    previous: "Précédent",
    next: "Suivant",
    page: (current: number, count: number): string =>
      `Page ${String(current)} sur ${String(count)}`,
  },
  remaining: (count: number): string =>
    count === 1 ? "1 autre à traiter" : `${String(count)} autres à traiter`,
  columns: {
    selectAll: "Tout sélectionner",
    order: "Commande",
    customer: "Client",
    zone: "Zone",
    total: "Total",
    status: "Statut",
    action: "Action",
  },
  selectRow: (code: string, name: string): string => `Sélectionner la commande #${code}, ${name}`,
  status: {
    confirmed: "Confirmée",
    confirmedOn: (day: string): string => `Confirmée · ${day}`,
    outForDelivery: "En livraison",
    delivered: "Livrée",
    rejected: "Refusée",
    cancelled: "Annulée",
    failed: "Échec",
  },
  actions: {
    outForDelivery: "En livraison",
    delivered: "Livrée",
    open: "Ouvrir",
    outForDeliveryLabel: (code: string): string => `Passer la commande #${code} en livraison`,
    deliveredLabel: (code: string): string => `Marquer la commande #${code} livrée`,
    openLabel: (code: string): string => `Ouvrir la commande #${code}`,
  },
  banner: {
    one: (code: string, name: string): string => `1 nouvelle commande · #${code} ${name}`,
    many: (count: number): string => `${String(count)} nouvelles commandes`,
    show: "Afficher",
  },
  conflict: "Cette commande a changé de statut. La liste a été mise à jour.",
  actionFailed: "La commande n'a pas pu être mise à jour. Réessayez.",
  selection: {
    region: "Actions sur la sélection",
    count: (count: number): string =>
      count === 1 ? "1 commande sélectionnée" : `${String(count)} commandes sélectionnées`,
    startDelivery: (count: number): string =>
      count === 1
        ? "Passer 1 commande en livraison"
        : `Passer ${String(count)} commandes en livraison`,
    markDelivered: (count: number): string =>
      count === 1 ? "Marquer 1 commande livrée" : `Marquer ${String(count)} commandes livrées`,
    cancel: "Annuler la sélection",
    partial: (done: number, failed: number): string =>
      `${String(done)} ${done === 1 ? "commande mise" : "commandes mises"} à jour, ` +
      `${String(failed)} ${failed === 1 ? "n'a" : "n'ont"} pas pu l'être (statut modifié ou erreur).`,
  },
};
