import type { PublicProduct } from "@entana/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { buildProduct } from "../../../test-support/build-product";
import { CartProvider } from "../../cart/cart-provider";

import { ProductCard } from "./product-card";

afterEach(cleanup);

function renderCard(product: PublicProduct): ReturnType<typeof render> {
  return render(
    <CartProvider>
      <ProductCard product={product} />
    </CartProvider>,
  );
}

describe("ProductCard photo", () => {
  it("shows the photo with the source and the alternative text of the API, loaded lazily", () => {
    const product = buildProduct({ image: { url: "/media/products/mofo.webp", alt: "Un mofo" } });

    renderCard(product);

    const photo = screen.getByRole("img", { name: "Un mofo" });
    expect(photo.getAttribute("src")).toBe("/media/products/mofo.webp");
    expect(photo.getAttribute("loading")).toBe("lazy");
    expect(photo.getAttribute("decoding")).toBe("async");
  });

  it("shows the alternative text as visible text when there is no photo URL", () => {
    const product = buildProduct({ image: { url: null, alt: "Un mofo" } });

    const { container } = renderCard(product);

    expect(screen.getByText("Un mofo")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows the alternative text as visible text when the photo fails to load", () => {
    const product = buildProduct({ image: { url: "/media/products/mofo.webp", alt: "Un mofo" } });
    const { container } = renderCard(product);

    fireEvent.error(screen.getByRole("img", { name: "Un mofo" }));

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Un mofo")).toBeTruthy();
  });
});
