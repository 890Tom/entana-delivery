# Self-hosted map style

`generate-style.mjs` writes the `style.json` of the self-hosted map: a light, neutral basemap from [`@protomaps/basemaps`](https://github.com/protomaps/basemaps), labels in French, read from the archive that Caddy serves under `/maps/` (see [Add the map archive](../lightsail.md#add-the-map-archive)). Every resource of the style is on the site itself:

| In the style | Value                                                 |
| ------------ | ----------------------------------------------------- |
| Tiles        | `pmtiles:///maps/<archive>.pmtiles`                   |
| Fonts        | `/maps/fonts/{fontstack}/{range}.pbf`                 |
| Icons        | none: no sprite, the icons of the basemap are removed |

The script checks this itself: it fails if a source, its tiles or the fonts point to `http://`, `https://` or `//`, and if the style is not valid. The style, the fonts and the archive never go into the repository.

Run every step below on your own computer, then copy the result to the server. The folder `/tmp/maps-style` and the host `shop.example.com` are examples.

## 1. Install the libraries in a temporary folder

The two libraries are not dependencies of the repository. Install them outside it, at exact versions:

- `@protomaps/basemaps`: a version published **more than 24 hours ago**. List the versions and their dates with `npm view @protomaps/basemaps time --json` and take the most recent one that is old enough. The script was written for the 5.x versions: a new major version may change the layers, so read its changelog first.
- `@maplibre/maplibre-gl-style-spec`: the version that `maplibre-gl` uses in the repository (look for `@maplibre/maplibre-gl-style-spec@` in `pnpm-lock.yaml`), so that the style is checked by the same rules as the browser.

```sh
mkdir -p /tmp/maps-style
cd /tmp/maps-style
npm init -y
npm install --save-exact --ignore-scripts @protomaps/basemaps@<version> @maplibre/maplibre-gl-style-spec@<version>
```

## 2. Generate style.json

Node finds the libraries next to the script, so copy it into the folder, then run it with the name of the archive:

```sh
cp <repository>/deploy/maps/generate-style.mjs /tmp/maps-style/
node generate-style.mjs madagascar.pmtiles
```

**Expected result:** `Written: …/style.json`, the line `Every resource address is on the site; the style is valid.`, the layers changed because there is no sprite, and the font stacks the style uses, for example:

```text
Font stacks to copy to <MAPS_DIR>/fonts/:
  Noto Sans Italic
  Noto Sans Medium
  Noto Sans Regular
```

Any other ending is a failure, with its reason, and no file is written.

## 3. Get the fonts

The fonts come from the public repository [`protomaps/basemaps-assets`](https://github.com/protomaps/basemaps-assets). Copy **only the stacks the script printed**, each one a folder of `.pbf` files:

```sh
git clone --depth 1 https://github.com/protomaps/basemaps-assets.git /tmp/basemaps-assets
mkdir -p /tmp/maps-style/fonts
cp -R "/tmp/basemaps-assets/fonts/Noto Sans Regular" "/tmp/maps-style/fonts/"
```

Repeat the `cp` line for each stack of the list. The Noto Sans fonts are under the SIL Open Font License 1.1: read the licence file of the `fonts` folder of that repository, and keep it with the fonts if you redistribute them.

## 4. Extract the archive

Follow [Add the map archive](../lightsail.md#add-the-map-archive): it extracts `madagascar.pmtiles` and puts it in `/opt/entana/maps` on the server. The name must be the one given to the script in step 2.

## 5. Copy style.json and the fonts to the server

From `/tmp/maps-style`, send them to the home folder of the server, then move them into the maps folder (`MAPS_DIR`, for example `/opt/entana/maps`):

```sh
scp -i ~/Keys/LightsailDefaultKey-eu-central-1.pem -r style.json fonts ubuntu@203.0.113.10:~/
```

On the server:

```sh
sudo mv ~/style.json /opt/entana/maps/style.json
sudo mv ~/fonts /opt/entana/maps/fonts
sudo chmod -R a+rX /opt/entana/maps
```

## 6. Check

```sh
curl -s -o /dev/null -D - https://shop.example.com/maps/style.json
curl -s -o /dev/null -D - "https://shop.example.com/maps/fonts/Noto%20Sans%20Regular/0-255.pbf"
curl -s -o /dev/null -D - -r 0-16383 https://shop.example.com/maps/madagascar.pmtiles
```

**Expected result:** `200` for the style and the font range, `206` with a `content-range` for the archive. A `404` means a missing file or a name that differs from the style.

## 7. Updating the archive

Browsers keep what they read from `/maps/` for up to one hour, the style included. Never replace an archive in place: a browser could mix parts of the old and the new file.

1. Extract the new archive under a **new name**, for example `madagascar-2.pmtiles`, and copy it to the maps folder next to the old one.
2. Generate the style again with that name (`node generate-style.mjs madagascar-2.pmtiles`) and copy the new `style.json` over the old one.
3. Delete the old archive only after more than one hour, once no browser can still hold the old style.
