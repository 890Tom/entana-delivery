import type { ReactElement, RefObject } from "react";
import { useEffect, useRef } from "react";

import { ButtonLink } from "../../components/button/button";
import { Icon } from "../../components/icon/icon";
import { texts } from "../../i18n/texts";

import { buildDirectionsUrl } from "./rules/build-directions-url";
import { formatDistance } from "./rules/format-distance";
import type { ShopEntry } from "./rules/sort-by-distance";
import styles from "./shop-card.module.css";

interface ShopCardProps {
  readonly entry: ShopEntry;
  readonly isSelected: boolean;
  /** The shop was chosen on the map: the card scrolls into view (the list scrolls on its own). */
  readonly isRevealed: boolean;
  readonly onSelect: (id: string) => void;
}

/** Brings the element into view when it is revealed (the list scrolls on its own). */
function useScrollIntoViewWhen(isRevealed: boolean): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isRevealed) {
      ref.current?.scrollIntoView({ block: "nearest" });
    }
  }, [isRevealed]);
  return ref;
}

/** A reseller in the list: choosing it selects it, and "Itinéraire" opens the directions. */
export function ShopCard({ entry, isSelected, isRevealed, onSelect }: ShopCardProps): ReactElement {
  const { reseller, distanceKm } = entry;
  const cardRef = useScrollIntoViewWhen(isRevealed);
  const distance = distanceKm === null ? null : formatDistance(distanceKm);
  return (
    <div ref={cardRef} className={[styles.card, isSelected ? styles.selected : ""].join(" ")}>
      <button
        type="button"
        className={styles.select}
        aria-pressed={isSelected}
        onClick={() => {
          onSelect(reseller.id);
        }}
      >
        <span className={styles.heading}>
          <span className={styles.tile} aria-hidden="true">
            <Icon name="store" />
          </span>
          <span className={styles.name}>{reseller.name}</span>
        </span>
        <span className={styles.meta}>
          {texts.resellers.shopMeta(reseller.neighborhood, distance)}
        </span>
      </button>
      <div className={styles.route}>
        <ButtonLink
          href={buildDirectionsUrl(reseller)}
          icon="navigation"
          label={texts.resellers.routeLabel(reseller.name)}
          isExternal
        >
          {texts.resellers.route}
        </ButtonLink>
      </div>
    </div>
  );
}
