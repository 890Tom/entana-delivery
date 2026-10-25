import type { PlaceSuggestion } from "@entana/contracts";
import { useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactElement, RefObject } from "react";

import { Icon } from "../../../components/icon/icon";
import { IconButton } from "../../../components/icon-button/icon-button";
import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";

import styles from "./place-search.module.css";
import { usePlaceSearch } from "./use-place-search";
import type { PlaceSearchState } from "./use-place-search";

interface PlaceSearchProps {
  /** Inactive (still focusable) until there is a map to bring to the chosen place. */
  readonly isDisabled: boolean;
  readonly onChoose: (suggestion: PlaceSuggestion) => void;
}

interface Combobox {
  readonly text: string;
  readonly search: PlaceSearchState;
  readonly suggestions: readonly PlaceSuggestion[];
  readonly isExpanded: boolean;
  readonly activeIndex: number;
  readonly edit: (value: string) => void;
  readonly choose: (suggestion: PlaceSuggestion) => void;
  readonly close: () => void;
  readonly move: (step: 1 | -1) => void;
}

/**
 * The text shown and the text searched are apart: a chosen label fills the field without being
 * searched again. Both live in this component only, never stored.
 */
function useCombobox(onChoose: (suggestion: PlaceSuggestion) => void): Combobox {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [isClosed, setIsClosed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const search = usePlaceSearch(query);
  const suggestions = search.status === "ready" ? search.suggestions : [];
  const isExpanded = !isClosed && suggestions.length > 0;
  return {
    text,
    search,
    suggestions,
    isExpanded,
    activeIndex: isExpanded ? activeIndex : -1,
    edit: (value) => {
      setText(value);
      setQuery(value);
      setIsClosed(false);
      setActiveIndex(-1);
    },
    choose: (suggestion) => {
      setText(suggestion.label);
      setQuery("");
      setActiveIndex(-1);
      onChoose(suggestion);
    },
    close: () => {
      setIsClosed(true);
      setActiveIndex(-1);
    },
    move: (step) => {
      setIsClosed(false);
      setActiveIndex((index) => Math.min(Math.max(index + step, 0), suggestions.length - 1));
    },
  };
}

/** Down and up go through the list, Enter chooses, Escape closes it. Other keys type. */
function handleKey(event: KeyboardEvent<HTMLInputElement>, combobox: Combobox): void {
  const active = combobox.suggestions[combobox.activeIndex];
  if ((event.key === "ArrowDown" || event.key === "ArrowUp") && combobox.suggestions.length > 0) {
    event.preventDefault();
    combobox.move(event.key === "ArrowDown" ? 1 : -1);
  } else if (event.key === "Enter" && active !== undefined) {
    event.preventDefault();
    combobox.choose(active);
  } else if (event.key === "Escape" && combobox.isExpanded) {
    event.preventDefault();
    combobox.close();
  }
}

function statusText(search: PlaceSearchState): string {
  if (search.status === "failed") {
    return texts.delivery.search.failed;
  }
  return search.status === "ready" && search.suggestions.length === 0
    ? texts.delivery.search.noResult
    : "";
}

interface SuggestionListProps {
  readonly id: string;
  readonly combobox: Combobox;
}

// The labels come from a third party: they are text nodes, never markup.
function SuggestionList({ id, combobox }: SuggestionListProps): ReactElement {
  return (
    <ul
      id={id}
      role="listbox"
      aria-label={texts.delivery.search.results}
      className={styles.list}
      hidden={!combobox.isExpanded}
    >
      {combobox.isExpanded &&
        combobox.suggestions.map((suggestion, index) => (
          <li
            key={`${String(index)}-${suggestion.label}`}
            id={`${id}-${String(index)}`}
            role="option"
            aria-selected={index === combobox.activeIndex}
            className={styles.option}
            // The focus stays in the field: a tap on an option must not blur it first.
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              combobox.choose(suggestion);
            }}
          >
            {suggestion.label}
          </li>
        ))}
    </ul>
  );
}

interface SearchFieldProps {
  readonly id: string;
  readonly listId: string;
  readonly isDisabled: boolean;
  readonly combobox: Combobox;
}

function ComboboxInput({
  id,
  listId,
  isDisabled,
  combobox,
  inputRef,
}: SearchFieldProps & { readonly inputRef: RefObject<HTMLInputElement | null> }): ReactElement {
  const { activeIndex } = combobox;
  return (
    <input
      ref={inputRef}
      id={id}
      className={styles.input}
      type="text"
      role="combobox"
      autoComplete="off"
      spellCheck={false}
      aria-autocomplete="list"
      aria-expanded={combobox.isExpanded}
      aria-controls={listId}
      aria-activedescendant={activeIndex >= 0 ? `${listId}-${String(activeIndex)}` : undefined}
      aria-busy={combobox.search.status === "loading" ? true : undefined}
      aria-disabled={isDisabled ? true : undefined}
      readOnly={isDisabled}
      value={combobox.text}
      onChange={(event) => {
        combobox.edit(event.target.value);
      }}
      onKeyDown={(event) => {
        handleKey(event, combobox);
      }}
    />
  );
}

function SearchField(props: SearchFieldProps): ReactElement {
  const { isDisabled, combobox } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const isLoading = combobox.search.status === "loading";
  const frameClasses = [styles.frame, isDisabled ? styles.disabled : ""].join(" ");
  return (
    <div className={frameClasses}>
      <span className={isLoading ? styles.searching : styles.icon} aria-hidden="true">
        <Icon name="search" />
      </span>
      <ComboboxInput {...props} inputRef={inputRef} />
      {isLoading && <span className={visuallyHidden.visuallyHidden}>{texts.common.loading}</span>}
      {combobox.text !== "" && (
        <IconButton
          icon="x"
          label={texts.delivery.search.clear}
          onClick={() => {
            combobox.edit("");
            inputRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}

/**
 * A search above the map: up to 5 suggestions under the field (an ARIA combobox and listbox).
 * Choosing one hands it to `onChoose`, which places the point like a tap. When the search finds
 * nothing or fails, a message says so and the map stays the way to place the point.
 */
export function PlaceSearch({ isDisabled, onChoose }: PlaceSearchProps): ReactElement {
  const id = useId();
  const listId = `${id}-list`;
  const combobox = useCombobox(onChoose);
  return (
    <div className={styles.search}>
      <label id={`${id}-label`} htmlFor={id} className={styles.label}>
        {texts.delivery.search.label}
      </label>
      <SearchField id={id} listId={listId} isDisabled={isDisabled} combobox={combobox} />
      <SuggestionList id={listId} combobox={combobox} />
      {/* Named after the field, so that it is told apart from the other messages of the screen. */}
      <p role="status" aria-labelledby={`${id}-label`} className={styles.status}>
        {statusText(combobox.search)}
      </p>
    </div>
  );
}
