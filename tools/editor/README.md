# Local visual editor

Edit the site in a browser — drag photos to reorder, drop new ones in, rewrite
text in place — then **Publish** to push it live.

```bash
node tools/editor/server.js
```

Then open <http://127.0.0.1:8787>.

It starts two servers:

| Port | What it serves |
| --- | --- |
| 8787 | The site with the editing panel |
| 8788 | **Preview** — the site exactly as it sits on disk |

Preview has its own port rather than a query flag, so clicking around inside
the preview tab keeps you in preview. The HTML there is served byte-for-byte
as it will deploy: no injected script, no rewritten links, no panel.

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
| Rewrite text | Pick a block from **Text blocks**, or click it on the page. `Enter` saves, `Esc` undoes, `Shift+Enter` makes a line break. |
| Format text | With a block selected: bold, italic, underline on the selected words; font, size and alignment for the whole block. |
| Grid columns | Headshots panel → 2 / 3 / 4. Phones always show two. |
| Slider controls | Carousel panels → toggles the arrows under the strip. |
| Reorder the menu | Drag a page in the **Site menu** group. Every page's header, overlay and footer menu updates. |
| Add a page | **+ Add page** at the top of the list. Starts empty, as a draft. |
| Preview | **Preview** in the footer opens the page on port 8788, with no editor chrome. |
| Publish | Bottom of the panel. Runs git add / commit / push. |

Every action that touches disk shows a labelled progress bar in the panel and a
sweep across the top of the page. Adding photos reports `Adding photo 3 of 12`,
then `Optimising`, then `Rebuilding`.

Dropped photos are downscaled by `tools/resize-images.ps1` — the same 1600px
cap used everywhere else on the site.

## How edits reach the files

Reordering renames the files so the numeric prefix matches the new order, then
regenerates the markup: `tools/build.sh` for the three carousel galleries, and
an in-place rewrite of the `headshot-grid` section for Headshots. **Filenames
stay the single source of truth for gallery order.**

Menu order lives in `site.config.json` under `nav`, and `tools/nav.js` renders
it. `tools/build.sh` calls that module for the generated pages and the editor
calls it for the hand-written ones, so there is one source of truth. A draft
page cannot be dragged into the menu: it is not deployed, so the link would
404 for every visitor.

Block options are stored in `site.config.json` at the repo root, which
`tools/build.sh` reads at build time. That is why a setting survives a rebuild
instead of being overwritten by it. The file is not in the deploy allowlist, so
it stays local.

Formatting is saved as an inline `style` attribute on the block, and bold or
italic as `<strong>`/`<em>` inside it. The server keeps a strict allowlist: only
`strong em b i u br` survive as tags, attributes are stripped from all of them,
and only a handful of CSS properties are accepted, so nothing can be smuggled
into a page through the text field.

Font and size offer fixed choices rather than free entry. Only two faces are
loaded by the site, and arbitrary sizes break the responsive type scale.

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
