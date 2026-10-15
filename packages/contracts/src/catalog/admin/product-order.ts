/**
 * Whether `ids` is exactly the set of the products that are not retired, each once. A uuid is
 * accepted in both cases, so the comparison is made in lower case. Pure.
 */
export function isCompleteProductOrder(
  ids: readonly string[],
  activeIds: readonly string[],
): boolean {
  const received = new Set(ids.map((id) => id.toLowerCase()));
  if (received.size !== ids.length || ids.length !== activeIds.length) {
    return false;
  }
  return activeIds.every((id) => received.has(id.toLowerCase()));
}
