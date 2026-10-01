# Local visual editor

Edit the site in a browser — drag photos to reorder, drop new ones in, rewrite
text in place — then hit **Publish** to push it live.

```bash
node tools/editor/server.js
```

Then open <http://127.0.0.1:8787>.

## Why it can never leak onto the live site

The editor is injected into the HTML **as it is served**, not written into the
files. The `.html` files on disk contain no editor markup at all, so there is
nothing to accidentally deploy. On top of that, `tools/` is absent from the
`PUBLISH` allowlist in `.github/workflows/pages.yml`, so the editor's own files
are never uploaded either.

## What you can do

| Action | How |
| --- | --- |
| Reorder photos | **Edit page**, then drag a photo to a new position. Saved as you drop. |
| Add photos | Drop JPEGs on the dashed zone under a gallery, or click it to browse. |
| Remove a photo | Hover a photo, click the **×**. A copy is kept in `.originals/removed/`. |
| Rewrite text | Click any heading or paragraph and type. `Enter` saves, `Esc` cancels. |
| Publish | **Publish…**, write a message, confirm. Runs git add / commit / push. |

Dropped photos are downscaled automatically by `tools/resize-images.ps1` — the
same 1600px cap used everywhere else on the site.

## How edits reach the files

Reordering renames the files so the numeric prefix matches the new order, then
regenerates the markup: `tools/build.sh` for the three carousel galleries, and
an in-place rewrite of the `headshot-grid` section for the Headshots page. The
filenames remain the single source of truth for gallery order.

Text edits are written back by byte range. The server records where each
editable block sits when it serves the page and verifies the file has not
changed before writing, so a stale tab cannot overwrite newer work — you will
be told to reload instead.

## Things to know

- **Publish stages everything** (`git add -A`), not only what you changed in the
  browser. Check the change count in the toolbar before publishing.
- **Headshot photos are gitignored** until that page launches. Remove the rule
  at the bottom of `.gitignore` when you are ready for them to go live.
- The server binds to `127.0.0.1` only; nothing is exposed to your network.
- Stop it with `Ctrl+C`.
