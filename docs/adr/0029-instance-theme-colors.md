# 0029. Instance theme colours: two colours in the instance file, derived by a pure function

- Status: accepted
- Date: 2026-10-26

## Context

Two mechanisms can change the colours of the applications:

- **`theme.local.css`**, a private file for each application, built into the web image (ADR 0025). Any token can be replaced, but every change means building the image again, nothing checks that the text stays readable, and the customer app and the administration each have their own file to keep in step.
- **The instance configuration file** (`instance.config.yaml`), read by the API when it starts and served in part by `GET /api/v1/instance`. A change means restarting the API.

A shop wants to set its colours where it already sets its name and its logo, once, for the customer app and the administration, and without being able to make the text unreadable by mistake.

## Decision

- **Two colours**, `accent` and `action`, in an optional `branding.colors` section of the instance file. Both keys are required when the section is present. A colour is `#rrggbb` only (either case, kept in lower case): no short form, no name, no function. The schema is strict.
- **The other colours are derived by a pure function**, `deriveInstanceTheme`, in `packages/contracts/src/instance/theme/` (no dependency but Zod). It returns seven hex values:
  - `accent` and `action`, as given;
  - `accentSoft`: 15 % accent mixed with 85 % white;
  - `accentStrong`: the accent darkened toward black in steps of 10 % until it reaches 4.5:1 on `accentSoft`;
  - `actionHover`: the action 20 % lighter under dark text, 15 % darker under white text; the other direction when the first would fall under 4.5:1 against the text;
  - `textOnAccent` and `textOnAction`: see the next point.
- **Text on a colour** is the better of white and a fixed dark (a named constant in `contracts`, independent of the ink of the theme); black when neither reaches 4.5:1. Text is therefore readable by construction on any colour that passes the check below.
- **Validation when the API starts**, in `loadInstanceConfig`: `accent` and `action` must each reach 3:1 on white (a part of the interface that is not text, WCAG 1.4.11). A colour that does not stops the API like any other configuration error, with a message in French that names the key and the contrast reached (for example `branding.colors.accent : contraste de 1,28:1, 3:1 minimum`), never the value.
- **Public instance**: `GET /api/v1/instance` answers a new field, `theme`, which is `null` when the file sets no colours and the seven values otherwise. It is required in the schema (nullable), like the other fields: the client and the API are deployed together. The 60-second HTTP cache does not change.
- **Customer app**: `applyInstanceTheme` writes the seven values as inline CSS variables on `document.documentElement` (`style.setProperty`, which the Content-Security-Policy allows, ADR 0026). It writes the **roles** of the design, not the palette: `accent` to `--color-accent`, `accentSoft` to `--color-accent-soft`, `accentStrong` to `--color-accent-strong`, `textOnAccent` to `--color-text-on-accent`, `action` to `--color-surface-inverse`, `actionHover` to `--color-ink-hover`, `textOnAction` to `--color-text-inverse`.
  - It runs inside the query function of the instance, before the answer reaches a component, because the maps read the colours only once, when they are created.
  - The last theme is kept in `localStorage` under `entana.theme.v1`. Every read and write is in a `try/catch`, and a stored theme is validated with the same strict schema as the public instance when it is read: an invalid one is never applied and is removed. Before the first render, `main.tsx` applies the stored theme synchronously, so nothing flashes.
  - A `theme` of `null` removes the seven variables and the stored theme. When the instance cannot be loaded, the stored theme stays.
- **Administration**: the same writing, in the query function of the instance, with no local memory and no synchronous start. The administration is behind a sign-in, so a short flash of the default colours at the first display is accepted.
- **Priority**: the variables written from the instance win over `theme.local.css`, which still sets everything else.
- **Text on the accent**: every rule that sets text on the accent fill reads `--color-text-on-accent`, never the ink (a test of the stylesheets checks the cases known today). The "light" text of the numbered badges of an axis reads the white of the palette instead of `--color-text-inverse`: it sits on a colour chosen by the shop, not on the action colour.
- **Success**: the success notice of the customer app has its own tokens (`--color-success-500`, `--color-success`, `--color-text-on-success`), so that it no longer follows the accent.

## Consequences

- Changing the colours of a shop means editing the instance file and restarting the API: no image to build. The HTTP cache can delay the change by up to a minute, and the customer app shows the last theme it received until the new answer arrives.
- A colour under 3:1 on white stops the API from starting. A deployment keeps a copy of the working file and tests a new one before replacing it (see the deployment guide).
- **What stays fixed at build time** (deployment overrides, ADR 0025): the `theme_color` of the manifest, the `theme-color` meta tag and the icons.
- **What cannot be customised**: the colours of the delivery axes (data chosen in the administration), the error and success colours, the shadows, and the ink used for text, strong borders and the focus ring.
- **The action colour paints more than buttons.** It also fills the other "ink-filled" elements of the design: the step dots, the delivery pin and the map markers, the marks of the tracking timeline, the dark status pills, the knob of a switch and the native checkboxes of the administration, and the veil of the modal window (50 % of the action colour).
- An existing `theme.local.css` keeps working. Its accent variables and `--color-ink-hover` no longer have any effect once the instance sets colours, and the success notice needs `--color-success-500` there to keep its colour (see the deployment guide).
- The writing of the theme exists twice, in the customer app and in the administration, like the tokens themselves (ADR 0018).

## Alternatives considered

- **The whole palette customisable:** more freedom, but every combination of colours is a risk for readability, the public contract grows with every token, and the validation would have to cover each pair. Two colours cover what a shop shows as its brand.
- **A third colour:** nothing in either interface would use it.
- **A local memory in the administration:** it is behind a sign-in, so the flash is acceptable, and a stored value is one more path to validate.
