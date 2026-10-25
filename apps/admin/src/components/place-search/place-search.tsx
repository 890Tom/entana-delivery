import { useId, useState } from "react";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";

import { texts } from "../../i18n/texts";
import { OrderIcon } from "../../order-display/order-icons";
import visuallyHidden from "../visually-hidden/visually-hidden.module.css";

import styles from "./place-search.module.css";

const t = texts.settings.axisEditor.search;

/** What the list shows of an item. */
export interface SearchOption {
  readonly key: string;
  readonly label: string;
}

/**
 * A list that loads: its state and its texts. Without it the combobox filters a list it already
 * has, as the search of the existing places of an axis does.
 */
interface RemoteResults {
  readonly status: "idle" | "loading" | "ready" | "failed";
  readonly texts: {
    readonly label: string;
    readonly clear: string;
    readonly noResult: string;
    readonly failed: string;
  };
}

interface PlaceSearchProps<T> {
  readonly search: string;
  /** The items that match the search, a few at most. */
  readonly results: readonly T[];
  readonly optionOf: (item: T) => SearchOption;
  /** Without `remote`: the axis is full, no place can be added. With it: nothing to search yet. */
  readonly isDisabled: boolean;
  readonly onSearch: (search: string) => void;
  readonly onPick: (item: T) => void;
  readonly remote?: RemoteResults;
}

/** The props and the result that the keyboard points at (-1: none yet, for a list that loads). */
interface Combo<T> extends PlaceSearchProps<T> {
  readonly active: number;
  readonly setActive: (index: number) => void;
  readonly hasOptions: boolean;
}

function nextActive(active: number, step: 1 | -1, count: number): number {
  if (active < 0) {
    return step === 1 ? 0 : count - 1;
  }
  return (active + step + count) % Math.max(count, 1);
}

/** Up and Down move through the results, Enter adds the one shown, Escape clears the search. */
function keyHandler<T>(props: Combo<T>): (event: KeyboardEvent<HTMLInputElement>) => void {
  const { results, active, setActive } = props;
  return (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive(nextActive(active, event.key === "ArrowDown" ? 1 : -1, results.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = results[active];
      if (item !== undefined) {
        props.onPick(item);
      }
    } else if (event.key === "Escape") {
      if (props.remote !== undefined && props.search !== "") {
        // Clearing the field is all this Escape does: a screen around it must not act on it too.
        event.stopPropagation();
      }
      props.onSearch("");
    }
  };
}

function Options<T>({ props, listId }: { props: Combo<T>; listId: string }): ReactElement {
  const { active } = props;
  return (
    <ul
      id={listId}
      role="listbox"
      aria-label={props.remote?.texts.label ?? t.results}
      className={styles.results}
    >
      {props.results.map((item, index) => {
        const option = props.optionOf(item);
        return (
          <li
            key={option.key}
            id={`${listId}-${String(index)}`}
            role="option"
            aria-selected={index === active}
            className={styles.option}
            // The input keeps the focus: a click must not take it away before it is handled.
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              props.onPick(item);
            }}
          >
            {option.label}
          </li>
        );
      })}
    </ul>
  );
}

function Results<T>({ props, listId }: { props: Combo<T>; listId: string }): ReactElement {
  if (props.results.length === 0) {
    return <p className={styles.noResult}>{t.noResult(props.search.trim())}</p>;
  }
  return <Options props={props} listId={listId} />;
}

function remoteMessage(remote: RemoteResults, count: number): string {
  if (remote.status === "failed") {
    return remote.texts.failed;
  }
  return remote.status === "ready" && count === 0 ? remote.texts.noResult : "";
}

/** The message of a list that loads, always present so that a screen reader reads its changes. */
function RemoteStatus<T>({
  props,
  remote,
}: {
  props: Combo<T>;
  remote: RemoteResults;
}): ReactElement {
  const message = props.isDisabled ? "" : remoteMessage(remote, props.results.length);
  return (
    <p
      role="status"
      aria-label={remote.texts.label}
      className={message === "" ? visuallyHidden.visuallyHidden : styles.noResult}
    >
      {message}
    </p>
  );
}

interface SearchInputProps<T> {
  readonly props: Combo<T>;
  readonly id: string;
  readonly listId: string;
}

