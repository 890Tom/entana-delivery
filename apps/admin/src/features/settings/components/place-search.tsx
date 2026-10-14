import type { AdminDeliveryPlace } from "@entana/contracts";
import { useId, useState } from "react";
import type { KeyboardEvent, ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import { OrderIcon } from "../../../order-display/order-icons";

import styles from "./axis-editor.module.css";

const t = texts.settings.axisEditor.search;

interface PlaceSearchProps {
  readonly search: string;
  /** The places that match the search, a few at most. */
  readonly results: readonly AdminDeliveryPlace[];
  /** The axis is full: no place can be added. */
  readonly isDisabled: boolean;
  readonly onSearch: (search: string) => void;
  readonly onPick: (place: AdminDeliveryPlace) => void;
}

/** The props and the result that the keyboard points at. */
interface Combo extends PlaceSearchProps {
  readonly active: number;
  readonly setActive: (index: number) => void;
}

/** Up and Down move through the results, Enter adds the one shown, Escape clears the search. */
function keyHandler(props: Combo): (event: KeyboardEvent<HTMLInputElement>) => void {
  const { results, active, setActive } = props;
  return (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((active + step + results.length) % Math.max(results.length, 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const place = results[active];
      if (place !== undefined) {
        props.onPick(place);
      }
    } else if (event.key === "Escape") {
      props.onSearch("");
    }
  };
}

function Results({ props, listId }: { props: Combo; listId: string }): ReactElement {
  const { active } = props;
  if (props.results.length === 0) {
    return <p className={styles.noResult}>{t.noResult(props.search.trim())}</p>;
  }
  return (
    <ul id={listId} role="listbox" aria-label={t.results} className={styles.results}>
      {props.results.map((place, index) => (
        <li
          key={place.id}
          id={`${listId}-${String(index)}`}
          role="option"
          aria-selected={index === active}
          className={styles.option}
          // The input keeps the focus: a click must not take it away before it is handled.
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={() => {
            props.onPick(place);
          }}
        >
          {place.name}
        </li>
      ))}
    </ul>
  );
}

interface SearchInputProps {
  readonly props: Combo;
  readonly id: string;
  readonly listId: string;
  readonly hasOptions: boolean;
}

function SearchInput({ props, id, listId, hasOptions }: SearchInputProps): ReactElement {
  return (
    <label htmlFor={id} className={styles.searchFrame}>
      <OrderIcon name="search" size={20} />
      <input
        id={id}
        className={styles.searchInput}
        type="search"
        role="combobox"
        placeholder={t.label}
        aria-label={t.label}
        aria-expanded={hasOptions}
        aria-controls={hasOptions ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={hasOptions ? `${listId}-${String(props.active)}` : undefined}
        aria-describedby={props.isDisabled ? `${id}-full` : undefined}
        autoComplete="off"
        disabled={props.isDisabled}
        value={props.search}
        onChange={(event) => {
          props.setActive(0);
          props.onSearch(event.target.value);
        }}
        onKeyDown={keyHandler(props)}
      />
    </label>
  );
}

/** The combobox that finds an existing place by its name and adds it at the end of the axis. */
export function PlaceSearch(props: PlaceSearchProps): ReactElement {
  const id = useId();
  const listId = `${id}-results`;
  const [active, setActive] = useState(0);
  const combo: Combo = { ...props, active, setActive };
  const isOpen = props.search.trim() !== "" && !props.isDisabled;
  const hasOptions = isOpen && props.results.length > 0;
  return (
    <div className={styles.search}>
      <SearchInput props={combo} id={id} listId={listId} hasOptions={hasOptions} />
      {props.isDisabled && (
        <p id={`${id}-full`} className={styles.noResult}>
          {t.full}
        </p>
      )}
      {isOpen && <Results props={combo} listId={listId} />}
    </div>
  );
}
