---
version: alpha
name: Allen's Blog
description: "A quiet knowledge lab for math philosophy, science history, accessibility notes, and practical calculators."
colors:
  ink: "#1F3430"
  inkSoft: "#4F6762"
  muted: "#5D6F6B"
  paper: "#F5FFFB"
  paperDeep: "#EAF8F2"
  surface: "#FFFFFF"
  surfaceWarm: "#FFFEF8"
  sidebar: "#EFFBF6"
  mint: "#1F746A"
  mintHover: "#155F57"
  mintSoft: "#DDF8EF"
  violet: "#5F57B8"
  violetSoft: "#F2EFFF"
  amber: "#C28F3B"
  border: "#C8E4DC"
  focus: "#1F746A"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 46px
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: 0
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.22
    letterSpacing: 0
  heading:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 25px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  label:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace"
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0
rounded:
  sm: 6px
  md: 8px
  control: 12px
  card: 16px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  xxl: 64px
layout:
  contentMax: 920px
  articleMax: 760px
  sidebarWidth: 304px
  touchTarget: 44px
elevation:
  flat: "none"
  raised: "0 14px 34px rgba(31, 52, 48, 0.08)"
  tight: "0 8px 18px rgba(31, 52, 48, 0.06)"
components:
  page:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  panel:
    backgroundColor: "{colors.surfaceWarm}"
    textColor: "{colors.ink}"
    borderColor: "{colors.border}"
    rounded: "{rounded.md}"
    shadow: "{elevation.tight}"
  home-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.border}"
    rounded: "{rounded.card}"
    shadow: "{elevation.tight}"
  search-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.border}"
    rounded: "{rounded.control}"
    height: 48px
  button-primary:
    backgroundColor: "{colors.mint}"
    textColor: "#FFFFFF"
    borderColor: "{colors.mint}"
    rounded: "{rounded.md}"
    height: "{layout.touchTarget}"
  chip:
    backgroundColor: "{colors.mintSoft}"
    textColor: "{colors.ink}"
    borderColor: "{colors.border}"
    rounded: "{rounded.pill}"
---

## Brand & Style

Allen's Blog should feel like a calm research desk rather than a retro terminal. Keep the current mint palette unchanged. Use clear information hierarchy, compact scan-friendly summaries, and familiar search and list patterns inspired by modern finance apps, while retaining the blog's research identity. The site should support long reading and practical tool use without feeling like a marketing page.

## Colors

These tokens match `assets/css/theme-atlas.css`; treat them as the current source of truth. Use `paper` for the page background, `surface` for search and prominent home cards, and `surfaceWarm` for reading panels. `mint` is the primary action and link color; `mintHover` is the hover color. Keep violet and amber limited to existing content accents. Do not shift hues during layout work unless the user asks.

Readable pairs used by the homepage were measured: `ink` on `paper` 12.93:1, `inkSoft` on `paper` 5.97:1, `muted` on `paper` 5.21:1, white on `mint` 5.58:1, and `mint` on `mintSoft` 4.98:1. These pairs meet WCAG AA for normal text. Recheck any new foreground/background pair before using it for readable text. Never place body text on decorative gradients or low-contrast pastel backgrounds.

## Typography

Use the system sans stack for headings, body text, forms, navigation, and tools. Use the mono stack selectively for compact metadata and formula-like content. Keep letter spacing at `0` except for the subtle home-title adjustment already implemented. Bounded `clamp()` is allowed for true page heroes. Preserve the article body's longer line height for sustained reading.

## Layout & Spacing

Desktop uses a fixed right sidebar and a centered content reading column. Article text should stay near `760px`; directories, dashboards, and tools can expand toward `920px`. Mobile uses the sidebar as a modal drawer so the first viewport starts with content, not navigation. On the homepage, put search and the newest real article before topic exploration; keep quick links and content metrics compact and readable at 320–390px. Every primary tap target is at least `44px`.

## Elevation

Use soft shadows only to separate actionable panels or repeated cards from the paper background. Avoid heavy hard pixel shadows except where an existing calculator control needs a clear pressed affordance.

## Shapes

Use `8px` radius for legacy panels and general buttons, `12px` for prominent search controls, and up to `16px` for the homepage's primary cards. Pills are only for metadata chips and compact tags. Do not nest cards inside decorative cards.

## Components

Navigation links should look like quiet controls: visible boundaries, clear hover state, and a stronger selected state. Keep the posts page search, category, and sort controls together above the result list, including on mobile; do not hide the main search behind the navigation drawer. Search results should appear as readable stacked items with enough spacing to scan titles, categories, and excerpts. Homepage recent articles should use compact separated rows rather than a grid of heavy cards. Calculator controls should use stable grid dimensions so labels do not resize or shift the layout.

Post pages should prioritize reading: a short description below the title, topic and date metadata, “이 글에서 얻는 것”, body, series navigation, references, and comments. Keep the generated table of contents in a native disclosure so it stays available without dominating the reading column. Mark the current entry in a series list and make next-article navigation the clearest action after the body. Escape metadata text rendered into HTML. Tool pages should prioritize immediate use first, then formulas, examples, and FAQ. Keep tool mode labels short and Korean-first, show the selected tab with a clear border and state semantics, and place explanatory guide links after the working calculator. Present results and errors as distinct, readable states, and keep live status regions in the accessibility tree before their first result. About pages should use concise Korean copy and flat link rows. The 404 page should offer a labeled GET search to `/posts/` plus direct links to all posts and home, without duplicating the shared search input ID.

Achievement pages should scan like a compact activity ledger: date and localized category first, followed by title and summary. Use quiet separators between records, then show supporting highlights and topic tags without a nested card treatment.

The series index should place the two guided hubs before the full ordered catalog. Show each hub's post count and short purpose, then group all series with numbered, description-first post links; use flat row separators for the long catalog and stack featured hubs on mobile.

## Do's and Don'ts

Do keep the first viewport calm, readable, and useful.
Do use the existing deep mint for primary actions and keep the bright mint as decoration.
Do make hover/focus states visible without changing layout dimensions.
Do keep Korean and English labels paired only where it helps comprehension.
Do check mobile at 390px before shipping visual changes.

Don't bring back pixelated fonts, pixel rendering, purple hover flashes, or terminal-like contrast as the main theme.
Don't use decorative blobs, bokeh, oversized marketing cards, or nested cards.
Don't hide search results behind visibility/transform states without a matching active class.
Don't put long text into fixed-width buttons when it can wrap or become a label below an icon.
