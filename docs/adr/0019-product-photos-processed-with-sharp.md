# 0019. Product photos: uploaded through the administration and processed with sharp

- Status: accepted
- Date: 2026-10-13

## Context

Until now a product photo was a file dropped by hand in the media folder. The product form of the
administration (task 6e) must let the shop send a photo from a phone or a computer. Such files are
untrusted, often huge (12 MP, several MB), rotated through EXIF, and they carry metadata (GPS
position, camera). The catalogue is served to customers on mobile networks.

## Decision

- **One dependency: `sharp`** (exact version, in `apps/api`). It reads the format from the content,
  decodes a header without decoding the pixels, applies the EXIF rotation, flattens transparency,
  crops and encodes WebP. It ships prebuilt binaries for glibc (the API image is Debian slim), so no
  compiler is needed in the image. Pure JavaScript decoders were slower and larger, and a command
  line tool (ImageMagick) would add a process and a policy file to harden.
- **No multipart package added.** The upload goes through the `FileInterceptor` of
  `@nestjs/platform-express`, which wraps multer, already a dependency of that package. The file
  stays in memory (10 MB maximum), only one file named `photo` is accepted, and no text field is.
- **A fixed pipeline.** Format by content (JPEG, PNG, WebP), at most 10 MB and 40 megapixels,
  short side at least 800 px; rotation applied then metadata dropped; transparent PNG flattened on
  white; centred square crop of at most 1000 px, never enlarged; WebP quality 85, lowered by steps of
  4 down to 65 until the file fits 150 KB (at the floor the file is kept).
- **Stored as `products/<uuid>.webp`.** The name changes at every replacement, so a file with that
  name is served with `Cache-Control: public, max-age=31536000, immutable`. Every other file (the
  branding folder, and a product file placed by hand, which can be replaced under its name) keeps
  the short cache, `public, max-age=3600`.
- **Replacement order.** New file written, database updated in one transaction (with the audit
  entry), previous file removed after the commit, best effort, only when no other product uses it
  (the demo files can be shared). A failed transaction removes the new file.
- **Photo without text alternative is refused.** The alternative text is sent before the photo.
- **Problem `type`.** The answers a client acts on carry `type: urn:entana:problem:<code>` with a
  fixed `detail`: the status alone does not tell `photo_too_small` from `photo_alt_required` (both 422).

## Consequences

- The API image gains the sharp binaries (about 30 MB) and decodes images in process: a 40
  megapixel image costs about 160 MB of memory while it is decoded, bounded by the pixel limit.
- A photo is never refused for its weight: only the quality floor and the bounded source keep it small.
- Photos sent before this change (JPEG or PNG dropped by hand) are untouched.

## Alternatives considered

- **Store the upload as it is:** no cost, but heavy files, EXIF location leaks and rotated photos.
- **Resize in the browser:** cannot be trusted, and the API would still need to validate the file.
- **A separate image service or CDN:** out of proportion for a single-shop deployment.
