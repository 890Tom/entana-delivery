/** The state of the network, as the browser knows it. */
export interface ConnectionTexts {
  readonly offline: string;
}

// To confirm: no source for this text yet.
export const connectionTexts: ConnectionTexts = {
  offline: "Vous êtes hors ligne. Le catalogue et les commandes ont besoin d'une connexion.",
};
