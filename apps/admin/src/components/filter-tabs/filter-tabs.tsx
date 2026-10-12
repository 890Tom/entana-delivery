import type { ReactElement } from "react";

import styles from "./filter-tabs.module.css";

export interface FilterTab<Key extends string> {
  readonly key: Key;
  readonly label: string;
  /**
   * A count in a badge, shown when it is above zero. "highlight" (gold) is for what needs
   * attention, "neutral" (grey) for the rest.
   */
  readonly badge?: { readonly count: number; readonly tone: "highlight" | "neutral" };
}

interface FilterTabsProps<Key extends string> {
  readonly label: string;
  readonly tabs: readonly FilterTab<Key>[];
  readonly selected: Key;
  readonly onSelect: (key: Key) => void;
}

/** Rounded filters of one list: the selected one is pressed, outlined and tinted. */
export function FilterTabs<Key extends string>({
  label,
  tabs,
  selected,
  onSelect,
}: FilterTabsProps<Key>): ReactElement {
  return (
    <div role="group" aria-label={label} className={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={styles.tab}
          aria-pressed={tab.key === selected}
          onClick={() => {
            onSelect(tab.key);
          }}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge.count > 0 && (
            <span className={[styles.badge, styles[tab.badge.tone]].join(" ")}>
              {tab.badge.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
