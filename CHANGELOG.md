# Changelog

## 0.9.0

- **Account info, model lists and model testing in the unified hub.** The
  「模型连接器中心」 settings page now does what the four native connector
  settings pages did, in one place — no need to open the original plugins:
  - **Account info** (`/usage` full detail, no more `&detail=fast`) — current
    account name / id / domain / region / credential expiry, the full account
    list with per-account credits (from `/account-credits`), credit total /
    used / available, credit packages, check-in streak, and the OpenCode IP
    pool state / total / enabled flag.
  - **Model lists** — every model from `/usage` (`models`, or `pool.catalog`
    for Qoder, or `/ip-pool/models` for OpenCode) with context window, credit
    multiplier, reasoning / image / verified / new / off tags, enabled-state,
    a region selector, a search box and a refresh button that reuses the
    existing `POST /models/refresh` refresh skeleton.
  - **Account configuration** — Qoder PAT add/remove (`POST /accounts` with
    `?action=add|remove`), WorkBuddy account switching (`POST /__save` with
    `field:"accounts"`) plus OAuth login (`/oauth?action=start|poll`), Trae
    account refresh and a hint pointing at its native/transfer flow (Trae has
    no add-account route), OpenCode IP-pool probe (`/ip-pool/probe`).
  - **Test a model** — each model row has a 「测试」 button that makes one real
    upstream call: WorkBuddy `POST /probe {modelIds:[id]}`, Trae
    `POST /models/test {ids:[id]}`, Qoder `GET /probe?model=<id>`. Results
    (outcome / elapsed ms / message) render inline. Note: Trae's test costs
    real quota, so the UI shows a warning.
  - **Live refresh** — the open connector tab re-probes every 60s, skipping
    ticks while `document.hidden` (the daddy-suite polling pattern).
- All of the above is pure browser-side `fetch` against the four vendored
  hosts' existing same-origin routes: **no host code, `configForms`, or
  `dsh.client.inject` changes were needed**. The reference implementation in
  `daddy-suite` was used for the data-normalization / card / polling patterns
  only; its CDP / `window.ipc` / Electron-specific parts are not portable to a
  DSH web-client plugin and were deliberately not copied.
- Fixed the OpenCode bridge status shape: `value` is flat (`state`, `total`),
  not nested under `value.snapshot`; the pool count now shows.
- Added ~50 new `HUB_MESSAGES` keys (zh + en) and ~27 `[data-dsh-hub]` CSS
  rules (inputs, selects, form rows, key/value grids, model list, tags,
  inline notes) to `lib/client.js`.
- Version bumped to 0.9.0; `package.json` description updated; README.md /
  README.zh.md document the new capabilities.
- Host-provided packages are now declared as `peerDependencies` on the plugin
  itself (`@deepseek-ai/schemastery`, `@earendil-works/pi-ai`, `yaml`). DSH
  resolves peers of a linked plugin from its own installation scope, so the
  vendored OpenCode host (whose own `dependencies` are not installed next to
  it) loads from the DSH app tree instead of needing `install.sh`'s
  `node_modules` shim — which cannot point inside a macOS `app.asar` bundle.

## 0.8.0

