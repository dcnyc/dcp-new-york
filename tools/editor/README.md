# Local visual editor

Edit the site in a browser — drag photos to reorder, drop new ones in, rewrite
text in place — then **Publish** to push it live.

```bash
node tools/editor/server.js
```

Then open <http://127.0.0.1:8787>.

## Why it can never leak onto the live site

The editor is injected into the HTML **as it is served**, not written into the
files. The `.html` files on disk contain no editor markup at all, so there is
nothing to accidentally deploy. `tools/` is also absent from the `PUBLISH`
allowlist in `.github/workflows/pages.yml`, so the editor's own files are never
uploaded either.

## The panel

A sidebar sits to the left of the site, which renders beside it as a preview.

**Pages** lists every page in two groups:

- **Site menu** — pages linked from the site's navigation.
- **Not in menu** — everything else, each tagged:
  - **Unlinked** — live on the web, just not in the menu (New York).
  - **Draft** — not deployed at all, because its folder is missing from the
    `PUBLISH` allowlist (Headshots). Publishing will not expose it.

Click a page to open its panel: the gallery block with a preview, a thumbnail
strip, **Manage photos**, and the options for that block type.

## What you can do

| Action | How |
| --- | --- |
| Reorder photos | **Manage photos**, then drag. Saved as you drop. |
| Add photos | Drop JPEGs on the dashed zone under the gallery, or click to browse. |
| Remove a photo | Hover it, click the **×**. A copy is kept in `.originals/removed/`. |
| Rewrite text | Click any heading or paragraph and type. `Enter` saves, `Esc` cancels. |
| Grid columns | Headshots panel → 2 / 3 / 4. Phones always show two. |
| Slider controls | Carousel panels → toggles the arrows under the strip. |
| Publish | Bottom of the panel. Runs git add / commit / push. |

Dropped photos are downscaled by `tools/resize-images.ps1` — the same 1600px
cap used everywhere else on the site.

## How edits reach the files

Reordering renames the files so the numeric prefix matches the new order, then
regenerates the markup: `tools/build.sh` for the three carousel galleries, and
an in-place rewrite of the `headshot-grid` section for Headshots. **Filenames
stay the single source of truth for gallery order.**

Block options are stored in `site.config.json` at the repo root, which
`tools/build.sh` reads at build time. That is why a setting survives a rebuild
instead of being overwritten by it. The file is not in the deploy allowlist, so
it stays local.

Text edits are written back by byte range. The server records where each
editable block sits when it serves the page and checks the file has not changed
before writing, so a stale tab cannot overwrite newer work — you are told to
reload instead.

## Things to know

- **Publish stages everything** (`git add -A`), not only what you changed in the
  browser. Check the change count at the bottom of the panel first.
- **Headshot photos are gitignored** until that page launches. Remove the rule
  at the bottom of `.gitignore` when you are ready for them to go live.
- The server binds to `127.0.0.1` only; nothing is exposed to your network.
- If the port is busy, an old copy is probably still running. Find it with
  `netstat -ano | grep 8787` and stop that PID.
- Stop it with `Ctrl+C`.
