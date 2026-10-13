import { render, screen } from "@testing-library/react";

import { App } from "../../app";
import { texts } from "../../i18n/texts";
import { jsonResponse, ROUTES, stubApi } from "../stubs/stub-api";
import type { ApiStub } from "../stubs/stub-api";

const PROFILE = {
  id: "6f1c2d4e-8a3b-4c5d-9e7f-1a2b3c4d5e6f",
  email: "gerante@example.mg",
  displayName: "Hery Rakoto",
};

/** The application at an address, signed in, with the API stubbed at the network. */
export async function openAt(
  path: string,
  heading: string,
  handlers: Parameters<typeof stubApi>[0],
): Promise<ApiStub> {
  window.history.replaceState(null, "", path);
  const api = stubApi({ [ROUTES.me]: () => jsonResponse(PROFILE), ...handlers });
  render(<App />);
  await screen.findByRole("heading", { name: heading });
  return api;
}

/** The application on the catalogue screen, signed in, with the API stubbed at the network. */
export function openCatalogue(handlers: Parameters<typeof stubApi>[0]): Promise<ApiStub> {
  return openAt("/catalogue", texts.catalogue.title, handlers);
}
