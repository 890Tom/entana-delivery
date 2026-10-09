import { MAX_CART_PRODUCTS, MAX_LINE_QUANTITY } from "./cart-limits";

/** The cart holds identifiers and quantities only: names and prices are read from the catalogue. */
export interface CartLine {
  readonly productId: string;
  readonly quantity: number;
}

export interface CartState {
  readonly lines: readonly CartLine[];
  /** Set once a line was removed because its product is gone, so the customer is told. */
  readonly hasRemovedUnavailable: boolean;
}

export type CartAction =
  | { readonly type: "increase"; readonly productId: string }
  | { readonly type: "decrease"; readonly productId: string }
  | { readonly type: "removeUnavailable"; readonly availableIds: ReadonlySet<string> };

export function emptyCart(lines: readonly CartLine[] = []): CartState {
  return { lines, hasRemovedUnavailable: false };
}

function increase(state: CartState, productId: string): CartState {
  const line = state.lines.find((candidate) => candidate.productId === productId);
  if (line === undefined) {
    if (state.lines.length >= MAX_CART_PRODUCTS) {
      return state;
    }
    return { ...state, lines: [...state.lines, { productId, quantity: 1 }] };
  }
  if (line.quantity >= MAX_LINE_QUANTITY) {
    return state;
  }
  return {
    ...state,
    lines: state.lines.map((candidate) =>
      candidate === line ? { productId, quantity: line.quantity + 1 } : candidate,
    ),
  };
}

function decrease(state: CartState, productId: string): CartState {
  const line = state.lines.find((candidate) => candidate.productId === productId);
  if (line === undefined) {
    return state;
  }
  const lines =
    line.quantity === 1
      ? state.lines.filter((candidate) => candidate !== line)
      : state.lines.map((candidate) =>
          candidate === line ? { productId, quantity: line.quantity - 1 } : candidate,
        );
  return { ...state, lines };
}

function removeUnavailable(state: CartState, availableIds: ReadonlySet<string>): CartState {
  const lines = state.lines.filter((line) => availableIds.has(line.productId));
  if (lines.length === state.lines.length) {
    return state;
  }
  return { lines, hasRemovedUnavailable: true };
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "increase":
      return increase(state, action.productId);
    case "decrease":
      return decrease(state, action.productId);
    case "removeUnavailable":
      return removeUnavailable(state, action.availableIds);
  }
}
