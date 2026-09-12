#!/usr/bin/env bash
# Generates the DCP New York gallery pages from the downloaded image folders.
set -euo pipefail

# NOTE: asset URLs carry a ?v=N cache-buster. GitHub Pages serves CSS/JS with
# max-age=600, so without it a style change can take ten minutes to appear.
# When you edit assets/css/style.css or assets/js/site.js, bump the number here
# AND in contact/index.html and client/index.html, then rebuild.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ---- header -------------------------------------------------------------
# $1 = prefix to site root ("" or "../"), $2 = active page key
emit_header() {
  local P="$1" ACTIVE="$2" H="${1:-./}"
  local a_home="" a_events="" a_ny="" a_contact="" a_client=""
  case "$ACTIVE" in
    home) a_home=" is-active";;
    events) a_events=" is-active";;
    newyork) a_ny=" is-active";;
    contact) a_contact=" is-active";;
    client) a_client=" is-active";;
  esac
  cat <<HDR
  <header class="site-header">
    <nav class="header-nav" aria-label="Main">
      <div class="nav-side nav-side--left">
        <button class="nav-toggle js-nav-toggle" type="button" aria-label="Open menu">
          <span></span><span></span><span></span>
        </button>
        <a class="nav-link${a_home}" href="${H}">Portraits</a>
        <a class="nav-link${a_events}" href="${P}events/">Event</a>
      </div>

      <a class="header-logo" href="${H}">
        <img src="${P}assets/img/logo.png" alt="DCP New York" width="250" height="110">
      </a>

      <div class="nav-side nav-side--right">
        <a class="nav-link${a_client}" href="${P}client/">Client</a>
        <a class="nav-link${a_contact}" href="${P}contact/">Contact</a>
      </div>
    </nav>
  </header>

  <div class="overlay-menu js-overlay-menu">
    <button class="overlay-close js-overlay-close" type="button" aria-label="Close menu"></button>
    <a class="${a_home:+is-active}" href="${H}">Portraits</a>
    <a class="${a_events:+is-active}" href="${P}events/">Event</a>
    <a class="${a_client:+is-active}" href="${P}client/">Client</a>
    <a class="${a_contact:+is-active}" href="${P}contact/">Contact</a>
  </div>
HDR
}

# ---- footer -------------------------------------------------------------
emit_footer() {
  local P="$1" ACTIVE="$2" H="${1:-./}"
  local a_home="" a_events="" a_ny="" a_contact="" a_client=""
  case "$ACTIVE" in
    home) a_home=" is-active";;
    events) a_events=" is-active";;
    newyork) a_ny=" is-active";;
    contact) a_contact=" is-active";;
    client) a_client=" is-active";;
  esac
  cat <<FTR
  <footer class="site-footer">
    <div class="footer__inner">
      <nav class="footer__menu" aria-label="Footer">
        <a class="${a_home:+is-active}" href="${H}">Portraits</a>
        <a class="${a_events:+is-active}" href="${P}events/">Event</a>
        <a class="${a_client:+is-active}" href="${P}client/">Client</a>
    <a class="${a_contact:+is-active}" href="${P}contact/">Contact</a>
      </nav>

      <div class="footer__last">
        <div class="footer__copyright">
          <p class="paragraph-3">&copy; 2026 Dennis Christians Photography</p>
        </div>

        <div class="footer__socials">
          <a href="https://www.instagram.com/dcpnewyork" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
            <svg viewBox="0 0 448 512" aria-hidden="true"><path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"/></svg>
          </a>
        </div>

        <a class="go-to-top js-to-top" href="#" aria-label="Back to top">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        </a>
      </div>

      <p class="footer__areas">
        Headshot, portrait, corporate and event photography in Wyckoff, Ridgewood,
        Glen Rock, Paramus, Franklin Lakes, Fair Lawn and across Bergen County,
        New Jersey and throughout New York City.
      </p>
    </div>
  </footer>
FTR
}

