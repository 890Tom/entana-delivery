import { useEffect } from "react";

/**
 * Asks the search engines not to index the page while it is shown. Defence in depth: the
 * production server adds the same instruction as a header.
 */
export function useNoIndex(): void {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.append(meta);
    return () => {
      meta.remove();
    };
  }, []);
}
