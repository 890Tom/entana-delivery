import type { PlaceSuggestion } from "@entana/contracts";
import type { ReactElement } from "react";

import { PlaceSearch } from "../../components/place-search/place-search";
import type { SearchOption } from "../../components/place-search/place-search";
import { texts } from "../../i18n/texts";

import { useAddressSearch } from "./use-address-search";

interface AddressSearchProps {
  /** Inactive (still focusable) while there is no map to bring to the chosen place. */
  readonly isDisabled: boolean;
  /** Places the point like a click on the map, and brings the map to it. */
  readonly onChoose: (suggestion: PlaceSuggestion) => void;
}

// The labels come from a third party: the combobox shows them as text, never as markup.
function optionOf(suggestion: PlaceSuggestion): SearchOption {
  return {
    key: `${suggestion.label}|${String(suggestion.lat)}|${String(suggestion.lng)}`,
    label: suggestion.label,
  };
}

/** The search above a map where a point is placed: up to 5 suggestions, from the place search. */
export function AddressSearch({ isDisabled, onChoose }: AddressSearchProps): ReactElement {
  const search = useAddressSearch();
  return (
    <PlaceSearch
      search={search.text}
      results={search.suggestions}
      optionOf={optionOf}
      isDisabled={isDisabled}
      onSearch={search.edit}
      onPick={(suggestion) => {
        search.show(suggestion.label);
        onChoose(suggestion);
      }}
      remote={{ status: search.status, texts: texts.addressSearch }}
    />
  );
}
