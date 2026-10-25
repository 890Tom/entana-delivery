import type { PlaceSuggestion } from "@entana/contracts";
import { useEffect, useState } from "react";

import { fetchPlaceSuggestions } from "../api/fetch-place-suggestions";
import { useDebouncedValue } from "../quote/use-debounced-value";

/** The wait after the last keystroke, so that typing a word asks once. */
const SEARCH_DELAY_MS = 400;
/** Below this, after trimming, nothing is asked: the server would refuse it. */
const MIN_SEARCH_LENGTH = 3;

export type PlaceSearchState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "failed" }
  | { readonly status: "ready"; readonly suggestions: readonly PlaceSuggestion[] };

type Answer = Extract<PlaceSearchState, { status: "failed" | "ready" }>;

interface SettledAnswer {
  readonly text: string;
  readonly answer: Answer;
}

/** Asks for the text once it settled; a newer text cancels the request and drops its answer. */
function useSettledAnswer(settled: string): SettledAnswer | null {
  const [latest, setLatest] = useState<SettledAnswer | null>(null);
  useEffect(() => {
    if (settled === "") {
      return undefined;
    }
    const controller = new AbortController();
    fetchPlaceSuggestions(settled, controller.signal).then(
      ({ suggestions }) => {
        if (!controller.signal.aborted) {
          setLatest({ text: settled, answer: { status: "ready", suggestions } });
        }
      },
      () => {
        if (!controller.signal.aborted) {
          setLatest({ text: settled, answer: { status: "failed" } });
        }
      },
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

/**
 * The suggestions for a typed text: nothing under 3 characters (trimmed), then one request 400 ms
 * after the last keystroke. Only the answer for the text of now is shown. Nothing is kept: no
 * cache, no storage.
 */
export function usePlaceSearch(query: string): PlaceSearchState {
  const trimmed = query.trim();
  const searched = trimmed.length >= MIN_SEARCH_LENGTH ? trimmed : "";
  const settled = useDebouncedValue(searched, SEARCH_DELAY_MS);
  const latest = useSettledAnswer(settled);
  if (searched === "") {
    return { status: "idle" };
  }
  if (settled !== searched || latest?.text !== settled) {
    return { status: "loading" };
  }
  return latest.answer;
}
