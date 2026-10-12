/** How many pages hold `totalCount` orders; an empty list still has its one (empty) page. */
export function countPages(totalCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}
