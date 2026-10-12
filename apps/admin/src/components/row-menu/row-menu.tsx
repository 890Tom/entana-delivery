import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactElement, ReactNode, RefObject } from "react";

import styles from "./row-menu.module.css";

export interface RowMenuItem {
  readonly key: string;
  readonly label: string;
  readonly tone: "normal" | "danger";
  readonly onSelect: () => void;
}

interface RowMenuProps {
  /** The accessible name of the button that opens the menu. */
  readonly label: string;
  readonly icon: ReactNode;
  readonly items: readonly RowMenuItem[];
  /** The opening button, so that the owner can give the focus back to it. */
  readonly triggerRef?: RefObject<HTMLButtonElement | null>;
}

const NAVIGATION_KEYS = ["ArrowDown", "ArrowUp", "Home", "End"];

function itemsOf(menu: HTMLElement): HTMLButtonElement[] {
  return [...menu.querySelectorAll<HTMLButtonElement>("[role='menuitem']")];
}

function focusNeighbour(menu: HTMLElement, key: string): void {
  const entries = itemsOf(menu);
  const position = entries.findIndex((entry) => entry === document.activeElement);
  const last = entries.length - 1;
  const target = {
    ArrowDown: position >= last ? 0 : position + 1,
    ArrowUp: position <= 0 ? last : position - 1,
    Home: 0,
    End: last,
  }[key];
  if (target !== undefined) {
    entries[target]?.focus();
  }
}

/** Closes when a pointer lands outside: a menu left open on the page would hide the rows. */
function useCloseOnOutsidePointer(
  isOpen: boolean,
  rootRef: { current: HTMLElement | null },
  close: () => void,
): void {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target) !== true) {
        close();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen, rootRef, close]);
}

function handleMenuKey(
  event: KeyboardEvent<HTMLDivElement>,
  onClose: () => void,
  onEscape: () => void,
): void {
  if (event.key === "Escape") {
    event.stopPropagation();
    onEscape();
  } else if (event.key === "Tab") {
    onClose();
  } else if (NAVIGATION_KEYS.includes(event.key)) {
    event.preventDefault();
    focusNeighbour(event.currentTarget, event.key);
  }
}

interface MenuPanelProps {
  readonly label: string;
  readonly items: readonly RowMenuItem[];
  readonly onClose: () => void;
  readonly onEscape: () => void;
}

/** The panel: it takes the focus when it opens; arrows, Home and End move between entries. */
function MenuPanel({ label, items, onClose, onEscape }: MenuPanelProps): ReactElement {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (menuRef.current !== null) {
      itemsOf(menuRef.current)[0]?.focus();
    }
  }, []);
  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      className={styles.menu}
      onKeyDown={(event) => {
        handleMenuKey(event, onClose, onEscape);
      }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          className={[styles.item, item.tone === "danger" ? styles.danger : ""].join(" ")}
          onClick={() => {
            onClose();
            item.onSelect();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The "…" menu of a row: a white panel under the button. Escape closes and gives the focus back
 * to the button, Tab and a click outside close.
 */
export function RowMenu({ label, icon, items, triggerRef }: RowMenuProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLButtonElement>(null);
  const ownTriggerRef = triggerRef ?? fallbackRef;
  const close = (): void => {
    setIsOpen(false);
  };
  useCloseOnOutsidePointer(isOpen, rootRef, close);
  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={ownTriggerRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((isOpenNow) => !isOpenNow);
        }}
      >
        {icon}
      </button>
      {isOpen && (
        <MenuPanel
          label={label}
          items={items}
          onClose={close}
          onEscape={() => {
            close();
            ownTriggerRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}
