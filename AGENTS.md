# Repository Agent Instructions

## Project Mode

- Mode: `project`
- Primary task types: `feature`, `bug`, `ux-review`, `accessibility-review`, `documentation`.
- This repository is a Jekyll/GitHub Pages personal blog. Prefer small, reversible changes that preserve static-site compatibility.

## Product Direction

- Visual theme: Cognitive Atlas / Research Garden.
- Palette: ink black, warm paper, teal, violet accent.
- Avoid returning to the older pixel-game look unless the user explicitly asks for it.
- The site should feel like a personal research map for physics, mathematics, cognitive science, data engineering, and web notes.

## UX And Accessibility Rules

- Prioritize long-form readability, predictable navigation, and keyboard access over decorative novelty.
- Apply recognition over recall: show current location, visible categories, clear labels, and explicit states.
- Keep Hick's law in mind: group choices by domain instead of presenting long undifferentiated lists.
- Keep Miller's law in mind: chunk navigation, metadata, and tool controls into small scan-friendly groups.
- Keep Jakob's law in mind: links, search, tabs, pagination, and forms should behave like common web patterns.
- Keep Fitts's law in mind: primary actions, tabs, calculator buttons, and close/clear controls need comfortable target sizes.
- Keep Doherty's threshold in mind: show immediate visual feedback for search, filters, tabs, and calculator actions.
- Use visible focus styles for all interactive controls.
- Do not rely on color alone for meaning. Pair color with text, shape, icon, border, or state copy.
- Maintain sufficient contrast against warm paper backgrounds.
- Avoid hidden or surprising modes. If a component changes mode, update `aria-selected`, `aria-expanded`, `hidden`, and visible state together.

## Engineering Rules

- Use the existing Jekyll/Liquid structure unless a change clearly reduces complexity.
- Prefer adding narrowly scoped CSS override layers over large rewrites of generated or legacy CSS.
- Keep page-specific JavaScript in `assets/js/` and load it through `page.scripts`.
- Keep console noise out of production scripts unless it is error reporting.
- For blog posts, keep image paths valid. Remove unused or broken media references instead of leaving dead assets.
- After changes, run at least:
  - `node --check` for changed JavaScript files
  - `git status --short`
  - Jekyll build if local gems are available

## Current Known Constraints

- `bundle exec jekyll build` may fail on a fresh checkout until `bundle install` has been run.
- `Gemfile.lock` is ignored in this repository, so local dependency resolution may vary.