- **Self-contained connectors (物理合并).** The four connector host adapters —
  WorkBuddy (5.17.0), Trae (4.6.12), Qoder (`@dmh2002/dsh-connect-qoder`
  1.16.4) and OpenCode (`@opencode2dsh/dsh-plugin` 0.3.14) — are now vendored
  inside this package (`vendored/<name>/`, full copies of the installed plugins).
  After stopping the four standalone bundles, `dsh-model-accordion` itself
  provides the models, login state, saved config and settings pages. **Uninstalling
  the original connector npm packages in the GUI no longer breaks anything.**
  - Architecture: the profile `cordis.patch.yml` gains four `- insert:` loader
    rows whose `name` is a `file:` URL pointing at each vendored
    `vendored/<name>/lib/index.js`. The four `entry.id`s stay unchanged
    (`dsh-connect-workbuddy`, `dsh-connect-trae`, `dsh-connect-qoder`,
    `opencode2dsh`) because they are the settings namespace, the
    `/plugins/<id>/...` route prefix and the key for saved config — so the
    hardcoded routes, client fetches, `REFRESH_TARGETS`, vault/auth filenames
    and version constants need **zero** string changes. The four host
    `lib/index.js` files stay separate module URLs (their top-level `Config`
    schemas and module-level `Map`/`let` singletons would otherwise collide).
  - Each vendored subpackage keeps its own `dsh.client` + `exports["./client"]`,
    and `nearestPackage` resolves each `file:` URL to that subpackage's
    `package.json` name — which equals its `lib/client.js`
    `window.__ModuleLoader__.load({id})` id. So the four native settings/login
    UIs keep working with no client concatenation and no slot-key rewrites. The
    two standalone bundles (`dsh-connect-workbuddy`, `@opencode2dsh/dsh-plugin`)
    are removed from `dsh.profile.bundles` so the client graph does not see the
    same package name from two sources; their `dependencies` stay so the GUI
    still lists them as uninstallable.
  - Saved config (accounts / regions / lastCatalog / enabledModelIds) keeps
    applying: the `name:` lines on the workbuddy/trae config-override rows and
    the trailing `disabled: true` rows are removed by `install.sh`, so those
    overrides land on the vendored entries by id.
  - Bare imports of the vendored hosts resolve from the workspace realpath via
    a small `node_modules/` shim that `install.sh` builds: schemastery 3.18.4 +
    cosmokit come from the copy vendored with workbuddy (opencode's `Config`
    needs `.volatile()`; the global tree only has 3.18.2 without it), and
    `dsh-llm`, `dsh-llm-pi-ai`, `dsh-atomic-write`, `dsh-home-paths`,
    `@earendil-works/pi-ai`, `undici`, `yaml` come from DSH's own
    `~/.dsh/profiles/node_modules` (global-backed, survives `pnpm remove`).
    Verified: DSH's `ResolutionRouter` routes these `file:` URLs to native ESM,
    so the shim is what resolves their bare imports.
  - `install.sh` rewritten to do all of the above, idempotently: link the
    package, build the shim, wire the four rows + the accordion row (only if
    absent), drop the two standalone bundles, back up both files, and clean up
    0.7.0 leftovers. A **full app quit/reopen is required** afterwards (the
    profile's `package.json`/linked roots change at startup — a GUI reload is
    not enough, `ResolutionRouter.replace` rejects live replacement).
  - Unified hub (0.7.0) copy updated to the self-contained wording; the
    "打开连接器设置" button now shows a clear message if its deep link target is
    gone (the `openNativeFail` string is no longer dead code).
  - `package.json` version 0.8.0, `files` now includes `vendored` and
    `README.zh.md`; `window.__dshModelAccordion.version` is `"0.8.0"`.

## 0.7.0

- **Unified connector settings hub (统一设置界面).** The plugin now registers a
  single settings card in the Plugins page ("内置插件配置") that puts all four
  connector plugins — WorkBuddy, Trae, Qoder (`@dmh2002/dsh-connect-qoder`) and
  OpenCode (`@opencode2dsh/dsh-plugin`) — behind one set of tabs.
  - The connectors stay installed **independently**: this does not merge their
    host adapters, login state, saved config or `cordis.patch.yml` rows. The hub
    is a central *control panel* that surfaces their status, model refresh and a
    deep link to each connector's own native settings page — it deliberately does
    not duplicate their account/credits/SDK settings forms.
  - Tabs: 总览 / WorkBuddy / Trae / Qoder / OpenCode / 手风琴选项. The overview
    probes every connector and shows a status grid; per-connector tabs add
    "重新探测", "刷新模型" and "打开原生设置" actions. The 手风琴选项 tab exposes the
    accordion's own sort / stable-height / favorites / auto-probe options plus a
    refresh-all button.
  - Status probes are read-only: `GET <prefix>/usage?region=<first>&detail=fast`
    for the three `/plugins/` connectors (loopback-guarded, 8 s timeout), and
    `POST /api/opencode2dsh/ip-pool/status` for OpenCode. A `400`/`404`/`405`
    or timeout shows "未知" instead of an error, so a missing connector never
    breaks the card.
  - `apply(ctx)` now mounts the card via `ctx.locale.register(...)` plus three
    `ctx.slots.inject(...)` registrations (`plugins.item`, `plugins.row.config`,
    `plugins.bundle.config`). Every step is `try`/`catch` guarded, so a host
    without those services simply keeps working as a plain accordion. The card
    is built with `React.createElement` (React is a platform seed), no JSX and no
    build step.
  - The `plugins.item` slot registration is what makes the card appear under
    "内置插件配置" — the plugin manager builds that list purely from slot
    entries, with no settings-namespace filter. The host half (`lib/index.js`)
    therefore stays a dependency-free no-op (no bare npm imports, no `Config`);
    the hub's own UI prefs live in `localStorage`. Keeping the host free of bare
    imports avoids ESM realpath resolution failures when the package is linked
    into a profile from outside its node_modules tree.
  - `dsh.client.inject` widened to the connector superset (locale, ui-settings,
    ui-slots, ui-settings-plugins, ui-plugin-manager).
  - **Fix:** the Qoder refresh target used the scoped package name
    (`/plugins/@dmh2002/dsh-connect-qoder/models/refresh`), which always 404'd.
    Qoder deliberately uses the unscoped row id `dsh-connect-qoder` and requires
    `?region=`, so the built-in target is now
    `/plugins/dsh-connect-qoder/models/refresh` with regions `cn`, `global`.
  - Diagnostics: `window.__dshModelAccordion.hub` exposes
    `{ connectors(), probe(conn), openNative(pkg), state() }`.

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
