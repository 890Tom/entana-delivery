# Test deployment on AWS Lightsail

This guide puts one shop online on one AWS Lightsail server, so that the shop owner can try it before a real launch. It is written for someone who has never used Lightsail: each step says where to click or what to type, and what you should see when it worked.

It runs the production stack described in the [deployment README](README.md#production-stack). It does **not** set up backups: they come in a later step. Until then, the only safety net is the Lightsail snapshot of [section 12](#12-minimal-safety-net-snapshots).

Every name and address below is fake. Replace them with your own, and never commit your real values:

| In this guide            | What it stands for                        |
| ------------------------ | ----------------------------------------- |
| `shop.example.com`       | Address of the customer site              |
| `admin.shop.example.com` | Address of the administration             |
| `203.0.113.10`           | Static IP address of the server           |
| `198.51.100.7`           | Public IP address of the administrator    |
| `admin@example.com`      | E-mail of the first administrator account |

Steps marked **(verify in the console)** could not be confirmed in the public AWS documentation. The console may show different labels: follow what it shows.

## Contents

1. [Before you begin](#1-before-you-begin)
2. [Create the instance](#2-create-the-instance)
3. [Static IP and firewall](#3-static-ip-and-firewall)
4. [Domain names](#4-domain-names)
5. [Prepare the server](#5-prepare-the-server)
6. [Get the code](#6-get-the-code)
7. [Configuration](#7-configuration)
8. [Start the stack](#8-start-the-stack)
9. [First administrator and checks](#9-first-administrator-and-checks)
10. [Testing with the shop owner](#10-testing-with-the-shop-owner)
11. [Updating](#11-updating)
12. [Minimal safety net: snapshots](#12-minimal-safety-net-snapshots)
13. [Deleting everything](#13-deleting-everything)
14. [Sources](#sources)

## 1. Before you begin

### Set a budget alert

Lightsail has no spending alert of its own. Create one in AWS Budgets before you create anything:

1. Open the Billing and Cost Management console at <https://console.aws.amazon.com/cost-management/>.
2. In the left menu, choose **Budgets**, then **Create budget**.
3. Under **Budget setup**, choose **Customize (advanced)**. Under **Budget types**, choose **Cost budget**, then **Next**.
4. Give the budget a name, for example `lightsail-test`. Set **Period** to **Monthly**, **Budget renewal type** to **Recurring budget** and **Budgeting method** to **Fixed**.
5. Enter a small amount, lower than what you are ready to pay in one month.
6. Under **Budget scope**, open **Advanced options** and choose **Use unblended costs**. Unblended costs are the costs before credits. With "net" costs, the credits would hide all spending and the alert would only fire once they run out. The documentation does not say which option is selected by default.
7. Choose **Next**, then **Add an alert threshold**. Add three alerts, each with your e-mail under **Email recipients**:
   - **50** % of budgeted amount, **Actual**;
   - **100** % of budgeted amount, **Actual**;
   - **100** % of budgeted amount, **Forecasted**.
8. Choose **Next** twice, check the summary, then choose **Create budget**.

**Expected result:** the budget appears in the list. Each e-mail recipient must verify their address before they get alerts: look for the verification e-mail.

### Check what your credits cover

1. In the Billing console, open the **Credits** page.
2. Choose each credit and read **Applicable products**, **Amount remaining** and **Expiration date**.

**Expected result:** Lightsail is in **Applicable products**. If it is not, the server is paid from the first hour. **Amount remaining** is updated only at the end of each billing cycle. For the estimate of the current month, open **Bills**, then the **Savings** tab.

### Write down the deletion date

Choose the date on which you delete the server if the test is not validated. It must come before the **Expiration date** of the credits. Put it in your calendar now. [Section 13](#13-deleting-everything) explains what to delete.

Prices are not written in this guide, because they change. See the official [Lightsail pricing page](https://aws.amazon.com/lightsail/pricing/), which lists the instance plans, static IP addresses and snapshots.

## 2. Create the instance

1. Sign in to the Lightsail console at <https://lightsail.aws.amazon.com/>.
2. On the home page, choose **Create instance**.
3. Choose **Change AWS Region and Availability Zone**, then pick **Frankfurt** (`eu-central-1`). Keep the proposed Availability Zone.
4. Under the platform, choose **Linux/Unix**. Under the blueprint, choose **OS Only**, then the most recent **Ubuntu** LTS on offer (at the time of writing, the documentation lists Ubuntu 24 and 22, so pick **Ubuntu 24.04 LTS**). **(verify in the console** which Ubuntu versions are offered.)
5. Keep the default SSH key pair of the Region. You can download its private key later, see [Connect from your own computer](#connect-from-your-own-computer).
6. Choose **Dual-stack** networking (IPv4 and IPv6), then the plan with **4 GB** of memory. **(verify in the console:** how the network type and the plans are labelled.) The images are built on the server, and smaller plans run out of memory during the build: on a 512 MB plan, the first build stopped with `signal: killed`.
7. Name the instance, for example `entana-test`.
8. Choose **Create instance**.

**Expected result:** after a few minutes, the instance shows **Running** on the home page, with a public IP address next to its name.

### Connect with the browser terminal

On the home page, open the menu (⋮) next to the instance and choose **Connect**. You can also open the instance, choose the **Connect** tab, then **Connect using SSH**.

**Expected result:** a terminal opens in a new window, with a prompt such as `ubuntu@ip-…:~$`. The user is `ubuntu`. It is not `root`, and it can use `sudo`. All the commands in this guide are typed in this terminal or in an SSH session.

### Connect from your own computer

This step is optional. The browser terminal is enough.

1. On the home page, choose your user name at the top, then **Account**, then the **SSH keys** tab.
2. Download the default key of the Frankfurt Region. Keep it as a `.pem` file.
3. On your computer, run:

   ```sh
   chmod 400 ~/Keys/LightsailDefaultKey-eu-central-1.pem
   ssh -i ~/Keys/LightsailDefaultKey-eu-central-1.pem ubuntu@203.0.113.10
   ```

**Expected result:** the Ubuntu welcome message, then the same prompt as in the browser terminal. Use the static IP address once you have it (section 3).

## 3. Static IP and firewall

### Static IP

Without a static IP, the public address changes each time the instance stops and restarts, and the DNS records would then point to the wrong server.

1. In the left menu of the Lightsail console, choose **Networking**, then **Create static IP**.
2. Choose the Frankfurt Region and the instance `entana-test`.
3. Name the address, for example `entana-test-ip`, then choose **Create**.

**Expected result:** on the **Networking** tab of the instance, a blue pushpin appears next to the public IP address. That address (here `203.0.113.10`) is the one your DNS records point to.

A static IP costs nothing while it is attached to an instance. It is billed once it is detached, for example after the instance is deleted. [Section 13](#13-deleting-everything) deletes it.

### IPv4 firewall

New Ubuntu instances allow **SSH (TCP 22)** and **HTTP (TCP 80)** from every address. The target is:

| Application | Protocol | Port | Source                                                       |
| ----------- | -------- | ---- | ------------------------------------------------------------ |
| SSH         | TCP      | 22   | The administrator's address only, plus Lightsail browser SSH |
| HTTP        | TCP      | 80   | Any                                                          |
| HTTPS       | TCP      | 443  | Any                                                          |

Nothing else. PostgreSQL and the API publish no port, so they need no rule.

1. Open the instance, then the **Networking** tab. Scroll to **IPv4 Firewall**.
2. Choose **Edit** (pencil icon) next to the **SSH** rule:
   - select **Restrict to IP address** and enter the administrator's public IPv4 address (`198.51.100.7`). It is the address your home or office connection uses on the internet. Your router or provider shows it;
   - select **Allow Lightsail browser SSH/RDP**. The browser terminal connects from AWS addresses, not from yours. Without this option, it stops working as soon as the rule is restricted;
   - save the rule.
3. Keep the **HTTP** rule as it is. Certificates need it (section 4).
4. Choose **Add rule**, pick **HTTPS** in **Application** (it fills in TCP and 443), leave **Restrict to IP address** unselected, then choose **Create**.

**Expected result:** three rules (SSH restricted, HTTP and HTTPS open to any address), and nothing else.

**If your address changes** (common with home connections), your own SSH client is refused. The browser terminal still works, because of **Allow Lightsail browser SSH/RDP**. Connect through it, or from the console, then edit the SSH rule with your new address.

### IPv6 firewall

The IPv6 firewall is separate from the IPv4 one, and new instances get the same default rules on both. This guide publishes no IPv6 address in the DNS (no `AAAA` record, section 4). The IPv6 firewall stays consistent with the IPv4 one:

1. On the same **Networking** tab, scroll to **IPv6 Firewall**.
2. Delete the **SSH** rule. **(verify in the console:** the delete icon of a rule.) The administrator connects over IPv4 or through the browser terminal.
3. Keep **HTTP**. Add **HTTPS** the same way as for IPv4.

**Expected result:** HTTP and HTTPS only, with no SSH.

## 4. Domain names

The customer site and the administration are two different names, on two different origins. Caddy obtains a Let's Encrypt certificate for each name when it starts. Both names must already point to the server **before the first start**: otherwise Let's Encrypt cannot reach the server, and Caddy gets no certificate.

### Create the records

At your domain registrar or DNS host, create two records:

| Type | Name                     | Value          | TTL |
| ---- | ------------------------ | -------------- | --- |
| A    | `shop.example.com`       | `203.0.113.10` | 300 |
| A    | `admin.shop.example.com` | `203.0.113.10` | 300 |

Many DNS hosts want only the part before your domain in **Name** (`shop` and `admin.shop`). Do not create an `AAAA` record.

### Check them

From your computer (macOS and Linux have `dig`; on Windows, use `nslookup shop.example.com`):

```sh
dig +short A shop.example.com
dig +short A admin.shop.example.com
dig +short AAAA shop.example.com
```

**Expected result:** the first two commands print `203.0.113.10`, and the third prints nothing. A new record can take from a few minutes to a few hours to show. Do not start the stack until both names answer.

### Free test hostnames

If the shop has no domain yet, use **DuckDNS** for the test. A purchased domain name is preferable for the final launch.

**Why DuckDNS and not sslip.io.** Let's Encrypt allows up to **50 certificates per registered domain every 7 days**, and finds the registered domain through the **Public Suffix List**. On 16 October 2026, the maintainer checked that list: `duckdns.org` is on it, `sslip.io` is not. So each DuckDNS name counts as its own registered domain, while every sslip.io user shares the same 50 certificates, and a request can fail because of other people's usage. sslip.io is not recommended.

Two other limits apply to every name: **5 certificates for the same exact set of names every 7 days** (no override), and **5 failed validations per name per account every hour**. Never delete the `caddy_data` volume: the certificates would be requested again.

**Set up the names:**

1. Sign in on <https://www.duckdns.org/> with one of the outside accounts it offers (its home page links to Google, GitHub, Twitter, Persona and Reddit).
2. Create one name, for example `your-name`, and set its address to the static IP (`203.0.113.10`). **(verify on the DuckDNS site:** the labels of these fields.) The IP is static, so no automatic update client needs to be installed.
3. Use `your-name.duckdns.org` for the customer site and `admin.your-name.duckdns.org` for the administration, in place of `shop.example.com` and `admin.shop.example.com` in the rest of this guide. The DuckDNS pages read for this guide say that a TXT record applies to every sub-subdomain, but not that an address does. Check it:

   ```sh
   dig +short A your-name.duckdns.org
   dig +short A admin.your-name.duckdns.org
   ```

   **Expected result:** both print `203.0.113.10`. If the second prints nothing, create a second DuckDNS name for the administration (for example `your-name-admin.duckdns.org`) with the same address, and use it as `ADMIN_HOST`. The pages read do not state how many names one account may have: the DuckDNS site shows it once you are signed in.

**The DuckDNS token is a secret of the maintainer.** It gives control over the names. It is never copied to the server, never put in `deploy/.env` or the shop file, and never committed.

## 5. Prepare the server

Run everything in this section on the server, in the browser terminal or over SSH.

### Updates

```sh
sudo apt update
sudo apt upgrade -y
```

If `/var/run/reboot-required` exists, reboot with `sudo reboot`, wait a minute, then reconnect.

### Swap

A 2 GB swap file gives the build some room when memory runs short. It is kept across reboots by the line added to `/etc/fstab`:

```sh
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
swapon --show
```

**Expected result:** `swapon --show` lists `/swapfile` with a size of `2G`.

### Docker Engine and the Compose plugin

Install from Docker's official repository, not from Ubuntu's `docker.io` package:

```sh
# Docker's official GPG key
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# The repository
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt update

# Docker Engine, Buildx and Compose
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker.service containerd.service
sudo docker run hello-world
```

**Expected result:** `hello-world` prints `Hello from Docker!`.

### git

```sh
sudo apt install -y git
git --version
```

### A non-root user for Docker

Use the `ubuntu` user. It is not `root`. Let it run Docker without `sudo`:

```sh
sudo groupadd docker          # "group 'docker' already exists" is fine
sudo usermod -aG docker $USER
```

Close the terminal and connect again, so that the new group applies. Membership of the `docker` group gives root-level rights on the server: add nobody else to it.

```sh
docker compose version
```

**Expected result:** `Docker Compose version v…`, without `sudo` and without a permission error.

## 6. Get the code

The configuration lives in `/opt/entana`, and the repository goes inside it, in its own folder:

```sh
sudo mkdir -p /opt/entana
sudo chown ubuntu:ubuntu /opt/entana
cd /opt/entana
git clone https://github.com/890Tom/entana-delivery.git
cd entana-delivery
git switch main
git log -1 --oneline
```

This test uses the `main` branch. Once the tag `v0.1.0` exists, switch to it (`git fetch --tags && git switch --detach v0.1.0`): a tag never moves, so the server runs a known version.

**Expected result:** the last commit of `main` is printed. Every `docker compose` command below is run from `/opt/entana/entana-delivery`, the root of the repository.

## 7. Configuration

Two files and an optional folder, all on the server only. None goes into the repository.

### The shop file

```sh
cp examples/demo/instance.config.yaml /opt/entana/instance.config.yaml
nano /opt/entana/instance.config.yaml
```

Adapt it to the shop: at least `shop.name`, `phoneCountryCode`, and, if needed, the `map` centre (you can also set it later, see [Set the map centre](#set-the-map-centre)) and the `contact` phone. The comments in the file explain each field. Everything in it is public (it is served to every visitor), so put no secret in it. Keep its default permissions: the API container must be able to read it. The shop's two colours go in the same file: see [Set the shop colours](#set-the-shop-colours).

### The environment file

```sh
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" deploy/.env
nano deploy/.env
```

The `sed` line puts a generated password (`openssl rand -hex 24`) in place of the placeholder, so the password is never shown on the screen. In `nano`, set:

| Variable               | Value for this guide               |
| ---------------------- | ---------------------------------- |
| `CLIENT_HOST`          | `shop.example.com`                 |
| `ADMIN_HOST`           | `admin.shop.example.com`           |
| `POSTGRES_PASSWORD`    | Already generated: leave it        |
| `INSTANCE_CONFIG_FILE` | `/opt/entana/instance.config.yaml` |

Leave the other lines as they are. `deploy/.env` holds the database password: never copy it anywhere else, and never commit it.

### Icons, manifest and themes (optional)

Skip this step to start with the demo icons, colours and themes. You can add them later.

These files are built into the web image. The logo shown in the header of the customer app and of the administration is a different mechanism: it is a media file named in the shop file, added once the stack runs (see [Add the shop logo](#add-the-shop-logo)). So are the two brand colours: they are set in the shop file, with no build (see [Set the shop colours](#set-the-shop-colours)). The `theme_color` of the manifest and the icons stay in this folder.

The shop's icons, manifest and themes go in a folder on the server, `/opt/entana/overrides`, outside the repository. It holds the shop's brand: it never goes into the repository. Create it:

```sh
mkdir -p /opt/entana/overrides/client/public/icons /opt/entana/overrides/admin/public
```

Then put the shop's files there, each one optional (copy them from your own computer with `scp`, see [section 2](#connect-from-your-own-computer)):

| File in `/opt/entana/overrides`      | What it holds                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `client/public/icons/`               | `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `favicon-32.png`, same sizes as the demo |
| `client/public/manifest.webmanifest` | The shop's `name`, `short_name`, `theme_color` (a hex colour such as `#1a2b3c`) and `background_color`                    |
| `client/public/theme.local.css`      | Theme of the customer app                                                                                                 |
| `admin/public/theme.local.css`       | Theme of the administration                                                                                               |

Nothing else may be in the folder: any other file stops the build. A Mac adds hidden `.DS_Store` files to the folders it opens, so delete them in your local copy before sending it (replace `~/overrides` with your folder), then check the server:

```sh
find ~/overrides -name .DS_Store -delete
find /opt/entana/overrides -name .DS_Store -print -delete
```

The first command runs on your own computer, the second on the server; the second prints nothing when the folder is clean. Finally, in `deploy/.env`, remove the `#` in front of `OVERRIDES_DIR=/opt/entana/overrides`.

The files are built into the image. **After any change to the folder**, rebuild the web image and restart (`build caddy`, then `up -d --wait`, see [section 8](#8-start-the-stack)); installed apps then show their usual update notice.

### Check before starting

```sh
test -f /opt/entana/instance.config.yaml && echo "shop file: OK"
ls -l deploy/.env
dig +short A shop.example.com
dig +short A admin.shop.example.com
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml config --quiet && echo "compose: OK"
```

**Expected result:** `shop file: OK`; `deploy/.env` shows `-rw-------`; both names print the static IP; and `compose: OK`. If a required value is missing, `config` stops with its message instead, for example `Set POSTGRES_PASSWORD in deploy/.env`. Do not drop `--quiet`: without it, the command prints the configuration with the password. If `dig` is missing on the server, install it with `sudo apt install -y bind9-dnsutils`.

If you set `OVERRIDES_DIR`, also check `test -d /opt/entana/overrides && echo "branding: OK"`. When that folder is missing, the build stops with `additional privileges requested: pass "--allow=fs.read=/opt/entana"`: create the folder or fix the path, never pass `--allow`.

## 8. Start the stack

Build the images one at a time, so that two builds never share the memory, then start the stack:

```sh
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml build migrate
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml build api
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml build caddy
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml up -d --wait
```

The first build takes several minutes. The `up` command returns once every service is running, and healthy where it has a health check.

```sh
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml ps -a
```

**Expected result:**

| Service    | Status                                                        |
| ---------- | ------------------------------------------------------------- |
| `postgres` | `Up … (healthy)`                                              |
| `migrate`  | `Exited (0)`: it applied the migrations, then stopped. Normal |
| `api`      | `Up … (healthy)`                                              |
| `caddy`    | `Up …`                                                        |

### Watch the certificates

`--wait` does not wait for the certificates. Caddy requests them once it is running:

```sh
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml logs -f caddy
```

**Expected result:** within a minute or two, a line saying that the certificate was obtained successfully for `shop.example.com`, and another for `admin.shop.example.com`. Stop following the logs with `Ctrl+C`.

### The three most likely start errors

| Symptom                                                                                                                                | Cause                                     | Remedy                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The Caddy logs show errors for a name while obtaining its certificate (DNS lookup, no valid address, unauthorized)                     | DNS not propagated yet, or a wrong record | Check with `dig +short A <name>` until it prints the static IP, then `docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml restart caddy`. Do not restart in a loop: Let's Encrypt allows 5 failed validations per name per hour. |
| The certificate request times out, and `http://shop.example.com` does not answer                                                       | Port 80 closed in the Lightsail firewall  | Let's Encrypt's HTTP challenge can only use port 80. Add the **HTTP** rule back (section 3), then `restart caddy` as above.                                                                                                                          |
| `up` stops before `api` starts, with an error saying that the bind mount source path `/opt/entana/instance.config.yaml` does not exist | Shop file missing, or a wrong path        | Create the file (section 7), or fix `INSTANCE_CONFIG_FILE` in `deploy/.env`, then run the `up` command again. The stack never creates this file itself.                                                                                              |

Never run `down -v` to "start clean": it deletes the database and `caddy_data`, the volume that keeps the certificates.

### Add the shop logo

The logo in the header of the customer app (every screen, tracking included) and of the administration is a file of the `media` volume, named in the shop file. Without it, the header shows the shop name. It is not the icons of [section 7](#icons-manifest-and-themes-optional), which are built into the web image.

- Formats: `.png`, `.webp` or `.jpg` (not `.jpeg`: rename it), **never `.svg`**. The name is letters, digits, `.`, `_` and `-` only, for example `logo.png`.
- The logo never goes into the repository: it stays on your computer and on the server.
- It lives in the `media` volume, with the product photos: back it up with the database.

On your own computer, send the file to the home folder of the server (see [section 2](#connect-from-your-own-computer)):

```sh
scp -i ~/Keys/LightsailDefaultKey-eu-central-1.pem logo.png ubuntu@203.0.113.10:~/logo.png
```

Then, on the server, from `/opt/entana/entana-delivery`:

```sh
sudo mv ~/logo.png /opt/entana/logo.png
sudo chmod 644 /opt/entana/logo.png
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml cp /opt/entana/logo.png api:/media/branding/logo.png
nano /opt/entana/instance.config.yaml
```

In `nano`, uncomment the `branding` section and keep only the logo line:

```yaml
branding:
  logoFile: logo.png
```

The API reads the shop file only when it starts, so restart it, then check the file:

```sh
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml restart api
curl -sI https://shop.example.com/media/branding/logo.png
```

**Expected result:** `HTTP/2 200` and `content-type: image/png` (`image/webp` or `image/jpeg` for the other formats). Reload the customer site: the logo replaces the shop name in the header. A `404` means that the file is not in the volume or that its name differs from `logoFile`.

**Replacing the logo under the same name:** browsers keep it for up to one hour (`Cache-Control: max-age=3600`), so the old logo can stay visible that long. A new file name (for example `logo-2.png`, named in `logoFile`, then `restart api`) shows at once.

### Set the map centre

The delivery map of the customer app and the map of **Paramètres** open on the `map` section of the shop file. Without it, they open on Antananarivo at zoom 12. To centre them on the shop:

```sh
nano /opt/entana/instance.config.yaml
```

Uncomment the `map` section and set `center` (latitude and longitude, in decimal degrees) and `zoom` (from 1 to 18). Keep the default `styleUrl`:

```yaml
map:
  styleUrl: https://tiles.openfreemap.org/styles/liberty
  center: { lat: -18.91, lng: 47.52 }
  zoom: 12
```

Restart the API, which reads the file only when it starts, then check:

```sh
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml restart api
curl -s https://shop.example.com/api/v1/instance
```

**Expected result:** the `map` object of the answer shows the new centre and zoom. The answer can be cached for up to one minute. If `restart` leaves the API unhealthy, read `docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml logs api`: an invalid value stops the API with the name of the key at fault.

### Set the shop colours

The shop sets two colours in the shop file: an **accent** (selection and state: the cart count, the current step, the selected options) and an **action** (the main buttons and the other dark marks). The API derives the other shades and the text colours from them, checks them when it starts, and the customer app and the administration paint themselves with the result. There is no image to build.

Both keys are required, written as `#rrggbb` (no short form, no colour name). Neutral colours as an example, to replace with the shop's own:

```yaml
branding:
  colors:
    accent: "#2d6cdf"
    action: "#2b2b2b"
```

If the shop also has a logo, keep `logoFile` in the same `branding` section.

**A refused colour stops the API from starting**, so work in this order.

1. Keep a copy of the working file, outside the repository:

   ```sh
   cp /opt/entana/instance.config.yaml /opt/entana/instance.config.yaml.bak
   ```

2. Test the new file before it replaces the working one. On your own computer, in a copy of the repository where you ran `pnpm install` and `pnpm build`, with the `.env` of the development setup (copied from `.env.example`), start the API with the new file:

   ```sh
   INSTANCE_CONFIG_PATH=/path/to/new-instance.config.yaml pnpm --filter @entana/api start
   ```

   **Expected result:** the API starts (stop it with Ctrl+C). A refused colour prints a message and the command ends at once with a failure.

3. On the server, edit the shop file, restart the API, then check the answer:

   ```sh
   nano /opt/entana/instance.config.yaml
   docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml restart api
   curl -s https://shop.example.com/api/v1/instance
   ```

   **Expected result:** the answer holds a `theme` object with seven colours (`null` when the file sets none). The answer can be cached for up to one minute, so a reload can show the old colours for that long. The customer app keeps the last theme it received on each device and replaces it when the new answer arrives; the administration applies it at every load.

4. If the API does not start again, read why, restore the copy and restart:

   ```sh
   docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml logs api
   cp /opt/entana/instance.config.yaml.bak /opt/entana/instance.config.yaml
   docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml restart api
   ```

   A colour that is too pale (contrast under 3:1 on white) is refused, and the message says which one and the contrast obtained, for example `branding.colors.accent : contraste de 1,28:1, 3:1 minimum`. Choose a darker colour. Any other mistake (a missing key, a three-digit short form, a colour name, an unknown key) is reported as `Clés à corriger :` followed by the key, for example `branding.colors.action`.

To go back to the generic colours, remove the `colors` lines (or the whole `branding` section if it holds nothing else) and restart the API.

**What the colours do not change.** The `theme_color` of the manifest, the `theme-color` meta tag and the icons are built into the web image: they stay in the overrides folder (see [Icons, manifest and themes](#icons-manifest-and-themes-optional)). The error and success colours, the shadows, the ink of the text and the colours of the delivery axes are not customisable. The action colour also fills the step dots, the map pins and markers, the dark status pills and the veil of the modal windows of the administration.

**Moving from `theme.local.css`.** If the shop's private themes already set these colours:

1. Put the accent and the action in `branding.colors`, as above.
2. In the private `theme.local.css` of the customer app and of the administration, remove `--color-accent-100`, `--color-accent-500`, `--color-accent-800` and `--color-ink-hover`: the instance now supplies these shades, and the colours it writes win over this file. Keep `--color-ink`, which still sets the text, the strong borders and the focus ring; it no longer sets the action colour.
3. In the private theme of the **customer app** only, define `--color-success-500` with the value the accent had: the success notice used to follow the accent and now has its own colour. Without this line it shows the generic colour of the repository.
4. These files are built into the image, so build and restart again, as in [Icons, manifest and themes](#icons-manifest-and-themes-optional).

## 9. First administrator and checks

### Create the first administrator

No demo data is loaded in production. Create the first account; the password is typed twice, hidden:

```sh
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml exec api node dist/cli/admin-upsert.js admin@example.com
```

**Expected result:** `Account created.` Running the same command again for the same e-mail changes the password (`Password updated.`).

### Check

| Check                   | How                                                                                                                 | Expected                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Administration in HTTPS | Open `https://admin.shop.example.com/connexion`                                                                     | A padlock in the address bar, the sign-in page; signing in with the new account works |
| Customer site           | Open `https://shop.example.com`                                                                                     | The shop opens, with an empty catalogue                                               |
| API ready               | `curl -s -o /dev/null -w '%{http_code}\n' https://shop.example.com/api/v1/health/ready`                             | `200` (the body is `{"status":"ready"}`)                                              |
| Administration map      | In the administration, open **Paramètres** (`/parametres`)                                                          | The map shows its tiles                                                               |
| Service worker          | On the customer site, open the developer tools, then **Application**, then **Service workers**                      | `sw.js` is listed for `https://shop.example.com`, activated and running               |
| Installation, Android   | Open the customer site in Chrome on an Android phone                                                                | Chrome offers to install the app; once installed, it opens from the home screen       |
| Installation, iPhone    | Open the customer site in Safari, choose **Share**, then **Add to Home Screen** (French: « Sur l'écran d'accueil ») | The icon appears on the home screen and opens the shop                                |
| Not indexed             | `curl -sI https://shop.example.com \| grep -i x-robots-tag`                                                         | `x-robots-tag: noindex, nofollow` (both sites send it)                                |

The Content-Security-Policy still has to be confirmed in a browser (see the [deployment README](README.md#web-image)). While you check the pages above, keep the developer tools **Console** open. Report any `Content-Security-Policy` error, especially one about styles.

## 10. Testing with the shop owner

- Enter the real catalogue through the administration: products, prices, photos, delivery axes and the out-of-axis fee in **Paramètres**.
- Place test orders from a phone, then follow them through confirmation, delivery and cancellation in the administration.
- **No real customer data.** Use made-up names and fake phone numbers in the test orders, and do not share the address with real customers. Test orders stay in the database.
- Both sites send `X-Robots-Tag: noindex, nofollow`, so search engines do not list them. Anyone with the address can still open them.
- Until you add them, the icons, colours and themes are the generic ones of the repository, and the header shows the shop name in place of a logo. Add the shop's own with [Icons, manifest and themes](#icons-manifest-and-themes-optional), [Set the shop colours](#set-the-shop-colours) and [Add the shop logo](#add-the-shop-logo).

## 11. Updating

1. Take a snapshot first ([section 12](#12-minimal-safety-net-snapshots)).
2. Note the version that runs now, to be able to go back:

   ```sh
   cd /opt/entana/entana-delivery
   git log -1 --oneline
   ```

3. Get the new version: `git pull` on `main`, or `git fetch --tags && git switch --detach <new tag>` once tags exist.
4. Rebuild the images one at a time, as in section 8, then restart. `migrate` runs again on its own, before the API restarts:

   ```sh
   docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml build migrate
   docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml build api
   docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml build caddy
   docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml up -d --wait
   ```

   Rebuild only the image that changed: for example, when the update touches only the customer app or the administration, run `build caddy` alone, then `up -d --wait`. `caddy` holds both front ends, `api` the API, `migrate` the database migrations; a change to `packages/contracts` reaches both `api` and `caddy`. When unsure, build all three.

   `deploy/update.sh` runs this step and the checks of step 5 in one command: `bash deploy/update.sh` builds the three images, `bash deploy/update.sh caddy` only the one named. It stops before building when `deploy/.env` is missing, the compose configuration is invalid or a tracked file was changed on the server.

5. Check:

   ```sh
   docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml ps -a
   docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml run --rm migrate
   ```

   **Expected result:** the same statuses as in section 8, and `No pending migrations to apply.` Then repeat the API, customer site and administration checks of section 9.

### Going back

Switch back to the version noted in step 2 (`git switch --detach <previous tag or commit>`), then run the commands of step 4 again.

**Database migrations are not undone.** Going back changes the code only. If the new version applied a migration that the old code cannot work with, the only way back is to restore the snapshot of step 1, and everything entered since that snapshot is lost.

## 12. Minimal safety net: snapshots

Until real backups exist, take a manual snapshot before every update:

1. On the Lightsail home page, choose the instance, then the **Snapshots** tab.
2. Under **Manual snapshots**, choose **Create snapshot**, enter a name (for example `entana-test-2026-10-16`), then choose **Create**.

**Expected result:** the snapshot shows **Snapshotting...**, then appears in the list.

**This is not a production backup.** A snapshot copies the whole system disk, in the same account and the same Region. Restoring it means creating a new instance from it, and everything entered after it was taken is lost. Nothing tests it, and its storage is billed every month until you delete it. Backups of the database and the media come in a later step.

## 13. Deleting everything

When the test ends, or on the date written down in section 1:

1. **Instance.** On the Lightsail home page, open the menu (⋮) of the instance, choose **Delete**, then **Yes, delete**. Its automatic snapshots go with it. Manual snapshots and the static IP stay, and they are still billed.
2. **Static IP.** In the left menu, choose **Networking**. Open the menu (⋮) next to the static IP, then choose **Delete**. A static IP that is not attached to an instance is billed.
3. **Snapshots.** Open the **Snapshots** page and expand the instance. On each snapshot, open the menu (⋮), choose **Delete snapshot**, then **Yes**.
4. **DNS.** Delete the two `A` records at your registrar, so that the names no longer point to an address that AWS may give to someone else.
5. **Budget alert.** Keep it. It warns you about anything forgotten.

**Expected result:** the Lightsail home page lists no instance, the **Networking** page no static IP, and the **Snapshots** page nothing. Check the next bill in the Billing console.

## Sources

Official pages read for this guide:

- Lightsail: [Create Linux/Unix instances](https://docs.aws.amazon.com/lightsail/latest/userguide/getting-started-with-amazon-lightsail.html)
- Lightsail: [Instance blueprints](https://docs.aws.amazon.com/lightsail/latest/userguide/compare-options-choose-lightsail-instance-image.html)
- Lightsail: [Set up SSH keys](https://docs.aws.amazon.com/lightsail/latest/userguide/lightsail-how-to-set-up-ssh.html)
- Lightsail: [Connect with the SSH command](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-ssh-using-terminal.html)
- Lightsail: [Create and attach a static IP](https://docs.aws.amazon.com/lightsail/latest/userguide/lightsail-create-static-ip.html)
- Lightsail: [Static IP addresses](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-static-ip-addresses-in-amazon-lightsail.html)
- Lightsail: [Delete a static IP](https://docs.aws.amazon.com/lightsail/latest/userguide/how-to-delete-static-ip.html)
- Lightsail: [Instance firewalls](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-firewall-and-port-mappings-in-amazon-lightsail.html)
- Lightsail: [Add firewall rules](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-editing-firewall-rules.html)
- Lightsail: [Enable or disable dual-stack networking](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-enable-disable-ipv6.html)
- Lightsail: [Snapshots](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-snapshots-in-amazon-lightsail.html)
- Lightsail: [Create an instance snapshot](https://docs.aws.amazon.com/lightsail/latest/userguide/lightsail-how-to-create-a-snapshot-of-your-instance.html)
- Lightsail: [Delete snapshots](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-deleting-snapshots.html)
- Lightsail: [Delete instances](https://docs.aws.amazon.com/lightsail/latest/userguide/delete-an-amazon-lightsail-instance.html)
- Lightsail: [Pricing](https://aws.amazon.com/lightsail/pricing/)
- AWS Budgets: [Creating a budget](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-create.html)
- AWS Budgets: [Creating a cost budget](https://docs.aws.amazon.com/cost-management/latest/userguide/create-cost-budget.html)
- AWS Billing: [Applying AWS credits](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/useconsolidatedbilling-credits.html)
- Docker: [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- Docker: [Linux post-installation steps](https://docs.docker.com/engine/install/linux-postinstall/)
- Docker: [docker compose up](https://docs.docker.com/reference/cli/docker/compose/up/)
- Let's Encrypt: [Rate limits](https://letsencrypt.org/docs/rate-limits/)
- Let's Encrypt: [Challenge types](https://letsencrypt.org/docs/challenge-types/)
- DuckDNS: [Home page](https://www.duckdns.org/), [Specification](https://www.duckdns.org/spec.jsp), [FAQ](https://www.duckdns.org/faqs.jsp)
