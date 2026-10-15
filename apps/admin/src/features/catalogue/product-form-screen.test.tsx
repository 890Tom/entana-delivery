import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { expectNoAccessibilityViolations } from "../../test-support/assertions/expect-no-accessibility-violations";
import { buildProduct } from "../../test-support/catalogue/build-product";
import { openAt } from "../../test-support/catalogue/catalogue-harness";
import { bodyOf, list } from "../../test-support/catalogue/catalogue-queries";
import { photoFile, stubPhotoSupport } from "../../test-support/catalogue/photo-support";
import {
  jsonResponse,
  namedProblemResponse,
  productChangeRoute,
  productPhotoRoute,
  productRoute,
  ROUTES,
} from "../../test-support/stubs/stub-api";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const t = texts.catalogueForm;
const NEW_PATH = "/catalogue/nouveau";

const mangue = buildProduct(1, {
  name: "Mangue",
  sku: "MAN-01",
  priceAr: 1200,
  description: "Fruitée",
  image: { url: "/media/mangue.webp" },
  imageAlt: "Une mangue",
});

const openNew = (handlers: Parameters<typeof openAt>[2] = {}): ReturnType<typeof openAt> =>
  openAt(NEW_PATH, t.newTitle, handlers);

const openEdit = (
  product: ReturnType<typeof buildProduct>,
  handlers: Parameters<typeof openAt>[2] = {},
): ReturnType<typeof openAt> =>
  openAt(`/catalogue/${product.id}`, product.name, {
    [ROUTES.products]: () => list(product),
    ...handlers,
  });

