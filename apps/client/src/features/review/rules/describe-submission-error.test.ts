import { describe, expect, it } from "vitest";

import { buildProduct, buildProductId } from "../../../test-support/build-product";
import type { OrderSubmissionError } from "../../order-submission/order-submission-types";

import { describeSubmissionError } from "./describe-submission-error";
import type { ErrorAction } from "./describe-submission-error";

const RETRY: ErrorAction = { kind: "retry" };
const NONE: ErrorAction = { kind: "none" };
const UNEXPECTED = "Une erreur est survenue. Réessayez.";
const TO_FIX = "Certaines informations sont à corriger.";
const CONNECTION = "L'envoi a échoué. Vérifiez votre connexion et réessayez.";
const UNAVAILABLE = "Le service est momentanément indisponible. Réessayez.";

const CATALOGUE = [
  buildProduct({ id: buildProductId(1), name: "Sakafo" }),
  buildProduct({ id: buildProductId(2), name: "Mofo" }),
];

const CASES: readonly (readonly [string, OrderSubmissionError, string, ErrorAction])[] = [
  ["offline", { type: "offline" }, "Pas de connexion. Votre commande n'est pas envoyée.", RETRY],
  ["network", { type: "network" }, CONNECTION, RETRY],
  ["timeout", { type: "timeout" }, CONNECTION, RETRY],
  [
    "rate_limited",
    { type: "rate_limited" },
    "Trop de tentatives. Réessayez dans quelques minutes.",
    RETRY,
  ],
  ["service_unavailable", { type: "service_unavailable" }, UNAVAILABLE, RETRY],
  ["server", { type: "server" }, UNAVAILABLE, RETRY],
  [
    "unconfirmed",
    { type: "unconfirmed" },
    "Nous n'avons pas pu confirmer votre commande. Elle a peut-être été enregistrée : réessayez, aucun doublon ne sera créé.",
    RETRY,
  ],
  [
    "order_too_large",
    { type: "order_too_large" },
    "Votre commande est trop importante pour être envoyée en ligne. Contactez la boutique.",
    NONE,
  ],
  [
    "blocked",
    { type: "blocked" },
    "Nous ne pouvons pas enregistrer cette commande. Contactez la boutique.",
    NONE,
  ],
  [
    "conflict",
    { type: "conflict" },
    "Une commande avec ces informations existe peut-être déjà. Contactez la boutique avant de recommencer.",
    NONE,
  ],
  ["unexpected", { type: "unexpected" }, UNEXPECTED, RETRY],
  [
    "validation on the phone",
    { type: "validation", fields: ["phone", "items"] },
    TO_FIX,
    { kind: "link", href: "/coordonnees", label: "Modifier" },
  ],
  [
    "validation on the note",
    { type: "validation", fields: ["customerNote"] },
    TO_FIX,
    { kind: "link", href: "/coordonnees", label: "Modifier" },
  ],
  [
    "invalid draft on the landmark",
    { type: "invalid_draft", fields: ["landmarkText"] },
    TO_FIX,
    { kind: "link", href: "/livraison", label: "Modifier" },
  ],
  [
    "validation on the location",
    { type: "validation", fields: ["location"] },
    TO_FIX,
    { kind: "link", href: "/livraison", label: "Modifier" },
  ],
  [
    "validation on the items",
    { type: "validation", fields: ["items"] },
    TO_FIX,
    { kind: "link", href: "/panier", label: "Modifier" },
  ],
  ["validation with no known field", { type: "validation", fields: [] }, UNEXPECTED, RETRY],
  [
    "unavailable products with their names",
    { type: "unavailable_products", productIds: [buildProductId(1), buildProductId(2)] },
    "Certains produits ne sont plus disponibles : Sakafo, Mofo.",
    { kind: "link", href: "/panier", label: "Voir le panier" },
  ],
  [
    "unavailable products, one id unknown",
    { type: "unavailable_products", productIds: [buildProductId(9), buildProductId(2)] },
    "Certains produits ne sont plus disponibles : Mofo.",
    { kind: "link", href: "/panier", label: "Voir le panier" },
  ],
  [
    "unavailable products, no name known",
    { type: "unavailable_products", productIds: [buildProductId(9)] },
    "Certains produits ne sont plus disponibles.",
    { kind: "link", href: "/panier", label: "Voir le panier" },
  ],
];

describe("describeSubmissionError", () => {
  it.each(CASES)("words %s", (_label, error, message, action) => {
    expect(describeSubmissionError(error, CATALOGUE)).toEqual({ message, action });
  });
});
