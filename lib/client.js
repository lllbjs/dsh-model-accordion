window.__ModuleLoader__.load({
	id: "dsh-model-accordion",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		/**
		 * Collapse a provider-grouped model list into one clickable label per provider.
		 *
		 * The menus are owned by @deepseek-ai/dsh-client-ui-model-selection, which does
		 * not export its components, so this plugin decorates the rendered DOM: every
		 * provider section inside a model list becomes a disclosure row. The composer
		 * model menu and the /model popup both render provider sections through the
		 * shell's MenuGroup, so the same decoration covers both.
		 *
		 * Features: accordion (one open at a time), additive open (Ctrl/Cmd click),
		 * expand/collapse-all toolbar, remembered open state, favorites pinned at the
		 * top, provider sorting, the current model shown on its provider label, a
		 * stable menu height, keyboard support, and search that never hides matches.
		 */

		/** Stable browser-plugin name. */
		const name = "dsh-model-accordion";

		/** No client services are required: the plugin only touches the DOM. */
		const inject = [];

		/** Reported through window.__dshModelAccordion for diagnostics. */
		const VERSION = "0.3.0";

		/* localStorage keys. */
		const K_OPEN = "dsh-model-accordion:open";
		const K_ALL_COLLAPSED = "dsh-model-accordion:all-collapsed";
		const K_FAVORITES = "dsh-model-accordion:favorites";
		const K_SORT = "dsh-model-accordion:sort";
		const K_LEGACY_LAST = "dsh-model-accordion:last-open";
		const K_STABLE_HEIGHT = "dsh-model-accordion:stable-height";

		/* DOM markers. */
		const CONTAINER_ATTR = "data-dsh-acc";
		const COLLAPSED_ATTR = "data-dsh-acc-collapsed";
		const OPEN_ATTR = "data-dsh-acc-open";
		const FAV_ATTR = "data-dsh-acc-fav";
		const CLONE_ATTR = "data-dsh-acc-clone";
		const STYLE_ID = "dsh-model-accordion-style";

		/**
		 * One selectable model row. The composer menu renders
		 * button[role=menuitemradio]; the /model popup renders div[role=option].
		 */
		const ROW_SELECTOR = 'button[role="menuitemradio"], [role="option"]';

		/** The search field of a model list (composer menu or /model popup). */
		const SEARCH_SELECTOR = '[role="searchbox"], input[type="search"], input[type="text"]';

		/** Sort modes, in cycle order. */
		const SORTS = ["default", "name", "size"];

		/** UI strings; the page language picks the dictionary. */
		const MESSAGES = {
			zh: {
				expandAll: "展开",
				collapseAll: "收起",
				expandAllTitle: "全部展开",
				collapseAllTitle: "全部收起",
				favorites: "收藏",
				favoriteHint: "右键或 Shift+点击收藏/取消收藏模型",
				sortDefault: "默认顺序",
				sortName: "按名称排序",
				sortSize: "按模型数量排序",
				menu: "模型菜单"
			},
			en: {
				expandAll: "All",
				collapseAll: "None",
				expandAllTitle: "Expand all providers",
				collapseAllTitle: "Collapse all providers",
				favorites: "Favorites",
				favoriteHint: "Right-click or Shift+click a model to favorite it",
				sortDefault: "Default order",
				sortName: "Sort by name",
				sortSize: "Sort by model count",
				menu: "Model menu"
			}
		};

		/** The dictionary for the current page language. */
		function t() {
			const lang = String(document.documentElement.lang || navigator.language || "en").toLowerCase();
			return lang.indexOf("zh") === 0 ? MESSAGES.zh : MESSAGES.en;
		}

		/** The stylesheet, injected once per page. */
		const CSS = [
			/* headings act as disclosure rows */
			'[data-dsh-acc] > [data-menu-group] > [data-menu-group-heading]{cursor:pointer;display:flex;align-items:center;gap:5px;user-select:none;border-radius:6px;outline:none}',
			'[data-dsh-acc] > [data-menu-group] > [data-menu-group-heading]:hover{background:var(--dsw-alias-interactive-bg-hover)}',
			'[data-dsh-acc] > [data-menu-group] > [data-menu-group-heading]:focus-visible{box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}',
			'[data-dsh-acc] > [data-menu-group] > [data-menu-group-heading]::before{content:attr(data-dsh-acc-chevron);flex:none;width:9px;font-size:10px;line-height:1;opacity:.55;transition:transform .12s ease}',
			'[data-dsh-acc] > [data-menu-group] > [data-menu-group-heading]::after{content:attr(data-dsh-acc-count);flex:none;margin-left:auto;padding-left:6px;max-width:64%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:10px;line-height:1;opacity:.4;font-variant-numeric:tabular-nums}',
			/* collapsed sections hide their rows */
			'[data-dsh-acc] > [data-menu-group][data-dsh-acc-collapsed="true"] > button[role="menuitemradio"],[data-dsh-acc] > [data-menu-group][data-dsh-acc-collapsed="true"] > [role="option"]{display:none}',
			/* an expanded heading is sticky, so it needs its own opaque fill */
			'[data-dsh-acc] > [data-menu-group][data-dsh-acc-collapsed="false"] > [data-menu-group-heading]{color:var(--dsw-alias-label-secondary);background-color:var(--dsw-alias-bg-base,#fff);background-image:linear-gradient(var(--dsw-alias-menu-group-header-fill,rgba(248,249,250,.94)),var(--dsw-alias-menu-group-header-fill,rgba(248,249,250,.94)));box-shadow:0 -4px 0 0 var(--dsw-alias-bg-base,#fff),0 2px 6px -2px rgba(0,0,0,.10)}',
			'[data-dsh-acc] > [data-menu-group][data-dsh-acc-collapsed="false"] > [data-menu-group-heading]:hover{background-image:linear-gradient(var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06)),var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06))),linear-gradient(var(--dsw-alias-menu-group-header-fill,rgba(248,249,250,.94)),var(--dsw-alias-menu-group-header-fill,rgba(248,249,250,.94)))}',
			'[data-dsh-acc] > [data-menu-group][data-dsh-acc-collapsed="false"] > [data-menu-group-heading]::before{opacity:.85}',
			/* rows fade in when their section opens */
			'@keyframes dsh-acc-row-in{from{opacity:0;transform:translateY(-2px)}to{opacity:1;transform:none}}',
			'[data-dsh-acc] > [data-menu-group][data-dsh-acc-collapsed="false"] > button[role="menuitemradio"],[data-dsh-acc] > [data-menu-group][data-dsh-acc-collapsed="false"] > [role="option"]{animation:dsh-acc-row-in .14s ease-out both}',
			/* pinned favorites */
			'[data-dsh-acc] > [data-menu-group][data-dsh-acc-fav]{position:relative;margin-bottom:2px}',
			'[data-dsh-acc] > [data-menu-group][data-dsh-acc-fav] > [data-menu-group-heading]{color:var(--dsw-alias-label-secondary);background-color:var(--dsw-alias-bg-base,#fff);background-image:linear-gradient(var(--dsw-alias-menu-group-header-fill,rgba(248,249,250,.94)),var(--dsw-alias-menu-group-header-fill,rgba(248,249,250,.94)));box-shadow:0 -4px 0 0 var(--dsw-alias-bg-base,#fff),0 2px 6px -2px rgba(0,0,0,.10)}',
			'[data-dsh-acc] > [data-menu-group][data-dsh-acc-fav] > [data-menu-group-heading]::before{content:"\\2605";flex:none;width:9px;font-size:9px;line-height:1;opacity:.6}',
			'[data-dsh-acc] > [data-menu-group][data-dsh-acc-fav] > [data-menu-group-heading]::after{content:""}',
			'[data-dsh-acc] > [data-menu-group][data-dsh-acc-fav] > button[role="menuitemradio"],[data-dsh-acc] > [data-menu-group][data-dsh-acc-fav] > [role="option"]{cursor:pointer}',
			/* toolbar inside the search row */
			'.' + "dsh-acc-toolbar" + '{display:flex;align-items:center;gap:2px;flex:none}',
			'.' + "dsh-acc-btn" + '{flex:none;display:inline-flex;align-items:center;justify-content:center;height:20px;min-width:20px;padding:0 5px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-tertiary,#81858c);font-size:10px;line-height:1;font-family:inherit;cursor:pointer;white-space:nowrap}',
			'.' + "dsh-acc-btn" + ':hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}',
			'.' + "dsh-acc-btn" + ':focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}'
		].join("\n");

		/** Install the stylesheet once. */
		function installStyle() {
			let tag = document.getElementById(STYLE_ID);
			if (tag === null) {
				tag = document.createElement("style");
				tag.id = STYLE_ID;
				tag.dataset.plugin = "dsh-model-accordion";
				document.head.appendChild(tag);
			}
			if (tag.textContent !== CSS) tag.textContent = CSS;
		}

		/** Read a JSON value from localStorage. */
		function readJSON(key, fallback) {
			try {
				const raw = window.localStorage.getItem(key);
				if (raw === null) return fallback;
				const value = JSON.parse(raw);
				return value === null ? fallback : value;
			} catch (error) {
				return fallback;
			}
		}

		/** Write a JSON value to localStorage, ignoring private-mode failures. */
		function writeJSON(key, value) {
			try {
				window.localStorage.setItem(key, JSON.stringify(value));
			} catch (error) {
				/* storage is optional; the accordion still works without it */
			}
		}

		/**
		 * Every model-list viewport currently in the page: a container holding at
		 * least two provider sections. Both the composer menu and the /model popup
		 * render their groups this way.
		 * @returns the containers to decorate.
		 */
		function modelLists() {
			const seen = new Set();
			for (const group of document.querySelectorAll("[data-menu-group]")) {
				const parent = group.parentElement;
				if (parent === null || seen.has(parent)) continue;
				if (parent.querySelectorAll(":scope > [data-menu-group]:not([data-dsh-acc-fav])").length < 2) continue;
				if (parent.querySelector(":scope > [data-menu-group] > " + ROW_SELECTOR) === null) continue;
				seen.add(parent);
			}
			return Array.from(seen);
		}

		/** Provider sections of one model list, in render order (favorites excluded). */
		function sectionsOf(container) {
			return Array.from(container.querySelectorAll(":scope > [data-menu-group]:not([data-dsh-acc-fav])"));
		}

		/** The heading element of one provider section, or null. */
		function headingOf(section) {
			return section.querySelector(":scope > [data-menu-group-heading]");
		}

		/** The model rows of one provider section. */
		function rowsOf(section) {
			return Array.from(section.children).filter((node) => node.matches(ROW_SELECTOR));
		}

		/** The label text a provider section shows. */
		function labelOf(section) {
			const heading = headingOf(section);
			if (heading === null) return "";
			return (heading.textContent || "").trim();
		}

		/** The stable provider/model key of one model row, or null. */
		function keyOf(row) {
			const tagged = row.querySelector("[data-provider-id][data-model-id]");
			if (tagged !== null) {
				return tagged.getAttribute("data-provider-id") + "/" + tagged.getAttribute("data-model-id");
			}
			/* The /model popup rows carry no ids: fall back to the labels. */
			const name = modelNameOf(row);
			if (name === null) return null;
			const section = row.parentElement;
			const provider = section === null ? "" : labelOf(section);
			return provider + "/" + name;
		}

		/** Find the live model row for a provider/model key. */
		function rowByKey(container, key) {
			for (const row of container.querySelectorAll(ROW_SELECTOR)) {
				if (row.closest("[data-dsh-acc-fav]") !== null) continue;
				if (keyOf(row) === key) return row;
			}
			return null;
		}

		/** The visible name of the model a row selects. */
		function modelNameOf(row) {
			if (row === null) return null;
			const tagged = row.querySelector('[data-slot="conversation.input.model.label"]');
			let cell = tagged;
			if (cell === null) {
				/* The deepest text-bearing span is the model name in every renderer. */
				for (const span of row.querySelectorAll("span")) {
					if (span.children.length > 0) continue;
					if ((span.textContent || "").trim().length === 0) continue;
					cell = span;
				}
			}
			const text = ((cell ?? row).textContent || "").trim();
			return text.length === 0 ? null : text;
		}

		/** The row a section shows as selected, or null. */
		function selectedRowOf(section) {
			return section.querySelector('[role="menuitemradio"][aria-checked="true"], [role="option"][aria-selected="true"]');
		}

		/** The open-provider set remembered from a previous visit. */
		function rememberedOpen(container) {
			const labels = sectionsOf(container).map(labelOf);
			if (readJSON(K_ALL_COLLAPSED, false) === true) return new Set();
			const stored = readJSON(K_OPEN, null);
			if (Array.isArray(stored)) {
				const kept = stored.filter((label) => labels.indexOf(label) !== -1);
				if (kept.length > 0) return new Set(kept);
			}
			let legacy = null;
			try {
				legacy = window.localStorage.getItem(K_LEGACY_LAST);
			} catch (error) {
				legacy = null;
			}
			if (typeof legacy === "string" && labels.indexOf(legacy) !== -1) return new Set([legacy]);
			const selected = sectionsOf(container).find((section) => selectedRowOf(section) !== null);
			const first = selected ?? sectionsOf(container)[0];
			return first === undefined ? new Set() : new Set([labelOf(first)]);
		}

		/** The accordion state of one container. */
		function stateOf(container) {
			if (container.__dshAcc === undefined) {
				container.__dshAcc = {
					open: rememberedOpen(container),
					order: sectionsOf(container).map(labelOf)
				};
			}
			return container.__dshAcc;
		}

		/** Persist the open set. */
		function persistOpen(container) {
			const state = stateOf(container);
			const labels = Array.from(state.open);
			writeJSON(K_OPEN, labels);
			writeJSON(K_ALL_COLLAPSED, labels.length === 0);
			writeJSON(K_LEGACY_LAST, labels.length > 0 ? labels[labels.length - 1] : null);
		}

		/**
		 * Whether a search query is narrowing the list right now. The search field
		 * sits in the menu surface, next to the list viewport.
		 * @param container - the model-list viewport.
		 * @returns true while the search box holds text.
		 */
		function searching(container) {
			const surface = container.parentElement;
			const box = (surface ?? container).querySelector(SEARCH_SELECTOR);
			if (box === null) return false;
			const value = typeof box.value === "string" ? box.value : "";
			return value.trim().length > 0;
		}

		/** Open one provider, replacing or extending the open set. */
		function setOpen(container, section, additive) {
			const state = stateOf(container);
			const label = section === null ? null : labelOf(section);
			if (label === null) {
				state.open = new Set();
			} else if (additive) {
				const next = new Set(state.open);
				if (next.has(label)) next.delete(label);
				else next.add(label);
				state.open = next;
			} else {
				state.open = state.open.size === 1 && state.open.has(label) ? new Set() : new Set([label]);
			}
			persistOpen(container);
			decorate(container);
			if (section !== null && state.open.has(labelOf(section))) {
				const first = rowsOf(section)[0];
				if (first !== undefined) first.scrollIntoView({ block: "nearest" });
			}
		}

		/** Open every provider, or collapse them all. */
		function setAll(container, open) {
			const state = stateOf(container);
			state.open = open ? new Set(sectionsOf(container).map(labelOf)) : new Set();
			persistOpen(container);
			decorate(container);
			if (open) container.scrollTop = 0;
		}

		/** The favorite keys, in the order they were added. */
		function favorites() {
			const stored = readJSON(K_FAVORITES, []);
			return Array.isArray(stored) ? stored.filter((key) => typeof key === "string") : [];
		}

		/** Add or remove one favorite key. */
		function toggleFavorite(container, key) {
			if (key === null) return;
			const list = favorites();
			const index = list.indexOf(key);
			if (index === -1) list.push(key);
			else list.splice(index, 1);
			writeJSON(K_FAVORITES, list);
			container.__dshAccFavSig = "";
			decorate(container);
		}

		/** Build the pinned favorites section, or remove it when empty. */
		function rebuildFavorites(container) {
			const keys = favorites();
			const rows = [];
			for (const key of keys) {
				const row = rowByKey(container, key);
				if (row !== null) rows.push({ key: key, row: row });
			}
			let section = container.querySelector(":scope > [data-menu-group][" + FAV_ATTR + "]");
			if (rows.length === 0) {
				if (section !== null) section.remove();
				container.__dshAccFavSig = "";
				return;
			}
			const signature = rows.map((entry) => entry.key + "|" + (entry.row.getAttribute("aria-checked") || "")).join(",");
			if (section !== null && container.__dshAccFavSig === signature) return;
			container.__dshAccFavSig = signature;
			if (section === null) {
				section = document.createElement("section");
				section.setAttribute("role", "group");
				section.setAttribute("data-menu-group", "");
				section.setAttribute(FAV_ATTR, "");
				section.setAttribute("data-dsh-acc-count", "");
				const heading = document.createElement("div");
				heading.setAttribute("data-menu-group-heading", "");
				heading.setAttribute("title", t().favoriteHint);
				section.appendChild(heading);
			}
			const heading = headingOf(section);
			if (heading !== null) {
				heading.textContent = t().favorites + " (" + rows.length + ")";
				heading.setAttribute("title", t().favoriteHint);
			}
			for (const row of rowsOf(section)) row.remove();
			for (const entry of rows) {
				const clone = entry.row.cloneNode(true);
				clone.removeAttribute("id");
				clone.setAttribute(CLONE_ATTR, entry.key);
				clone.setAttribute("tabindex", "-1");
				section.appendChild(clone);
			}
			if (container.firstElementChild !== section) container.insertBefore(section, container.firstElementChild);
		}

		/** The current sort mode. */
		function sortMode() {
			const stored = readJSON(K_SORT, "default");
			return SORTS.indexOf(stored) === -1 ? "default" : stored;
		}

		/** Reorder provider sections to match the sort mode. */
		function applyOrder(container) {
			const state = stateOf(container);
			const sections = sectionsOf(container);
			if (sections.length < 2) return;
			const mode = sortMode();
			let desired = sections.slice();
			if (mode === "name") {
				desired.sort((left, right) => labelOf(left).localeCompare(labelOf(right)));
			} else if (mode === "size") {
				desired.sort((left, right) => rowsOf(right).length - rowsOf(left).length);
			} else {
				desired.sort((left, right) => {
					const a = state.order.indexOf(labelOf(left));
					const b = state.order.indexOf(labelOf(right));
					return (a === -1 ? 999 : a) - (b === -1 ? 999 : b);
				});
			}
			const current = Array.from(container.children).filter((node) => node.hasAttribute("data-menu-group") && !node.hasAttribute(FAV_ATTR));
			if (current.length === desired.length && current.every((node, index) => node === desired[index])) return;
			for (const section of desired) container.appendChild(section);
			const fav = container.querySelector(":scope > [data-menu-group][" + FAV_ATTR + "]");
			if (fav !== null && container.firstElementChild !== fav) container.insertBefore(fav, container.firstElementChild);
		}

		/** Create one toolbar button. */
		function toolbarButton(className) {
			const button = document.createElement("button");
			button.type = "button";
			button.className = className;
			button.setAttribute("tabindex", "-1");
			return button;
		}

		/**
		 * Lay the /model popup out as a two-column grid so its toolbar can sit at the
		 * right end of the search row without moving React-owned nodes around.
		 * @param card - the popup surface.
		 * @param bar - the toolbar element.
		 */
		function layoutPopupCard(card, bar, container) {
			if (card.style.display !== "grid") {
				card.style.display = "grid";
				card.style.gridTemplateColumns = "minmax(0, 1fr) auto";
				/* one row for decoration, one for the search box, one for the list */
				card.style.gridTemplateRows = "auto auto minmax(0, 1fr)";
				card.style.alignItems = "center";
			}
			bar.style.gridColumn = "2";
			bar.style.gridRow = "2";
			bar.style.paddingRight = "4px";
			for (const node of Array.from(card.children)) {
				if (node === bar) continue;
				if (node.tagName === "INPUT") {
					node.style.gridColumn = "1";
					node.style.gridRow = "2";
				} else if (node.contains(container) || node === container) {
					node.style.gridColumn = "1 / -1";
					node.style.gridRow = "3";
					node.style.minHeight = "0";
					node.style.overflow = "auto";
				} else {
					node.style.gridColumn = "1 / -1";
					node.style.gridRow = "1";
				}
			}
			/* The card has its own height budget (the shell caps it), so the list
			   scrolls inside it instead of growing past the clip. */
			container.style.minHeight = "0";
			const cap = getComputedStyle(card).maxHeight;
			const limited = /^[0-9.]+px$/.test(cap) ? "calc(" + cap + " - 40px)" : "280px";
			if (container.style.maxHeight !== limited) container.style.maxHeight = limited;
			if (container.style.overflowY !== "auto") container.style.overflowY = "auto";
		}

		/**
		 * The toolbar next to the search box: expand/collapse all and the sort cycle.
		 * @returns the toolbar element, or null when the menu has no search row.
		 */
		function ensureToolbar(container) {
			const surface = container.parentElement;
			container.__dshAccPopup = false;
			if (surface === null) return null;
			const row = container.previousElementSibling;
			if (row === null) return null;
			/* The composer menu puts the search box inside a row element; the /model
			   popup renders the input itself as the list's previous sibling. */
			const popup = row.querySelector(SEARCH_SELECTOR) === null && row.matches(SEARCH_SELECTOR);
			container.__dshAccPopup = popup;
			if (!popup && row.querySelector(SEARCH_SELECTOR) === null) return null;
			let bar = row.querySelector("." + "dsh-acc-toolbar") ?? surface.querySelector(":scope > ." + "dsh-acc-toolbar");
			if (bar === null) {
				bar = document.createElement("span");
				bar.className = "dsh-acc-toolbar";
				if (!popup) {
					const wrap = row.querySelector("._wrap_14sgc_1") ?? row.firstElementChild;
					if (wrap !== null) wrap.style.flex = "1 1 auto";
					row.style.display = "flex";
					row.style.alignItems = "center";
					row.style.gap = "2px";
				}
				const all = toolbarButton("dsh-acc-btn");
				all.setAttribute("data-dsh-acc-action", "all");
				all.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					const state = stateOf(container);
					setAll(container, !sectionsOf(container).some((section) => state.open.has(labelOf(section))));
				});
				const sort = toolbarButton("dsh-acc-btn");
				sort.setAttribute("data-dsh-acc-action", "sort");
				sort.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					const next = SORTS[(SORTS.indexOf(sortMode()) + 1) % SORTS.length];
					writeJSON(K_SORT, next);
					decorate(container);
				});
				bar.appendChild(all);
				bar.appendChild(sort);
				if (popup) surface.appendChild(bar);
				else row.appendChild(bar);
			}
			if (popup) layoutPopupCard(surface, bar, container);
			const state = stateOf(container);
			const all = bar.querySelector('[data-dsh-acc-action="all"]');
			if (all !== null) {
				const anyOpen = sectionsOf(container).some((section) => state.open.has(labelOf(section)));
				const label = anyOpen ? t().collapseAll : t().expandAll;
				const title = anyOpen ? t().collapseAllTitle : t().expandAllTitle;
				if (all.textContent !== label) all.textContent = label;
				if (all.getAttribute("title") !== title) all.setAttribute("title", title);
			}
			const sort = bar.querySelector('[data-dsh-acc-action="sort"]');
			if (sort !== null) {
				const mode = sortMode();
				const text = mode === "name" ? "A\u2192Z" : mode === "size" ? "\u2193N" : "\u21ba";
				if (sort.textContent !== text) sort.textContent = text;
				sort.setAttribute("title", mode === "name" ? t().sortName : mode === "size" ? t().sortSize : t().sortDefault);
			}
			return bar;
		}

		/**
		 * Apply the accordion state to one model list.
		 * @param container - the model-list viewport.
		 */
		function decorate(container) {
			if (!container.hasAttribute(CONTAINER_ATTR)) container.setAttribute(CONTAINER_ATTR, "");
			const state = stateOf(container);
			const searchingNow = searching(container);
			const sections = sectionsOf(container);
			if (!searchingNow) applyOrder(container);
			for (const section of sections) {
				const heading = headingOf(section);
				if (heading === null) continue;
				const label = labelOf(section);
				const rows = rowsOf(section);
				const expanded = searchingNow || state.open.has(label);
				const collapsedAttr = String(!expanded);
				if (section.getAttribute(COLLAPSED_ATTR) !== collapsedAttr) section.setAttribute(COLLAPSED_ATTR, collapsedAttr);
				if (expanded && !searchingNow) section.setAttribute(OPEN_ATTR, "");
				else section.removeAttribute(OPEN_ATTR);
				const current = modelNameOf(selectedRowOf(section));
				const count = current === null ? String(rows.length) : "\u25cf " + current + " \u00b7 " + rows.length;
				if (heading.getAttribute("data-dsh-acc-count") !== count) heading.setAttribute("data-dsh-acc-count", count);
				const chevron = expanded ? "\u25be" : "\u25b8";
				if (heading.getAttribute("data-dsh-acc-chevron") !== chevron) heading.setAttribute("data-dsh-acc-chevron", chevron);
				if (heading.getAttribute("role") !== "button") heading.setAttribute("role", "button");
				if (heading.getAttribute("tabindex") !== "0") heading.setAttribute("tabindex", "0");
				const ariaExpanded = expanded ? "true" : "false";
				if (heading.getAttribute("aria-expanded") !== ariaExpanded) heading.setAttribute("aria-expanded", ariaExpanded);
				const controlled = rows.length > 0 && rows[0].id ? rows[0].id : null;
				if (controlled !== null && heading.getAttribute("aria-controls") !== controlled) heading.setAttribute("aria-controls", controlled);
			}
			if (!searchingNow) rebuildFavorites(container);
			else {
				const fav = container.querySelector(":scope > [data-menu-group][" + FAV_ATTR + "]");
				if (fav !== null) fav.style.display = "none";
			}
			const fav = container.querySelector(":scope > [data-menu-group][" + FAV_ATTR + "]");
			if (fav !== null && !searchingNow) {
				fav.style.display = "";
				/* React owns the sibling list, so the pinned section is re-anchored
				   on every pass instead of relying on the insert that created it. */
				if (container.firstElementChild !== fav) container.insertBefore(fav, container.firstElementChild);
			}
			ensureToolbar(container);
			/* The /model popup owns its own height budget, so the stable-height
			   floor applies only to the composer menu. */
			if (container.__dshAccPopup === true) {
				if (container.style.minHeight !== "0") container.style.minHeight = "0";
			} else if (readJSON(K_STABLE_HEIGHT, true) !== false && sections.length >= 6) {
				const min = "min(330px, calc(100vh - 200px))";
				if (container.style.minHeight !== min) container.style.minHeight = min;
			} else if (container.style.minHeight !== "") {
				container.style.minHeight = "";
			}
		}

		/** The provider section owning an element, if that element is its heading. */
		function sectionOfHeading(container, node) {
			if (!(node instanceof Element)) return null;
			const heading = node.closest("[data-menu-group-heading]");
			if (heading === null || heading.parentElement === null) return null;
			const section = heading.parentElement;
			if (section.parentElement !== container || section.hasAttribute(FAV_ATTR)) return null;
			return section;
		}

		/** Toggle the provider whose heading was activated. */
		function activate(container, section, additive) {
			setOpen(container, section, additive);
		}

		/** Move focus to the neighbouring provider heading. */
		function focusHeading(container, from, offset) {
			const sections = sectionsOf(container);
			const index = sections.indexOf(from);
			if (index === -1) return;
			const next = sections[(index + offset + sections.length) % sections.length];
			const heading = headingOf(next);
			if (heading !== null) heading.focus();
		}

		/** Replay a pointer sequence on the live row behind a favorites clone. */
		function forwardToOriginal(container, clone) {
			const key = clone.getAttribute(CLONE_ATTR);
			const row = key === null ? null : rowByKey(container, key);
			if (row === null) return;
			const options = { bubbles: true, cancelable: true, view: window, button: 0 };
			for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
				row.dispatchEvent(new PointerEvent(type, options));
			}
		}

		/** Wire one model list once; returns a disposer. */
		function attach(container) {
			if (typeof container.__dshAccOff === "function") return container.__dshAccOff;
			const onClick = (event) => {
				const target = event.target instanceof Element ? event.target : null;
				if (target === null) return;
				const clone = target.closest("[" + CLONE_ATTR + "]");
				if (clone !== null) {
					event.preventDefault();
					event.stopPropagation();
					forwardToOriginal(container, clone);
					return;
				}
				const toolbar = target.closest(".dsh-acc-btn");
				if (toolbar !== null) {
					event.preventDefault();
					event.stopPropagation();
					const action = toolbar.getAttribute("data-dsh-acc-action");
					if (action === "all") {
						const state = stateOf(container);
						setAll(container, !sectionsOf(container).some((section) => state.open.has(labelOf(section))));
					} else if (action === "sort") {
						const mode = sortMode();
						const next = SORTS[(SORTS.indexOf(mode) + 1) % SORTS.length];
						writeJSON(K_SORT, next);
						decorate(container);
					}
					return;
				}
				const section = sectionOfHeading(container, target);
				if (section !== null) {
					event.preventDefault();
					event.stopPropagation();
					activate(container, section, event.ctrlKey || event.metaKey);
					return;
				}
				const row = target.closest(ROW_SELECTOR);
				if (row !== null && event.shiftKey) {
					event.preventDefault();
					event.stopPropagation();
					toggleFavorite(container, keyOf(row));
				}
			};
			const onContextMenu = (event) => {
				const target = event.target instanceof Element ? event.target : null;
				if (target === null) return;
				const row = target.closest(ROW_SELECTOR);
				if (row === null || row.closest("[" + CLONE_ATTR + "]") !== null) return;
				event.preventDefault();
				event.stopPropagation();
				toggleFavorite(container, keyOf(row));
			};
			const onKeyDown = (event) => {
				const section = sectionOfHeading(container, event.target);
				if (section === null) return;
				const state = stateOf(container);
				const label = labelOf(section);
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					event.stopPropagation();
					activate(container, section, event.ctrlKey || event.metaKey);
					return;
				}
				if (event.key === "ArrowDown" || event.key === "ArrowUp") {
					event.preventDefault();
					event.stopPropagation();
					focusHeading(container, section, event.key === "ArrowDown" ? 1 : -1);
					return;
				}
				if (event.key === "ArrowRight") {
					event.preventDefault();
					event.stopPropagation();
					if (!state.open.has(label)) setOpen(container, section, false);
					return;
				}
				if (event.key === "ArrowLeft") {
					event.preventDefault();
					event.stopPropagation();
					if (state.open.has(label)) {
						state.open.delete(label);
						persistOpen(container);
						decorate(container);
					}
				}
			};
			const onInput = () => {
				decorate(container);
			};
			const onFocusIn = (event) => {
				if (modality !== "keyboard") return;
				const row = event.target instanceof Element ? event.target.closest(ROW_SELECTOR) : null;
				if (row === null || row.parentElement === null) return;
				const section = row.parentElement;
				if (section.parentElement !== container) return;
				if (section.hasAttribute(FAV_ATTR)) return;
				if (stateOf(container).open.has(labelOf(section))) return;
				setOpen(container, section, false);
			};
			container.addEventListener("click", onClick, true);
			container.addEventListener("contextmenu", onContextMenu, true);
			container.addEventListener("keydown", onKeyDown, true);
			container.addEventListener("input", onInput, true);
			container.addEventListener("focusin", onFocusIn, true);
			const off = () => {
				container.removeEventListener("click", onClick, true);
				container.removeEventListener("contextmenu", onContextMenu, true);
				container.removeEventListener("keydown", onKeyDown, true);
				container.removeEventListener("input", onInput, true);
				container.removeEventListener("focusin", onFocusIn, true);
				container.__dshAccOff = undefined;
			};
			container.__dshAccOff = off;
			return off;
		}

		/**
		 * The last input modality seen in the page. The model menu focuses its
		 * current row programmatically when it opens; without this flag that focus
		 * would look like navigation and would override the remembered provider.
		 */
		let modality = "pointer";

		/**
		 * Mount the accordion: watch for model menus, decorate their lists, and keep
		 * the decoration alive across React re-renders.
		 * @param ctx - the client plugin context.
		 */
		function apply(ctx) {
			installStyle();
			const attached = new WeakMap();
			let warned = 0;
			const sweep = () => {
				const lists = modelLists();
				for (const container of lists) {
					if (!attached.has(container)) attached.set(container, attach(container));
					decorate(container);
				}
				if (lists.length === 0) {
					const now = Date.now();
					if (document.querySelector('[id$="-models"]') !== null && now - warned > 5000) {
						warned = now;
						console.warn("[dsh-model-accordion] a model list is present but no provider sections were found; the menu markup may have changed");
					}
				}
			};
			/* Mutations are delivered before the next paint, so decorating here
			   never lets an un-collapsed list flash on screen. Only childList is
			   observed: this plugin's own attribute writes must not retrigger it. */
			const observer = new MutationObserver(sweep);
			observer.observe(document.body, { childList: true, subtree: true });
			const onKey = () => {
				modality = "keyboard";
			};
			const onPointer = () => {
				modality = "pointer";
			};
			document.addEventListener("keydown", onKey, true);
			document.addEventListener("pointerdown", onPointer, true);
			document.addEventListener("mousedown", onPointer, true);
			sweep();
			window.__dshModelAccordion = {
				version: VERSION,
				rescan: sweep,
				state: () => modelLists().map((container) => ({
					open: Array.from(stateOf(container).open),
					groups: sectionsOf(container).map((section) => ({
						label: labelOf(section),
						models: rowsOf(section).length,
						collapsed: section.getAttribute(COLLAPSED_ATTR) === "true"
					}))
				})),
				favorites: favorites,
				sort: sortMode
			};
			ctx.effect(() => () => {
				observer.disconnect();
				document.removeEventListener("keydown", onKey, true);
				document.removeEventListener("pointerdown", onPointer, true);
				document.removeEventListener("mousedown", onPointer, true);
				for (const container of modelLists()) {
					const off = attached.get(container);
					if (typeof off === "function") off();
				}
				delete window.__dshModelAccordion;
				document.getElementById(STYLE_ID)?.remove();
			}, "dsh-model-accordion: model list accordion");
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
