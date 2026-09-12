# DCP New York

## Pages

| URL         | File                 | Nav label          |
| ----------- | -------------------- | ------------------ |
| `/`         | `index.html`         | Portraits          |
| `/events/`  | `events/index.html`  | Event              |
| `/contact/` | `contact/index.html` | Contact            |


Links are written relative, so the site works both when served from a web root
and when opened straight off disk.

## Layout

```
assets/
  css/style.css      design tokens, type scale, all components
  js/site.js         carousel, mobile overlay menu, contact form
  fonts/             Quincy CF (self-hosted, 14 faces)
  img/
    logo.png
    portraits/       24 photos — home page
    events/          30 photos — /events/
    about/me.jpg     contact page portrait
```

Gallery images are numbered (`01-`, `02-`, …) to preserve the original slide
order. To reorder or add a photo, drop it in the folder with the right number
prefix — nothing else references them by name.

## Design tokens

Pulled from the original theme, defined at the top of `style.css`:

- Headings `#434343`, body `#797979`, details `#D9D9D9`, background `#FFFFFF`
- Buttons `#434343`, hover `#393939`
- Serif: **Quincy CF** (self-hosted) · Sans: **Work Sans** (Google Fonts)
- Max page width `1280px`

The carousel keeps the original's fixed-height filmstrip behaviour: `230px` on
mobile, `470px` on tablet, `36.6vw` on desktop, capped at `615px` above 1680px.

## Contact form

The form has **no backend**. By default it opens the visitor's mail client,
addressed to the `data-mailto` attribute on the `<form>` in
`contact/index.html` — currently the placeholder `hello@example.com`. Set your
real address there.

To use a form service instead, give the form an `action` and `method` and
remove `data-mailto`:

```html
<form class="contact-form js-contact-form" action="https://formspree.io/f/XXXX" method="post">
```

## Running locally

Any static server works:

```bash
npx http-server -p 8080
# or
python -m http.server 8080
```

## Deploying

Upload the whole folder as-is. It is pure static files — no build step. Works on
Netlify, Cloudflare Pages, GitHub Pages, S3, or any shared host.
