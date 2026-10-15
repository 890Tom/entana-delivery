import type { ReactElement } from "react";

import { Button } from "../../../components/button/button";
import { Notice } from "../../../components/notice/notice";
import { TextField } from "../../../components/text-field/text-field";
import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";

import { readResellersErrorKind } from "../api/fetch-resellers";
import styles from "./resellers-list-panel.module.css";
import type { ShopEntry } from "../rules/sort-by-distance";
import { ShopCard } from "./shop-card";
import type { NearbyPosition } from "../position/use-nearby-position";

/** What the list shows of the request of the resellers. */
export type ListState =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly error: unknown; readonly onRetry: () => void }
  | { readonly status: "ready"; readonly isEmpty: boolean };

interface ResellersListPanelProps {
  readonly list: ListState;
  readonly entries: readonly ShopEntry[];
  readonly neighborhood: string;
  readonly onNeighborhoodChange: (value: string) => void;
  readonly nearby: NearbyPosition;
  readonly selectedId: string | null;
  readonly revealedId: string | null;
  readonly onSelect: (id: string) => void;
}

function ListSkeleton(): ReactElement {
  return (
    <div className={styles.skeletonList} aria-busy="true">
      <span className={visuallyHidden.visuallyHidden}>{texts.common.loading}</span>
      {[1, 2, 3].map((position) => (
        <div key={position} className={styles.skeletonCard} aria-hidden="true" />
      ))}
    </div>
  );
}

function EmptyCard({
  title,
  text,
  onShowAll,
}: {
  title: string;
  text: string;
  onShowAll?: () => void;
}): ReactElement {
  return (
    <div className={styles.empty} role="status">
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyText}>{text}</p>
      {onShowAll !== undefined && (
        <Button onClick={onShowAll}>{texts.resellers.noMatch.action}</Button>
      )}
    </div>
  );
}

function PositionFailure({ nearby }: { nearby: NearbyPosition }): ReactElement | null {
  if (nearby.request.status !== "failed") {
    return null;
  }
  return <Notice tone="error">{texts.resellers.geo[nearby.request.reason]}</Notice>;
}

function ShopList({
  entries,
  selectedId,
  revealedId,
  onSelect,
}: Pick<
  ResellersListPanelProps,
  "entries" | "selectedId" | "revealedId" | "onSelect"
>): ReactElement {
  return (
    <ul className={styles.list}>
      {entries.map((entry) => (
        <li key={entry.reseller.id}>
          <ShopCard
            entry={entry}
            isSelected={entry.reseller.id === selectedId}
            isRevealed={entry.reseller.id === revealedId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}

/** The part of the list under the filters: skeleton, error, empty, no match, or the cards. */
function ListBody(props: ResellersListPanelProps): ReactElement {
  const { list, entries, nearby } = props;
  if (list.status === "loading") {
    return <ListSkeleton />;
  }
  if (list.status === "failed") {
    return (
      <Notice tone="error" action={{ label: texts.common.retry, onClick: list.onRetry }}>
        {texts.resellers.errors[readResellersErrorKind(list.error)]}
      </Notice>
    );
  }
  if (list.isEmpty) {
    return <EmptyCard title={texts.resellers.empty.title} text={texts.resellers.empty.text} />;
  }
  if (entries.length === 0) {
    return (
      <EmptyCard
        title={texts.resellers.noMatch.title}
        text={texts.resellers.noMatch.text}
        onShowAll={() => {
          props.onNeighborhoodChange("");
        }}
      />
    );
  }
  return (
    <>
      <p className={styles.count} aria-live="polite">
        {texts.resellers.count(entries.length, nearby.point !== null)}
      </p>
      <ShopList {...props} />
    </>
  );
}

/** The filter, "Autour de moi", the counter and the cards: usable without the map. */
export function ResellersListPanel(props: ResellersListPanelProps): ReactElement {
  const { neighborhood, onNeighborhoodChange, nearby } = props;
  return (
    <div className={styles.panel}>
      <h1 className={styles.heading}>{texts.resellers.title}</h1>
      <TextField
        label={texts.resellers.neighborhood.label}
        placeholder={texts.resellers.neighborhood.placeholder}
        value={neighborhood}
        onChange={onNeighborhoodChange}
        autoComplete="off"
        spellCheck={false}
      />
      <div className={styles.nearby}>
        <Button
          variant="accent"
          icon="locate-fixed"
          isDisabled={nearby.request.status === "locating"}
          onClick={nearby.ask}
        >
          {texts.resellers.nearby}
        </Button>
      </div>
      <PositionFailure nearby={nearby} />
      <ListBody {...props} />
    </div>
  );
}
