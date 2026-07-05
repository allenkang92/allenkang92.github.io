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
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: 56px
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: 0
  title:
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.14
    letterSpacing: 0
  heading:
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: 25px
    fontWeight: 700
    lineHeight: 1.24
    letterSpacing: 0
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.78
    letterSpacing: 0
  label:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace"
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0
rounded:
  sm: 6px
  md: 8px
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
  raised: "0 14px 34px rgba(34, 57, 54, 0.09)"
  tight: "0 8px 18px rgba(34, 57, 54, 0.07)"
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

Allen's Blog should feel like a calm research desk rather than a retro terminal. The visual language is pastel mint paper, ink-like typography, warm white reading surfaces, and small violet accents for selected or focused states. The site should support long reading, fast scanning, and tool use without feeling like a marketing page.

## Colors

Use `paper` as the page background, `surfaceWarm` for article panels and repeated content blocks, and `surface` for form fields. `mint` is the primary action color and `mintHover` is the primary hover color. `violet` is a restricted accent for rare emphasis only; it must not be the default hover transition. Avoid a one-note mint-only interface by pairing mint with warm white, ink, and carefully limited accent color.

All readable text/background pairs must meet WCAG AA. Never place body text on decorative gradients or low-contrast pastel backgrounds.

## Typography

Use the serif stack only for page titles and major headings. Use the sans stack for body text, forms, navigation, and tools. Use the mono stack for metadata, labels, category chips, and formula-like content. Letter spacing stays `0`; do not scale type with viewport width except through bounded `clamp()` for true page heroes.

## Layout & Spacing

Desktop uses a fixed right sidebar and a centered content reading column. Article text should stay near `760px`; directories, dashboards, and tools can expand toward `920px`. Mobile uses the sidebar as a modal drawer so the first viewport starts with content, not navigation. Every tap target is at least `44px`.

## Elevation

Use soft shadows only to separate actionable panels or repeated cards from the paper background. Avoid heavy hard pixel shadows except where an existing calculator control needs a clear pressed affordance.

## Shapes

Cards, panels, buttons, inputs, and tool surfaces use `8px` radius or less. Pills are only for metadata chips and compact tags. Do not nest cards inside decorative cards.

## Components

Navigation links should look like quiet controls: visible boundaries, clear hover state, and a stronger selected state. Search results should appear as readable stacked items with enough spacing to scan titles, categories, and excerpts. Calculator controls should use stable grid dimensions so labels do not resize or shift the layout.

Post pages should prioritize reading: clear title, metadata, “이 글에서 얻는 것”, body, series navigation, references, and comments. Tool pages should prioritize immediate use first, then formulas, examples, and FAQ.

## Do's and Don'ts

Do keep the first viewport calm, readable, and useful.
Do use mint for primary actions and darker mint for hover states.
Do make hover/focus states visible without changing layout dimensions.
Do keep Korean and English labels paired only where it helps comprehension.
Do check mobile at 390px before shipping visual changes.

Don't bring back pixelated fonts, pixel rendering, purple hover flashes, or terminal-like contrast as the main theme.
Don't use decorative blobs, bokeh, oversized marketing cards, or nested cards.
Don't hide search results behind visibility/transform states without a matching active class.
Don't put long text into fixed-width buttons when it can wrap or become a label below an icon.
