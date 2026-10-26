import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import { App } from "./app";
import { restoreStoredTheme } from "./features/instance/theme/apply-instance-theme";
import { createQueryClient } from "./data-fetching/query-client";
import { APP_UPDATE_CONTEXT } from "./layout/app-update/app-update-context";
import { createAppUpdateStore } from "./layout/app-update/app-update-store";
import "./styles/tokens.css";
import "./styles/fonts.css";
import "./styles/base.css";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("The root element #root is missing from index.html");
}

// The theme kept on the device is applied before the first render, so that nothing flashes.
restoreStoredTheme();

// A new version waits until the customer chooses "Mettre à jour": `updateServiceWorker(true)`
// activates it, then reloads the page. The cart and the drafts are in the browser's storage.
const appUpdates = createAppUpdateStore();
const updateServiceWorker = registerSW({ onNeedRefresh: appUpdates.markWaiting });
const appUpdate = {
  store: appUpdates,
  apply: () => {
    void updateServiceWorker(true);
  },
};

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={createQueryClient()}>
      <APP_UPDATE_CONTEXT value={appUpdate}>
        <App />
      </APP_UPDATE_CONTEXT>
    </QueryClientProvider>
  </StrictMode>,
);
