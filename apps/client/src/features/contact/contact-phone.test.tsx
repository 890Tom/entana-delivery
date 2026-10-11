import { operatorPrefixes } from "@entana/contracts";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { buildInstance } from "../../test-support/builders/build-instance";
import {
  NAME,
  PHONE,
  PHONE_DISPLAY,
  continueButtons,
  editField,
  nameField,
  openContact,
  phoneField,
  typeInto,
} from "../../test-support/harnesses/contact-harness";
import { expectNoAccessibilityViolations } from "../../test-support/assertions/expect-no-accessibility-violations";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const { errors } = texts.contact.phone;

describe("the phone field while it is typed in", () => {
  it("shows the number grouped as the digits come, and ignores the digit past the end", async () => {
    openContact();
    const phone = await phoneField();

    for (const digit of "341234567") {
      typeInto(phone, phone.value + digit);
    }
    expect(phone.value).toBe(PHONE_DISPLAY);

    typeInto(phone, `${phone.value}8`);
    expect(phone.value).toBe(PHONE_DISPLAY);
  });

  it("takes a pasted number with its international prefix, and one with the national zero", async () => {
    openContact();
    const phone = await phoneField();

    typeInto(phone, "+261 34 12 345 67");
    expect(phone.value).toBe(PHONE_DISPLAY);
    typeInto(phone, "032 11 222 33");
    expect(phone.value).toBe("32 11 222 33");
  });

  it("keeps the caret after the same digit when one is inserted in the middle, and at the end otherwise", async () => {
    openContact();
    const phone = await phoneField();
    typeInto(phone, "34 12");

    editField(phone, "347 12", 3);

    await waitFor(() => {
      expect(phone.value).toBe("34 71 2");
    });
    expect(phone.selectionStart).toBe(4);
    editField(phone, "34 71 23", 8);
    expect(phone.value).toBe("34 71 23");
    expect(phone.selectionStart).toBe(8);
  });

  it("removes the neighbouring digit when Backspace deletes a formatting space", async () => {
    openContact();
    const phone = await phoneField();
    typeInto(phone, PHONE);

    editField(phone, "3412 345 67", 2, "deleteContentBackward");

    expect(phone.value).toBe("31 23 456 7");
    expect(phone.selectionStart).toBe(1);
  });

  it("shows no error while an incomplete number is typed", async () => {
    openContact();
    const phone = await phoneField();

    typeInto(phone, "34 12");

    expect(phone.getAttribute("aria-invalid")).toBeNull();
    expect(screen.queryByText(errors.missingDigits)).toBeNull();
  });
});

describe("the check of the phone field", () => {
  it("says digits are missing when the field is left, and when the form is sent", async () => {
    openContact();
    const phone = await phoneField();
    typeInto(phone, "34 12");

    fireEvent.blur(phone);

    expect(await screen.findByText(errors.missingDigits)).toBeTruthy();
    expect(phone.getAttribute("aria-invalid")).toBe("true");
    typeInto(phone, PHONE);
    expect(screen.queryByText(errors.missingDigits)).toBeNull();

    typeInto(phone, "34 12");
    typeInto(await nameField(), NAME);
    fireEvent.click((await continueButtons()).card);
    expect(await screen.findByText(errors.missingDigits)).toBeTruthy();
    expect(document.activeElement).toBe(phone);
  });

  it("says nothing when an empty field is left", async () => {
    openContact();
    const phone = await phoneField();

    fireEvent.blur(phone);

    expect(phone.getAttribute("aria-invalid")).toBeNull();
  });

  it("names the operator prefixes of the contract when the number starts with another", async () => {
    openContact();
    const phone = await phoneField();

    typeInto(phone, "31 12 345 67");
    fireEvent.blur(phone);

    const message = errors.invalidPrefix(operatorPrefixes("261"));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(message).toBe("Ce numéro ne commence pas par 32, 33, 34, 37, 38 ou 39.");
  });

  it("goes on with a valid number", async () => {
    openContact();
    typeInto(await nameField(), NAME);
    typeInto(await phoneField(), PHONE);

    fireEvent.click((await continueButtons()).bar);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/recapitulatif");
    });
  });

  it("has no accessibility violation with the error shown", async () => {
    openContact();
    const phone = await phoneField();
    typeInto(phone, "31 12 345 67");
    fireEvent.blur(phone);

    await screen.findByText(errors.invalidPrefix(operatorPrefixes("261")));
    await expectNoAccessibilityViolations(document.body);
  });
});

describe("the phone field for a country without a numbering rule", () => {
  const code33 = { api: { instanceData: buildInstance({ phoneCountryCode: "33" }) } };

  it("keeps the digits as they are, the leading zero included, and says only that the number is not valid", async () => {
    openContact(code33);
    const phone = await phoneField();

    typeInto(phone, "06 12 34 56 78");
    fireEvent.blur(phone);

    expect(phone.value).toBe("0612345678");
    expect(await screen.findByText(errors.invalid)).toBeTruthy();
  });

  it("accepts a number without the leading zero, with no grouping", async () => {
    openContact(code33);
    typeInto(await nameField(), NAME);
    const phone = await phoneField();

    typeInto(phone, "6 12 34 56 78");
    fireEvent.click((await continueButtons()).bar);

    expect(phone.value).toBe("612345678");
    await waitFor(() => {
      expect(window.location.pathname).toBe("/recapitulatif");
    });
  });
});

describe("the phone field and the draft", () => {
  it("shows an older draft reformatted once the country code is known", async () => {
    openContact({
      contactDraft: JSON.stringify({ version: 1, name: NAME, phone: PHONE, note: null }),
    });

    await waitFor(async () => {
      expect((await phoneField()).value).toBe(PHONE_DISPLAY);
    });
  });
});
