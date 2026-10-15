import { createContext, createElement, use, useEffect, useState } from "react";
import type { ComponentType, ReactElement, ReactNode } from "react";

import { useShopName } from "../../features/instance/use-instance";

import { buildDocumentTitle } from "./build-document-title";

interface ScreenTitleSetters {
  readonly setScreenTitle: (title: string | null) => void;
  readonly setRefinedTitle: (title: string | null) => void;
}

interface DocumentTitleStore extends ScreenTitleSetters {
  readonly setShopName: (shopName: string | null) => void;
}

const NO_SETTERS: ScreenTitleSetters = {
  setScreenTitle: () => undefined,
  setRefinedTitle: () => undefined,
};

const SCREEN_TITLE_CONTEXT = createContext<ScreenTitleSetters>(NO_SETTERS);

/**
 * Held outside React state, so that a screen naming itself causes no extra render. Two titles:
 * React runs a child's effect before its parent's, so a single one set by the route and by the
 * screen inside it would keep the route's.
 */
function createDocumentTitleStore(): DocumentTitleStore {
  let screenTitle: string | null = null;
  let refinedTitle: string | null = null;
  let currentShopName: string | null = null;
  const write = (): void => {
    document.title = buildDocumentTitle(refinedTitle ?? screenTitle, currentShopName);
  };
  return {
    setScreenTitle: (title) => {
      screenTitle = title;
      write();
    },
    setRefinedTitle: (title) => {
      refinedTitle = title;
      write();
    },
    setShopName: (shopName) => {
      currentShopName = shopName;
      write();
    },
  };
}

/**
 * Titles the document "{screen} — Administration — {shop}", set as text so no markup is
 * interpreted. Without a screen (session loading or failed), only "Administration — {shop}".
 */
export function DocumentTitleProvider({ children }: { children: ReactNode }): ReactElement {
  const shopName = useShopName();
  const [store] = useState(createDocumentTitleStore);
  useEffect(() => {
    store.setShopName(shopName);
  }, [store, shopName]);
  return <SCREEN_TITLE_CONTEXT value={store}>{children}</SCREEN_TITLE_CONTEXT>;
}

function useTitleWhileMounted(set: (title: string | null) => void, title: string): void {
  useEffect(() => {
    set(title);
    return () => {
      set(null);
    };
  }, [set, title]);
}

/** A screen with its title, declared by the route that shows it. */
export function TitledScreen({
  title,
  component,
}: {
  title: string;
  component: ComponentType;
}): ReactElement {
  useTitleWhileMounted(use(SCREEN_TITLE_CONTEXT).setScreenTitle, title);
  return createElement(component);
}

/** Replaces the title of the route once the screen knows more ("Commande #K7M2QX"). */
export function useRefinedScreenTitle(title: string): void {
  useTitleWhileMounted(use(SCREEN_TITLE_CONTEXT).setRefinedTitle, title);
}
