# 0025. Web image and deployment overrides

- Status: accepted
- Date: 2026-10-16

## Context

The customer app and the administration are static files once built. A deployment has to serve them, and has to give the customer app its own identity: icons, name and colours in the web app manifest, the `theme-color` meta tag, and a private theme (`theme.local.css`) for each application. The repository holds only generic values (no logo, shop name or real colour), so these files come from the deployment.

The customer app has a service worker (ADR 0023) that precaches the HTML, scripts, styles, fonts, icons, manifest and `theme.local.css`. Workbox writes the revision of each precached file into `sw.js` at build time; the browser fetches a precached file again only when its revision changes.

## Decision

- **One image for both front ends** (`deploy/web/Dockerfile`, build context: the repository root). A build stage, with the same pinned Node and pnpm as the API and migrate images (ADR 0012, ADR 0024), installs from the frozen lockfile and builds `contracts`, the client and the admin. The final stage is the official Caddy image, pinned to an exact version (`caddy:2.11.7-alpine`), with the client in `/srv/client` and the admin in `/srv/admin`. Only the built files are copied: no `node_modules`, no source map, no `icons-source`.
- **Overrides through a named build context, applied before the build.** The Dockerfile declares an empty stage, `FROM scratch AS overrides`, so a build without overrides works and produces the demo application. A deployment replaces it with `docker build --build-context overrides=<folder>`. The folder mirrors the applications, and only `client/public/` and `admin/public/` are accepted: any other file fails the build, so an override never replaces code. The overrides are bind-mounted into the step that applies them (`RUN --mount=type=bind,from=overrides`), not copied: a `COPY` of an empty context found an old entry of the BuildKit cache and brought back the files of an earlier override. In production, Compose provides the `overrides` context (`additional_contexts`, from the `OVERRIDES_DIR` variable).
- **The `theme-color` meta tag follows the manifest.** The build stage copies `theme_color` from the final `manifest.webmanifest` into the meta tag of `index.html`, and fails with a clear message if it is not a hex colour. A deployment sets its colour once, and the repository keeps `#ffffff`.
- **`.dockerignore` excludes `**/theme.local.css`**, so the git-ignored theme of a developer's machine never enters the build context, and a build without overrides ships an empty theme. A theme reaches the image only as an override.
- **`.dockerignore` lets through the `storage` folders of the client only** (`!apps/client/src/**/storage`): they are tracked code, not runtime data. The `**/storage` rule stays for every other path.
- **No Caddyfile yet.** The image holds the static files only; the server configuration is a separate step.

## Consequences

- An override changes the files before Workbox computes their revisions, so `sw.js` changes with them and installed apps receive the new icons, manifest and theme through the usual update notice.
- Changing an icon, the manifest or a theme means building the image again; there is no file to edit on the server.
- The image is small (about 95 MB on disk, mostly the Caddy base) and holds no secret: the front ends are public files.
- The Node and pnpm versions now appear in three Dockerfiles, which must stay equal.
- The two brand colours of an instance are not an override: they come from the instance file at run time and win over `theme.local.css` (ADR 0029).
- The map files are not an override: the archive is too large for the image, so its folder is mounted read-only at run time instead of passing through the build context (ADR 0030).

## Alternatives considered

- **Mounting the override files at run time:** the files served would change, but `sw.js` would keep the revisions of the build. Installed apps would keep the old precached icons, manifest and theme, and could mix old and new files.
- **Editing `index.html` and the manifest in the repository for each deployment:** puts private values in the repository, or forces a fork.
- **A separate image per front end:** two images to build, version and run for two folders of static files. One server already has to route both origins, so one image with both folders is simpler.
- **Serving the front ends from the API:** mixes static files with the API process and its image, which stays limited to the API (ADR 0012).
