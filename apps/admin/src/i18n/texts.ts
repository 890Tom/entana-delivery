// Fixed French texts. No text ever comes from the server: every message depends on the kind of
// answer only, so that a response cannot put words in the interface.
export const texts = {
  common: {
    loading: "Chargement…",
    retry: "Réessayer",
  },
  document: {
    title: "Administration",
    titleWithShop: (shopName: string): string => `Administration — ${shopName}`,
  },
  login: {
    title: "Connexion",
    subtitle: "Espace réservé à l'équipe",
    logoFallback: "Administration",
    identifier: "Identifiant",
    password: "Mot de passe",
    showPassword: "Afficher",
    hidePassword: "Masquer",
    submit: "Se connecter",
    sending: "Connexion en cours…",
    identifierRequired: "Indiquez votre identifiant.",
    identifierInvalid: "Saisissez une adresse e-mail valide.",
    passwordRequired: "Indiquez votre mot de passe.",
    passwordTooLong: "Le mot de passe est trop long (128 caractères au maximum).",
    wrongCredentials: "Identifiant ou mot de passe incorrect.",
    rateLimited: "Trop de tentatives. Réessayez dans quelques minutes.",
    failure: "Connexion impossible. Vérifiez votre connexion.",
    sessionExpired: "Votre session a expiré. Reconnectez-vous.",
  },
  home: {
    title: "Tableau de bord",
    welcome: (displayName: string): string => `Bonjour ${displayName}`,
    logout: "Se déconnecter",
    logoutFailed: "Déconnexion impossible. Réessayez.",
  },
  notFound: {
    title: "Page introuvable",
    message: "Cette page n'existe pas.",
    back: "Retour à l'accueil",
  },
} as const;
