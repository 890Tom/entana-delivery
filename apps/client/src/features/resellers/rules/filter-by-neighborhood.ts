import type { PublicReseller } from "@entana/contracts";

/** Lower case and no accent: "Ambohijatovo" is found with "AMBOHI" and "Épicerie" with "epi". */
function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .trim();
}

/** The resellers whose neighborhood contains the typed text; all of them when it is blank. */
export function filterByNeighborhood<T extends Pick<PublicReseller, "neighborhood">>(
  resellers: readonly T[],
  query: string,
): readonly T[] {
  const wanted = normalizeForSearch(query);
  if (wanted === "") {
    return resellers;
  }
  return resellers.filter((reseller) => normalizeForSearch(reseller.neighborhood).includes(wanted));
}
