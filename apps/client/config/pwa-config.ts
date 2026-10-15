import type { VitePWAOptions } from "vite-plugin-pwa";

const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;

/**
 * An uploaded product photo of this origin: `/media/products/<uuid>.webp`. The API gives it a new
 * name at every replacement, so a cached copy never goes stale. A branding file or a file placed
 * by hand keeps its name when replaced: never cached here.
 * Workbox copies this function into the service worker as text, so it must not use anything
 * from outside its own body (the expression stays inline).
 */
export function isProductPhotoRequest(options: { url: URL; sameOrigin: boolean }): boolean {
  return (
    options.sameOrigin &&
    /^\/media\/products\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/.test(
      options.url.pathname,
    )
  );
}

/**
 * The service worker of the customer app. The interface is precached; the product photos are
 * cached first; everything else, the API and the map tiles above all, goes to the network. No
 * answer of the API is ever stored: an order, a quote or a tracking view is never stale.
 */
export const PWA_OPTIONS: Partial<VitePWAOptions> = {
  strategies: "generateSW",
  // A new version waits for the customer's "Mettre à jour": never a reload in the middle of an order.
  registerType: "prompt",
  // Registered by main.tsx, through the virtual module.
  injectRegister: false,
  // The static public/manifest.webmanifest is served as it is.
  manifest: false,
  devOptions: { enabled: false },
  workbox: {
    globPatterns: ["**/*.{html,js,css,ttf,png,svg,webmanifest}"],
    // The map library is loaded on demand by two screens only, and is larger than the rest of
    // the interface: never precached. The icon source is not served to the customer.
    globIgnores: ["**/maplibre-gl*", "**/*.map", "icons-source/**"],
    navigateFallback: "index.html",
    navigateFallbackDenylist: [/^\/api\//, /^\/media\//],
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: isProductPhotoRequest,
        handler: "CacheFirst",
        options: {
          cacheName: "product-photos",
          expiration: { maxEntries: 60, maxAgeSeconds: THIRTY_DAYS_IN_SECONDS },
          cacheableResponse: { statuses: [200] },
        },
      },
    ],
  },
};
