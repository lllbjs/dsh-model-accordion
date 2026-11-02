# dsh-model-accordion

**English** · [简体中文](./README.zh.md)

> Collapse the DeepSeek Harness model list into **one clickable label per provider**.
> Click `Qoder` and only Qoder's models appear — every other provider folds away.

<p align="center">
  <img src="./docs/images/hero.png" alt="Qoder expanded, every other provider collapsed" width="520">
</p>

If you have a dozen providers and a few hundred models, the stock picker is one
endless scroll. This plugin turns each provider into a single row: you see the
provider names, the model count, and nothing else until you ask for it.

Works in **both** places the model list appears:

- the model menu next to the composer;
- the `/model` slash-command popup.

---

## What it looks like

| Every provider collapsed | One provider expanded | Search |
| --- | --- | --- |
| <img src="./docs/images/all-collapsed.png" alt="All providers collapsed" width="300"> | <img src="./docs/images/trae-expanded.png" alt="Trae expanded" width="300"> | <img src="./docs/images/search.png" alt="Searching for qwen" width="300"> |
| Nine providers in 8 rows. Click a row to open it. | `Trae` open with 33 models; the rest stay folded. | Typing `qwen` expands every match automatically. |

<p align="center">
  <img src="./docs/images/favorites.png" alt="Favorites pinned at the top" width="420">
</p>

Favorites are pinned above the providers, so the two or three models you actually
use are always one click away.

<p align="center">
  <img src="./docs/images/stars.png" alt="Star button on every model row" width="380">
</p>

Every row carries a star on its right edge: click it to bookmark the model without
selecting it, so you can pick out several models in a single visit to the menu. The
same star appears in the `/model` popup, where the rows are wider:

<p align="center">
  <img src="./docs/images/stars-popup.png" alt="Star buttons in the /model popup" width="620">
</p>

---

## Features

| Feature | How |
| --- | --- |
| **Accordion** | Click a provider label: it opens and every other provider closes. |
| **Collapse everything** | Click the open provider again, or the toolbar button. |
| **Multi-open** | `Ctrl`/`Cmd` + click a label to toggle it without closing the others. |
| **Expand / collapse all** | Toolbar button at the right end of the search row. |
| **Remembered state** | Open providers survive closing the menu and reloading the page. |
| **Star button** | Every row has a star on its right edge; click it to favorite the model without selecting it. |
| **Favorites** | `Shift`+click, right-click or the star pins a model to the `★` section; click a pinned row to select it. |
| **Provider sorting** | Toolbar `↺` cycles default order → name (A→Z) → model count (↓N). |
| **Current model on the label** | The provider holding the active model shows `● <model> · <count>`. |
| **Stable height** | The menu keeps a constant height instead of jumping between 260 px and 368 px. |
| **Search passthrough** | Typing in the search box expands every provider, so a match can never hide inside a collapsed group. |
| **Keyboard** | `Tab` to a label, `Enter`/`Space` toggles, `↑`/`↓` move between labels, `→`/`←` open/close. |
| **i18n** | Chinese and English strings, picked from the page language. |
| **Hot reload** | Editing `lib/client.js` swaps the bundle in the running page in a second or two. |

The plugin only **decorates the DOM** — it never re-implements the picker. Model
selection, reasoning-effort switching, provider loading and the `/model` command
all stay with `@deepseek-ai/dsh-client-ui-model-selection`, so host updates that
touch selection logic keep working.

---

## Install

The desktop profile is owned by the Electron app, so `dsh plugin add` refuses to
touch it. Install manually — or use the script:

```sh
git clone https://github.com/lllbjs/dsh-model-accordion.git
cd dsh-model-accordion
./install.sh desktop        # or: ./install.sh "$DSH_PROFILE"
```

The script:

1. symlinks this package into `$DSH_HOME/profiles/<profile>/node_modules/dsh-model-accordion`;
2. appends the `- insert:` entry to `$DSH_HOME/profiles/<profile>/cordis.patch.yml`
   (backing the file up first, and doing nothing if the entry is already there).

### Manual install

```sh
ln -s /path/to/dsh-model-accordion ~/.dsh/profiles/desktop/node_modules/dsh-model-accordion

cat >> ~/.dsh/profiles/desktop/cordis.patch.yml <<'YAML'
- insert:
    - id: dsh-model-accordion
      name: dsh-model-accordion
YAML
```

Reload the GUI. The desktop profile hot-applies patch edits, so a restart is
usually not needed; if the menu still looks unchanged, quit and reopen the app.

### Uninstall

```sh
rm ~/.dsh/profiles/desktop/node_modules/dsh-model-accordion
# then delete the `- insert:` entry from cordis.patch.yml
```

---

## Usage

| Action | Gesture |
| --- | --- |
| Open a provider | Click its label |
| Close the open provider | Click the label again |
| Open a second provider | `Ctrl`/`Cmd` + click |
| Collapse all | Toolbar button, or click the only open provider |
| Favorite a model | Click the star on the row, or `Shift`+click / right-click the row |
| Select a model | Click it (favorites included) |
| Change sort order | Toolbar `↺` |

---

## Storage

All state lives in `localStorage` on the GUI origin:

| Key | Value |
| --- | --- |
| `dsh-model-accordion:open` | JSON array of open provider labels |
| `dsh-model-accordion:all-collapsed` | `true` when you deliberately closed everything |
| `dsh-model-accordion:favorites` | JSON array of `provider/model` keys |
| `dsh-model-accordion:sort` | `default` \| `name` \| `size` |
| `dsh-model-accordion:stable-height` | set to `false` to let the menu size to content |
| `dsh-model-accordion:last-open` | legacy key, still written for older builds |

---

## Diagnostics

While mounted, `window.__dshModelAccordion` is available in the page console:

```js
__dshModelAccordion.version      // "0.4.0"
__dshModelAccordion.rescan()     // re-run the DOM sweep
__dshModelAccordion.state()      // [{ open: [...], groups: [{ label, models, collapsed }] }]
__dshModelAccordion.favorites()  // ["qoder/qmodel_latest", ...]
__dshModelAccordion.sort()       // "default"
```

If a model list is on screen but no provider sections are recognised, the console
logs:

```
[dsh-model-accordion] a model list is present but no provider sections were found; the menu markup may have changed
```

That means the host's menu markup changed — update `ROW_SELECTOR` and the
`[data-menu-group]` assumptions in [`lib/client.js`](./lib/client.js).

---

## How it works

```
lib/client.js   the whole feature — a browser bundle wrapped in window.__ModuleLoader__
lib/index.js    host half — registers nothing, logs nothing, does nothing
```

1. A `MutationObserver` on `document.body` (`childList`, `subtree`) sweeps for model
   lists: any element with `id$="-models"` that has `[data-menu-group]` children.
2. Each provider section gets `data-dsh-acc-collapsed`, and the rows of a collapsed
   section are hidden with CSS — no React re-render, no virtual-DOM patching.
3. Click, keydown and input handlers are attached per container (idempotent), and
   the state is written back to `localStorage`.
4. The `/model` popup uses a different markup (`div[role="option"]` rows, no
   `data-provider-id`), so `ROW_SELECTOR` matches both shapes and the popup card is
   laid out as a two-column grid to give the toolbar a home.

---

## Compatibility

- DeepSeek Harness `0.2.1-rc.5` and later (tested against the desktop app bundle).
- No build step: the shipped `lib/client.js` is the browser bundle.
- No dependencies.

---

## License

MIT
