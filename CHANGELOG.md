# Changelog

## 0.3.0

- The `/model` slash-command popup gets the same provider accordion as the
  composer model menu (rows there are `div[role="option"]`, not
  `button[role="menuitemradio"]`).
- The popup is laid out as a grid so the expand/collapse-all and sort buttons sit
  at the right end of its search row; the list scrolls inside the card instead of
  growing past the card's height cap.
- Favorites work in both surfaces; the key falls back to `provider/label` when a
  row carries no `data-provider-id`/`data-model-id`.
- Search detection accepts a plain `input` as well as `[role="searchbox"]`.
- Packaging: README, install.sh, npm tarball, `npm run check`.

## 0.2.0

- Multi-open (Ctrl/Cmd + click), expand/collapse-all toolbar, remembered
  all-collapsed state, stable menu height.
- Favorites pinned at the top (Shift+click or right-click a row).
- Provider sorting (default / name / model count).
- The current model is shown on its provider label.
- Row fade-in animation, keyboard navigation, zh/en strings, DOM-change
  diagnostics through `window.__dshModelAccordion`.

## 0.1.0

- First version: one clickable label per provider in the composer model menu,
  one provider open at a time, remembered across reloads.
