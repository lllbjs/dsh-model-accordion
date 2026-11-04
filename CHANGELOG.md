# Changelog

## 0.6.0

- **One-click model refresh.** A third toolbar button (`↻`) re-pulls the model
  lists of every installed connector plugin in parallel and forces the composer's
  model catalog to re-read, so a connector that just discovered new models shows
  them without reopening the app.
  - Built-in targets: WorkBuddy (`cn`, `global`), Trae (`cn`, `ai`) and
    `@dmh2002/dsh-connect-qoder`. Each is a same-origin `POST` to its
    `/plugins/<id>/models/refresh` route. A connector that is not installed
    answers `404`/`405` and is reported as *skipped*, not as a failure.
  - After the fan-out the button calls `ctx.get("modelDirectories").catalog.refresh()`
    — the browser-side path that invalidates the cached catalog (plainly closing
    and reopening the menu does **not** re-fetch, because `load()` short-circuits
    while `status === "ready"`). The service name is internal, so every access is
    guarded and a host upgrade that removes it degrades to a no-op.
  - Feedback is shared across toolbar redraws: a spinner while busy, `✓`/`!`
    afterwards, and a tooltip like `4/4 · 95 models · catalog`. State resets
    after 3.5 s.
  - Two `CustomEvent`s on `document` let other plugins react:
    `dsh-model-accordion:refresh-start` (detail: `{ targets }`) and
    `dsh-model-accordion:refresh-done` (detail: the summary).
  - Any connector can add its own target without importing this bundle: dispatch
    `dsh-model-accordion:refresh-register` with the target in `detail`, or call
    `window.__dshModelAccordion.registerRefreshTarget(target)`. A target may be a
    URL string, a `{ path, regions?, method?, headers?, label?, regionParam? }`
    object, or an async function; registration returns a disposer.
  - **Honest limitation:** a connector's `/models/refresh` route only *returns*
    the live roster into its settings draft; it does not write `lastCatalog` or
    emit `llm/adapters-updated`. Trae's route additionally updates its runtime
    `latestDiscovery` pool, so its new models appear immediately. WorkBuddy's
    host-side catalog only changes after that connector commits a settings save —
    a browser plugin cannot force that republish. The button does the
    browser-reachable maximum: warm every connector's upstream data and force the
    composer to re-read its catalog.

## 0.5.2

- A favorite now points at the exact model the star was clicked on, even when a
  provider ships two models under one visible name. WorkBuddy Global lists both
  `deepseek-v4.1-flash-sg` (×0.11) and the free `deepseek-v4.1-flash` (×0.00) as
  `Deepseek-V4.1-Flash`, so a name-only key merged them and the pinned favorite
  could select the paid twin of the free model.
  - `toggleFavorite()` records the starred row's `data-model-id` in
    `dsh-model-accordion:favorite-ids`; the key itself stays name-based and
    free of the volatile rate chip.
  - `rowByKey()` prefers the row carrying that id, falls back to the row the
    session already uses, and returns nothing when the name is genuinely
    ambiguous — never an arbitrary twin.
  - The star reflects the id too, so only the model that was starred shows as
    favorited.
  - Clicking the empty star of the other twin re-points the favorite instead of
    removing it.
- The `/model` popup does not tag its rows with ids, so there the id hint is
  simply absent and the key still matches by name as before.

## 0.5.1

- A favorite no longer disappears from the menu when its connector's rate chip
  changes. Connector plugins (WorkBuddy, Trae, Qoder) render the model label as
  `<name><rate chip>`, and re-render that chip whenever a promotion starts or
  ends or the usage snapshot refreshes — so the same row's text is
  `DeepSeek-V4.1-Flash` at one moment and `DeepSeek-V4.1-Flash · x0.00` at the
  next. The chip was part of the favorite key, so the stored key stopped
  matching the live row and the favorite vanished until an account switch forced
  a full catalog refetch that reproduced the original text.
  - `keyOf()` now reads the FIRST non-decoration span inside the model-label
    slot (the name) instead of the deepest one (which could be the rate chip or
    the `新` mark), and strips a trailing ` · x<number>` as a second line of
    defence.
  - Stored favorites and remembered keys are normalised on read, so keys saved
    by 0.5.0 and earlier (`… · x0.00`) are migrated once instead of being
    silently unmatched.
- The first-level pane is now filtered by a NEGATIVE cache,
  `dsh-model-accordion:missing-models`: only a favorite that a complete,
  unfiltered render proved gone is held back. The previous positive cache
  (`known-models`) drew the pane from the keys that happened to resolve in one
  pass, so any pass that saw a partial catalog — a provider still loading, a
  search filter, a collapsed section — could drop a live favorite from the pane
  until something rewrote the cache again.

## 0.5.0

- Favorites are mirrored into the composer menu's first-level pane: the short
  pane that opens with `模型` / `推理等级` now lists every favorited model above
  those two cells, so a favorite is one click away instead of two. The injected
  cells are ordinary `button[role="menuitem"]` nodes, so `↑`/`↓`/`Enter` work on
  them; they copy the built-in cell's classes at runtime, so a shell rebuild that
  changes the hashed class names does not break their layout.
- Clicking a mirrored favorite drills into the provider list and selects the live
  row, i.e. it takes the same path as a manual two-step selection.
- `dsh-model-accordion:known-models` remembers which favorite keys resolved to a
  real model the last time a provider list was rendered, so the pane never offers
  a favorite whose provider is currently unavailable. A favorite that fails to
  appear is kept rather than deleted — a slow provider may still be loading.
- The injected cells are removed as soon as the pane switches to the provider
  list, so the accordion never sees phantom rows.

## 0.4.1

- Favorite keys are now built from the visible provider label and model name in
  both surfaces. Only the composer menu tags rows with
  `data-provider-id`/`data-model-id`, so the previous key made the same model
  look favorited in one surface and unfavorited in the `/model` popup.
- Favorites saved by 0.4.0 with the old id-based keys are migrated on first
  decoration, so nothing has to be starred again.

## 0.4.0

- Every model row now carries a small star button on its right edge. Clicking it
  toggles the favorite without selecting the model, so you can bookmark several
  models in one visit to the menu.
- The star is right-aligned in both surfaces, including the wide `/model` popup
  rows, where it sits in the same column on every row.
- Stars are re-synced from the favorite store on every decoration pass, so the
  pinned "收藏" section and the provider rows always agree.

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
