# Deploying to GitHub Pages with a Cloudflare domain

Setup: **`www.dcpnewyork.com` is the primary address**, the apex
(`dcpnewyork.com`) redirects to it, repo is **public**, hosted from the `main`
branch.

Every value below is filled in and ready to use as-is.

---

## 1. Create the repository

On <https://github.com/new>:

- **Name:** `dcp-new-york`
- **Visibility:** Public
- **Do not** add a README, `.gitignore`, or licence — the repo already has
  history and those would collide.

## 2. Push

The local repo is already initialised and committed on `main`.

```bash
cd "C:/Users/DNJC/Documents/Git Repos/DCP New York"
git remote add origin https://github.com/dcnyc/dcp-new-york.git
git push -u origin main
```

If GitHub asks to authenticate, use a Personal Access Token as the password
(<https://github.com/settings/tokens>, scope `repo`), or install GitHub CLI and
run `gh auth login`.

## 3. Turn on Pages

**Settings → Pages → Source: GitHub Actions**

The site is published by `.github/workflows/pages.yml`, not by branch deploys.
The workflow copies an explicit allowlist of files into `_site` and uploads
only that, so `README.md`, `DEPLOY.md`, `tools/` and the dotfiles stay in the
repository but are never reachable on the live domain. It then fails the build
if any of them somehow made it in.

**When you add a new page folder, add it to the `PUBLISH` list in that
workflow** — anything not named there is not published, which is the point.

It publishes at `https://dcnyc.github.io/dcp-new-york/` within a minute
or two. Confirm that works before touching DNS — it isolates any build problem
from any DNS problem.

## 4. Custom domain

**Settings → Pages → Custom domain** → enter `www.dcpnewyork.com` → Save.

The repo already contains a `CNAME` file with this value, which is the same
thing that box writes. Leave **Enforce HTTPS** unchecked for now; you cannot
tick it until the certificate exists (step 6).

## 5. Cloudflare DNS

**DNS → Records.** Add five records. Set every one to **DNS only** (grey
cloud), not Proxied — this matters, see the warning below.

| Type  | Name  | Content                   | Proxy    |
| ----- | ----- | ------------------------- | -------- |
| CNAME | `www` | `dcnyc.github.io`         | DNS only |
| A     | `@`   | `185.199.108.153`         | DNS only |
| A     | `@`   | `185.199.109.153`         | DNS only |
| A     | `@`   | `185.199.110.153`         | DNS only |
| A     | `@`   | `185.199.111.153`         | DNS only |

The `www` CNAME is what actually serves the site. The four apex `A` records
point the bare domain at GitHub, which then redirects it to `www` on its own —
no Cloudflare redirect rule needed.

Optionally add the IPv6 apex records too:

```
2606:50c0:8000::153
2606:50c0:8001::153
2606:50c0:8002::153
2606:50c0:8003::153
```

The zone is currently empty (0 of 200 records), so there is nothing to remove
first — these five are the only records the site needs.

## 6. SSL — the two settings that break this

> **Not already done.** The `DNS Setup: Full` badge on the DNS page is a
> different setting — it only means Cloudflare is authoritative for the zone.
> The encryption mode below lives under **SSL/TLS** and is set separately.

> **SSL/TLS → Overview → set encryption mode to `Full`.**
> If it is left on **Flexible**, the site enters an infinite redirect loop.
> Cloudflare talks to GitHub over HTTP, GitHub redirects to HTTPS, Cloudflare
> follows it back round, forever. This is the single most common failure in
> this setup.

> **Keep the records on DNS only (grey cloud) until the certificate is issued.**
> GitHub proves domain ownership over plain HTTP. With Cloudflare's proxy in
> front, that check cannot reach GitHub and the certificate never appears, so
> **Enforce HTTPS** stays greyed out.

Once DNS has propagated, GitHub provisions a Let's Encrypt certificate
automatically — usually minutes, occasionally up to an hour. Then:

**Settings → Pages → tick Enforce HTTPS.**

## 7. Optional: turn the proxy on

Only after Enforce HTTPS is ticked and working. Flip the records to **Proxied**
(orange cloud) for Cloudflare's CDN, analytics and WAF, and enable
**SSL/TLS → Edge Certificates → Always Use HTTPS**.

Encryption mode must still be **Full**.

Honest trade-off: proxying puts Cloudflare's cache in front of 29 MB of photos,
which is a genuine speed win — but GitHub silently re-validates its certificate
every few months, and the proxy can make that renewal fail. If the site is fine
on DNS-only, leaving it there is the lower-maintenance choice.

---

## Verifying

```bash
# Points at GitHub?
nslookup www.dcpnewyork.com

# 200, and served by GitHub?
curl -sI https://www.dcpnewyork.com | findstr /i "HTTP server location"

# Apex redirects to www?
curl -sI https://dcpnewyork.com | findstr /i "HTTP location"
```

Expect `server: GitHub.com` (DNS-only) or `server: cloudflare` (proxied), and
the apex returning a `301` to `https://www.dcpnewyork.com/`.

## Updating the site

```bash
# after editing photos in assets/img/ or the templates in tools/build.sh
bash tools/build.sh          # regenerates the three gallery pages
git add -A
git commit -m "Update gallery"
git push
```

Pages redeploys on push, typically live in under a minute.

`tools/build.sh` owns the header, footer and carousel markup for `index.html`,
`events/index.html` and `newyork/index.html` — edit the script, not those three
files, or your next build overwrites them. `contact/index.html` is hand-written
and is not touched by the build.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Infinite redirect / `ERR_TOO_MANY_REDIRECTS` | SSL mode is Flexible. Set it to Full. |
| Enforce HTTPS greyed out | Proxy is on. Set records to DNS only and wait. |
| 404 at the custom domain | `CNAME` file missing or wrong, or DNS not propagated. |
| Site loads unstyled | Pages source set to a branch/folder without `assets/`. |
| Certificate warning | Cert not issued yet, or domain mismatch (`www` vs apex). |
