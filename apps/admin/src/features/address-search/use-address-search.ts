import type { PlaceSuggestion } from "@entana/contracts";
import { useEffect, useState } from "react";

import { useDebouncedValue } from "../orders/filters/use-debounced-value";

import { searchPlaces } from "./address-search-calls";

/** The wait after the last keystroke, so that typing a word asks once. */
const SEARCH_DELAY_MS = 400;
/** Below this, after trimming, nothing is asked: the server would refuse it. */
const MIN_SEARCH_LENGTH = 3;

type Status = "idle" | "loading" | "ready" | "failed";

interface Answer {
  readonly text: string;
  readonly status: "ready" | "failed";
  readonly suggestions: readonly PlaceSuggestion[];
}

/** Asks for the text once it settled; a newer text cancels the request and drops its answer. */
function useSettledAnswer(settled: string): Answer | null {
  const [latest, setLatest] = useState<Answer | null>(null);
  useEffect(() => {
    if (settled === "") {
      return undefined;
    }
    const controller = new AbortController();
    searchPlaces(settled, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) {
          setLatest(
            result.kind === "ok"
              ? { text: settled, status: "ready", suggestions: result.data.suggestions }
              : { text: settled, status: "failed", suggestions: [] },
          );
        }
      },
      // Only a cancelled request rejects: a newer text replaced it, there is nothing to show.
      () => undefined,
    );
    return () => {
      controller.abort();
      // Forgotten with its request: the same text typed again is asked again, never answered
      // from an earlier result.
      setLatest(null);
    };
  }, [settled]);
  return latest;
}

function useSuggestions(query: string): Pick<AddressSearchModel, "status" | "suggestions"> {
  const trimmed = query.trim();
  const searched = trimmed.length >= MIN_SEARCH_LENGTH ? trimmed : "";
  const settled = useDebouncedValue(searched, SEARCH_DELAY_MS);
  const latest = useSettledAnswer(settled);
  if (searched === "") {
    return { status: "idle", suggestions: [] };
  }
  if (settled !== searched || latest?.text !== settled) {
    return { status: "loading", suggestions: [] };
  }
  return { status: latest.status, suggestions: latest.suggestions };
}

export interface AddressSearchModel {
  /** What the field shows: the typed text, or the label of the chosen place. */
  readonly text: string;
  readonly status: Status;
  readonly suggestions: readonly PlaceSuggestion[];
  readonly edit: (text: string) => void;
  /** A place was chosen: its label fills the field without being searched again. */
  readonly show: (label: string) => void;
}

/**
 * The search of an address: nothing under 3 characters (trimmed), then one request 400 ms after
 * the last keystroke, and only the answer for the text of now. The text lives in this state only.
 */
export function useAddressSearch(): AddressSearchModel {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const { status, suggestions } = useSuggestions(query);
  return {
    text,
    status,
    suggestions,
    edit: (value) => {
      setText(value);
      setQuery(value);
    },
    show: (label) => {
      setText(label);
      setQuery("");
    },
  };
}