# ---- carousel -----------------------------------------------------------
# $1 = prefix, $2 = image dir name
emit_carousel() {
  local P="$1" DIR="$2"
  cat <<'CAR_OPEN'

    <section class="photo-slider">
      <div class="carousel js-carousel">
        <div class="carousel__track">
CAR_OPEN

  for f in assets/img/"$DIR"/*.jpg; do
    local base dim w h alt
    base=$(basename "$f")
    dim=$(file "$f" | grep -oE '[0-9]+x[0-9]+, components' | grep -oE '^[0-9]+x[0-9]+')
    w=${dim%x*}; h=${dim#*x}
    # human-readable alt from the file name
    alt=$(echo "$base" | sed -E 's/^[0-9]+-//; s/\.jpg$//; s/[-_]+/ /g')
    printf '          <div class="carousel__slide"><img src="%sassets/img/%s/%s" alt="%s" width="%s" height="%s" loading="lazy" draggable="false"></div>\n' \
      "$P" "$DIR" "$base" "$alt" "$w" "$h"
  done

  cat <<'CAR_CLOSE'
        </div>

        <button class="carousel__zone carousel__zone--prev js-prev" type="button" aria-label="Previous photo"></button>
        <button class="carousel__zone carousel__zone--next js-next" type="button" aria-label="Next photo"></button>

        <div class="carousel__nav">
          <button class="js-prev" type="button" aria-label="Previous photo">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button class="js-next" type="button" aria-label="Next photo">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
    </section>
CAR_CLOSE
}

# ---- page shell ---------------------------------------------------------
# $1 out, $2 prefix, $3 active, $4 <title>, $5 description, $6 og image path
# ---- structured data ----------------------------------------------------
# Machine-readable business + service-area data for search engines. The full
# town list lives here rather than being stuffed into visible copy, which is
# what Google actually wants and what keyword-stuffed page text gets penalised
# for.
emit_jsonld() {
  cat <<'JSONLD'
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "name": "DCP New York - Dennis Christians Photography",
    "url": "https://www.dcpnewyork.com/",
    "image": "https://www.dcpnewyork.com/assets/img/about/dennis-2.jpg",
    "description": "Headshot, portrait, corporate and event photographer serving Bergen County and northern New Jersey, and New York City.",
    "priceRange": "$$",
    "sameAs": ["https://www.instagram.com/dcpnewyork"],
    "knowsAbout": [
      "Headshot photography",
      "Professional headshots",
      "Corporate headshots",
      "Actor headshots",
      "LinkedIn headshots",
      "Portrait photography",
      "Environmental portraits",
      "Musician portraits",
      "Lifestyle photography",
      "Personal branding photography",
      "Corporate event photography",
      "Event photography"
    ],
    "areaServed": [
      { "@type": "AdministrativeArea", "name": "Bergen County, New Jersey" },
      { "@type": "City", "name": "Wyckoff, New Jersey" },
      { "@type": "City", "name": "Ridgewood, New Jersey" },
      { "@type": "City", "name": "Glen Rock, New Jersey" },
      { "@type": "City", "name": "Paramus, New Jersey" },
      { "@type": "City", "name": "Franklin Lakes, New Jersey" },
      { "@type": "City", "name": "Fair Lawn, New Jersey" },
      { "@type": "City", "name": "Ramsey, New Jersey" },
      { "@type": "City", "name": "Mahwah, New Jersey" },
      { "@type": "City", "name": "Allendale, New Jersey" },
      { "@type": "City", "name": "Midland Park, New Jersey" },
      { "@type": "City", "name": "Ho-Ho-Kus, New Jersey" },
      { "@type": "City", "name": "Waldwick, New Jersey" },
      { "@type": "City", "name": "Oakland, New Jersey" },
      { "@type": "City", "name": "Saddle River, New Jersey" },
      { "@type": "City", "name": "Hawthorne, New Jersey" },
      { "@type": "City", "name": "Montclair, New Jersey" },
      { "@type": "City", "name": "Hoboken, New Jersey" },
      { "@type": "City", "name": "Jersey City, New Jersey" },
      { "@type": "City", "name": "New York, New York" }
    ]
  }
  </script>
JSONLD
}

emit_head() {
  local P="$2" TITLE="$4" DESC="$5" OG="$6" CANON="${8:-}"
  cat <<HEAD
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <title>${TITLE}</title>
  <meta name="description" content="${DESC}">
  <link rel="canonical" href="https://www.dcpnewyork.com/${CANON}">

  <meta property="og:site_name" content="DCP New York">
  <meta property="og:title" content="${TITLE}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://www.dcpnewyork.com/${CANON}">
  <meta property="og:description" content="${DESC}">
  <meta property="og:image" content="https://www.dcpnewyork.com/${OG}">
  <meta name="twitter:card" content="summary_large_image">

$(emit_jsonld)

  <link rel="icon" href="${P}assets/img/logo.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Work+Sans:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${P}assets/css/style.css?v=8">
</head>
<body>
HEAD
}

emit_tail() {
  local P="$1"
  cat <<TAIL
  <script src="${P}assets/js/site.js?v=8"></script>
</body>
</html>
TAIL
}

# =========================================================================
# Build the three gallery pages
# =========================================================================
build_gallery() {
  local OUT="$1" P="$2" KEY="$3" TITLE="$4" DESC="$5" DIR="$6" OG="$7" CANON="${8:-}"
  mkdir -p "$(dirname "$OUT")"
  {
    emit_head "$OUT" "$P" "$KEY" "$TITLE" "$DESC" "$OG" "" "$CANON"
    emit_header "$P" "$KEY"
    echo '  <main role="main">'
    emit_carousel "$P" "$DIR"
    echo '  </main>'
    emit_footer "$P" "$KEY"
    emit_tail "$P"
  } > "$OUT"
  echo "built $OUT"
}

# Titles are kept under ~60 characters so Google does not truncate them, and
# lead with what people actually search for rather than the brand name.
build_gallery "index.html" "" "home" \
  "Headshot &amp; Portrait Photographer | Bergen County NJ &amp; NYC" \
  "Headshot and portrait photographer serving Wyckoff, Ridgewood, Glen Rock, Paramus and Bergen County, NJ, and New York City. Natural expression, clean composition." \
  "portraits" "assets/img/portraits/01-AJ-Stillabower-Composer-1.jpg" ""

build_gallery "newyork/index.html" "../" "newyork" \
  "New York Portrait Photography | DCP New York" \
  "Portrait and lifestyle photography on location in New York City, by a headshot and portrait photographer based in northern New Jersey." \
  "newyork" "assets/img/newyork/01-dcpnyc-001.jpg" "newyork/"

build_gallery "events/index.html" "../" "events" \
  "Event Photographer | Northern NJ &amp; New York City" \
  "Corporate and private event photography across Bergen County, northern New Jersey and New York City. Unobtrusive coverage, natural candid moments." \
  "events" "assets/img/events/01-IMG_1590.jpg" "events/"