/** What a list that loads adds to the field: busy while it loads, inactive (still focusable). */
function remoteAttributes<T>(props: Combo<T>): Record<string, boolean | undefined> {
  const { remote } = props;
  if (remote === undefined) {
    return {};
  }
  return {
    "aria-busy": remote.status === "loading" ? true : undefined,
    "aria-disabled": props.isDisabled ? true : undefined,
    readOnly: props.isDisabled,
  };
}

function SearchInput<T>({ props, id, listId }: SearchInputProps<T>): ReactElement {
  const { remote, hasOptions, active } = props;
  const isLocked = remote === undefined && props.isDisabled;
  const label = remote?.texts.label ?? t.label;
  return (
    <input
      id={id}
      className={styles.searchInput}
      type="search"
      role="combobox"
      placeholder={label}
      aria-label={label}
      aria-expanded={hasOptions}
      aria-controls={hasOptions ? listId : undefined}
      aria-autocomplete="list"
      aria-activedescendant={hasOptions && active >= 0 ? `${listId}-${String(active)}` : undefined}
      aria-describedby={isLocked ? `${id}-full` : undefined}
      {...remoteAttributes(props)}
      autoComplete="off"
      disabled={isLocked}
      value={props.search}
      onChange={(event) => {
        props.setActive(remote === undefined ? 0 : -1);
        props.onSearch(event.target.value);
      }}
      onKeyDown={keyHandler(props)}
    />
  );
}

interface FrameProps<T> {
  readonly props: Combo<T>;
  readonly id: string;
  readonly children: ReactNode;
}

function ClearButton({ label, onClear }: { label: string; onClear: () => void }): ReactElement {
  return (
    <button type="button" className={styles.clear} aria-label={label} onClick={onClear}>
      <OrderIcon name="x" size={20} />
    </button>
  );
}

/** A list that loads: its field holds a clear button, so it is not a `label` (a label holds one control). */
function RemoteFrame<T>({
  props,
  id,
  children,
  remote,
}: FrameProps<T> & { remote: RemoteResults }): ReactElement {
  const isLoading = remote.status === "loading";
  return (
    <div className={styles.searchFrame}>
      <span className={isLoading ? styles.searching : styles.icon}>
        <OrderIcon name="search" size={20} />
      </span>
      {children}
      {isLoading && <span className={visuallyHidden.visuallyHidden}>{texts.common.loading}</span>}
      {props.search !== "" && (
        <ClearButton
          label={remote.texts.clear}
          onClear={() => {
            props.onSearch("");
            document.getElementById(id)?.focus();
          }}
        />
      )}
    </div>
  );
}

function SearchFrame<T>({ props, id, children }: FrameProps<T>): ReactElement {
  if (props.remote !== undefined) {
    return (
      <RemoteFrame props={props} id={id} remote={props.remote}>
        {children}
      </RemoteFrame>
    );
  }
  return (
    <label htmlFor={id} className={styles.searchFrame}>
      <OrderIcon name="search" size={20} />
      {children}
    </label>
  );
}

function isListOpen<T>(props: PlaceSearchProps<T>): boolean {
  if (props.isDisabled) {
    return false;
  }
  return props.remote === undefined ? props.search.trim() !== "" : props.remote.status === "ready";
}

/**
 * The combobox of the admin: it finds an item by its name and hands it to `onPick`. Without
 * `remote`, it filters the existing places of an axis; with it, the list is loaded by the caller
 * and the field says when it loads, finds nothing or fails.
 */
export function PlaceSearch<T>(props: PlaceSearchProps<T>): ReactElement {
  const id = useId();
  const listId = `${id}-results`;
  const [active, setActive] = useState(props.remote === undefined ? 0 : -1);
  const isOpen = isListOpen(props);
  const hasOptions = isOpen && props.results.length > 0;
  const combo: Combo<T> = { ...props, active, setActive, hasOptions };
  return (
    <div className={styles.search}>
      <SearchFrame props={combo} id={id}>
        <SearchInput props={combo} id={id} listId={listId} />
      </SearchFrame>
      {props.remote === undefined && props.isDisabled && (
        <p id={`${id}-full`} className={styles.noResult}>
          {t.full}
        </p>
      )}
      {props.remote === undefined
        ? isOpen && <Results props={combo} listId={listId} />
        : hasOptions && <Options props={combo} listId={listId} />}
      {props.remote !== undefined && <RemoteStatus props={combo} remote={props.remote} />}
    </div>
  );
}
