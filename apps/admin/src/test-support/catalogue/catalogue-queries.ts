import { screen } from "@testing-library/react";

import { texts } from "../../i18n/texts";
import { jsonResponse } from "../stubs/stub-api";

/** The answer of the list: every product the shop has, retired ones included. */
export const list = (...products: readonly object[]): Response => jsonResponse({ products });

/** The row of the table that shows a product, found by its name. */
export function rowOf(name: string): HTMLElement {
  const row = screen.getByText(name, { selector: "span" }).closest("tr");
  if (row === null) {
    throw new Error(`no row for ${name}`);
  }
  return row;
}

export const handleOf = (name: string, position: number, total: number): HTMLElement =>
  screen.getByRole("button", { name: texts.catalogue.row.handle(name, position, total) });

/** The body a call sent, read back as the JSON it is. */
export const bodyOf = (init: RequestInit | undefined): unknown =>
  typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : null;

/** The names of the rows, in the order of the table. */
export const namesInOrder = (): string[] =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => (row as HTMLTableRowElement).cells[2]?.firstElementChild?.textContent ?? "");