function type(label: string | RegExp, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillIdentity(): void {
  type(t.information.name, "Mangue");
  type(t.information.price, "1200");
  type(t.information.sku, "man-01");
}

async function choosePhoto(file = photoFile()): Promise<void> {
  fireEvent.change(screen.getByLabelText(t.photo.inputLabel), { target: { files: [file] } });
  await screen.findByRole("button", { name: t.photo.replace });
}

const submit = (label: string): void => {
  fireEvent.click(screen.getByRole("button", { name: label }));
};

describe("the validation of the form", () => {
  it("blocks the sending and says what to fix, with the focus on the first field", async () => {
    const api = await openNew();

    type(t.information.price, "1000001");
    type(t.information.sku, "M");
    submit(t.buttons.create);

    expect(screen.getByText(t.errors.name)).toBeTruthy();
    expect(screen.getByText(t.errors.price)).toBeTruthy();
    expect(screen.getByText(t.errors.sku)).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe(t.errors.summaryMany(3));
    expect(document.activeElement).toBe(screen.getByLabelText(t.information.name));
    expect(api.calls(ROUTES.createProduct)).toHaveLength(0);
  });

  it("asks for the alternative text once a photo is chosen", async () => {
    stubPhotoSupport({ width: 1000, height: 1000 });
    const api = await openNew();
    fillIdentity();

    await choosePhoto();
    submit(t.buttons.create);

    const field = screen.getByLabelText(t.imageAlt.labelRequired);
    expect(screen.getByText(t.errors.imageAlt)).toBeTruthy();
    expect(field.getAttribute("aria-describedby")).toContain("-message");
    expect(api.calls(ROUTES.createProduct)).toHaveLength(0);
  });

  it("checks a field when it is left", async () => {
    await openNew();

    fireEvent.blur(screen.getByLabelText(t.information.name));

    expect(screen.getByText(t.errors.name)).toBeTruthy();
  });
});

describe("the photo", () => {
  it("refuses a photo that is too small before sending anything", async () => {
    stubPhotoSupport({ width: 799, height: 2000 });
    const api = await openNew();

    fireEvent.change(screen.getByLabelText(t.photo.inputLabel), {
      target: { files: [photoFile()] },
    });

    expect(await screen.findByText(t.errors.photoTooSmall)).toBeTruthy();
    expect(api.calls(ROUTES.createProduct)).toHaveLength(0);
  });

  it("shows the chosen photo in the preview at once", async () => {
    stubPhotoSupport({ width: 1000, height: 1000 });
    await openNew();
    type(t.information.name, "Mangue");
    type(t.information.price, "1200");

    expect(screen.getByText(t.preview.incomplete)).toBeTruthy();
    await choosePhoto();

    expect(screen.getByText(t.preview.hidden)).toBeTruthy();
    expect(screen.getByText("1 200 Ar")).toBeTruthy();
  });

  it("shows under the drop zone the refusal of the server", async () => {
    stubPhotoSupport({ width: 1000, height: 1000 });
    await openEdit(mangue, {
      [productPhotoRoute(mangue.id)]: () => namedProblemResponse(422, "photo_too_small"),
    });

    await choosePhoto();
    submit(t.buttons.save);

    expect(await screen.findByText(t.errors.photoTooSmall)).toBeTruthy();
  });
});

describe("the visibility switch", () => {
  it("stays locked until there is a photo and its alternative text", async () => {
    stubPhotoSupport({ width: 1000, height: 1000 });
    await openNew();
    const visible = (): HTMLElement => screen.getByRole("switch", { name: t.switches.visible });
    expect(visible().getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText(t.switches.visibleLockedHelp)).toBeTruthy();

    await choosePhoto();
    expect(visible().getAttribute("aria-disabled")).toBe("true");
    type(t.imageAlt.labelRequired, "Une mangue");

    expect(visible().getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(visible());
    expect(visible().getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(t.switches.visibleOnHelp)).toBeTruthy();
  });
});

describe("the creation", () => {
  it("sends one request without a photo and goes back to the list with a notice", async () => {
    const created = buildProduct(9, {
      name: "Mangue",
      sku: "MAN-01",
      priceAr: 1200,
      retired: true,
    });
    const api = await openNew({
      [ROUTES.createProduct]: () => jsonResponse(created, 201),
      [ROUTES.products]: () => list(created),
    });
    fillIdentity();

    submit(t.buttons.create);

    expect(await screen.findByText(t.notices.created("Mangue"))).toBeTruthy();
    expect(window.location.pathname).toBe("/catalogue");
    expect(bodyOf(api.calls(ROUTES.createProduct)[0])).toEqual({
      name: "Mangue",
      priceAr: 1200,
      sku: "MAN-01",
      available: true,
    });
  });

  it("sends the details, then the photo, then the visibility, in this order", async () => {
    stubPhotoSupport({ width: 1000, height: 1000 });
    const created = buildProduct(9, { name: "Mangue", retired: true, imageAlt: "Une mangue" });
    const withPhoto = { ...created, image: { url: "/media/x.webp" } };
    const order: string[] = [];
    const api = await openNew({
      [ROUTES.createProduct]: () => {
        order.push("post");
        return jsonResponse(created, 201);
      },
      [productPhotoRoute(created.id)]: () => {
        order.push("photo");
        return jsonResponse(withPhoto);
      },
      [productChangeRoute(created.id)]: () => {
        order.push("retired");
        return jsonResponse({ ...withPhoto, retired: false });
      },
      [ROUTES.products]: () => list({ ...withPhoto, retired: false }),
    });
    fillIdentity();
    await choosePhoto();
    type(t.imageAlt.labelRequired, "Une mangue");
    fireEvent.click(screen.getByRole("switch", { name: t.switches.visible }));

    submit(t.buttons.create);

    await waitFor(() => {
      expect(order).toEqual(["post", "photo", "retired"]);
    });
    expect(bodyOf(api.calls(productChangeRoute(created.id))[0])).toEqual({ retired: false });
    const sent = api.calls(productPhotoRoute(created.id))[0]?.body;
    expect(sent instanceof FormData && sent.get("photo") instanceof File).toBe(true);
  });

  it("takes the person to the form of the product when its photo fails", async () => {
    stubPhotoSupport({ width: 1000, height: 1000 });
    const created = buildProduct(9, { name: "Mangue", sku: "MAN-01", retired: true });
    await openNew({
      [ROUTES.createProduct]: () => jsonResponse(created, 201),
      [productPhotoRoute(created.id)]: () => namedProblemResponse(422, "photo_invalid"),
      [ROUTES.products]: () => list(created),
    });
    fillIdentity();
    await choosePhoto();
    type(t.imageAlt.labelRequired, "Une mangue");

    submit(t.buttons.create);

    expect(await screen.findByText(t.notices.photoFailed)).toBeTruthy();
    expect(window.location.pathname).toBe(`/catalogue/${created.id}`);
  });
});

describe("the change of a product", () => {
  it("sends only the fields that changed and stays on the page", async () => {
    const api = await openEdit(mangue, {
      [productChangeRoute(mangue.id)]: () => jsonResponse({ ...mangue, priceAr: 1500 }),
    });

    type(t.information.price, "1500");
    submit(t.buttons.save);

    expect(await screen.findByText(t.notices.saved)).toBeTruthy();
    expect(bodyOf(api.calls(productChangeRoute(mangue.id))[0])).toEqual({ priceAr: 1500 });
    expect(window.location.pathname).toBe(`/catalogue/${mangue.id}`);
  });

  it("puts a reference that is taken under its field", async () => {
    await openEdit(mangue, {
      [productChangeRoute(mangue.id)]: () => namedProblemResponse(409, "sku_taken"),
    });

    type(t.information.sku, "VAN-01");
    submit(t.buttons.save);

    expect(await screen.findByText(t.errors.skuTaken)).toBeTruthy();
  });

  it("says that the product was saved but not published", async () => {
    const retired = { ...mangue, retired: true };
    await openEdit(retired, {
      [productChangeRoute(mangue.id)]: () => namedProblemResponse(422, "product_not_publishable"),
    });

    fireEvent.click(screen.getByRole("switch", { name: t.switches.visible }));
    submit(t.buttons.save);

    expect(await screen.findByText(t.notices.publishFailed)).toBeTruthy();
    expect(screen.getByText(t.errors.notPublishable)).toBeTruthy();
  });

  it("retires the product at the end of the question and shows it retired", async () => {
    let reads = 0;
    await openEdit(mangue, {
      [ROUTES.products]: () => {
        reads += 1;
        return list(reads === 1 ? mangue : { ...mangue, retired: true });
      },
      [productRoute(mangue.id, "retire")]: () => jsonResponse({ ...mangue, retired: true }),
    });

    submit(t.buttons.retire);
    fireEvent.click(await screen.findByRole("button", { name: texts.catalogue.dialog.confirm }));

    expect(await screen.findByText(t.status.retired)).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.buttons.retire })).toBeNull();
    expect(
      screen.getByRole("switch", { name: t.switches.visible }).getAttribute("aria-checked"),
    ).toBe("false");
  });
});

describe("the page", () => {
  it("says when the product is not in the catalogue and gives the way back", async () => {
    await openAt("/catalogue/00000000-0000-4000-8000-000000000000", t.notFound, {
      [ROUTES.products]: () => list(mangue),
    });

    expect(within(screen.getByRole("main")).getByRole("link", { name: t.back })).toBeTruthy();
  });

  it("has no accessibility violation", async () => {
    await openEdit(mangue);

    await expectNoAccessibilityViolations(document.body);
  });
});
