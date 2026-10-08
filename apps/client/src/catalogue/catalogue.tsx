import type { PublicProduct } from "@entana/contracts";
import { formatAmount } from "@entana/contracts";
import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { texts } from "../texts";

import { CatalogueError, fetchProducts } from "./fetch-products";
import type { CatalogueErrorKind } from "./fetch-products";

function readErrorKind(error: unknown): CatalogueErrorKind {
  return error instanceof CatalogueError ? error.kind : "unexpected";
}

function ProductItem({ product }: { product: PublicProduct }): ReactElement {
  return (
    <li>
      <h2>{product.name}</h2>
      {/* Photo storage is undecided: the alt text stands in, no URL is built from image.key. */}
      <p>{product.image.alt}</p>
      {product.description !== null && product.description !== "" && <p>{product.description}</p>}
      <p>{formatAmount(product.priceAr)}</p>
      {!product.available && <p>{texts.catalogue.soldOut}</p>}
    </li>
  );
}

export function Catalogue(): ReactElement {
  const query = useQuery({
    queryKey: ["products"],
    queryFn: ({ signal }) => fetchProducts(signal),
  });

  if (query.isPending) {
    return <p role="status">{texts.catalogue.loading}</p>;
  }
  if (query.isError) {
    return (
      <div role="alert">
        <p>{texts.catalogue.errors[readErrorKind(query.error)]}</p>
        <button
          type="button"
          onClick={() => {
            void query.refetch();
          }}
        >
          {texts.catalogue.retry}
        </button>
      </div>
    );
  }
  if (query.data.products.length === 0) {
    return <p>{texts.catalogue.empty}</p>;
  }
  return (
    <ul>
      {query.data.products.map((product) => (
        <ProductItem key={product.id} product={product} />
      ))}
    </ul>
  );
}
