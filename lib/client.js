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

		/** Cordis services used by the connector settings hub. The accordion
		    itself only touches the DOM; `slots` registers the settings card and
		    `locale` supplies its dictionary. Both are platform seeds. */
		const inject = ["slots", "locale"];

		/** Reported through window.__dshModelAccordion for diagnostics. */
		const VERSION = "0.9.0";

		/* React is a platform seed. Resolve it defensively so a missing React
		   can never take the DOM accordion down with the (optional) card. */
		let React = null;
		try { React = require("react"); } catch (error) { /* settings card is optional */ }

		/* localStorage keys. */
		const K_OPEN = "dsh-model-accordion:open";
		const K_ALL_COLLAPSED = "dsh-model-accordion:all-collapsed";
		const K_FAVORITES = "dsh-model-accordion:favorites";
		const K_SORT = "dsh-model-accordion:sort";
		const K_LEGACY_LAST = "dsh-model-accordion:last-open";
		const K_STABLE_HEIGHT = "dsh-model-accordion:stable-height";
		const K_MISSING = "dsh-model-accordion:missing-models";
		/* Key -> the model id the user actually starred. Only the composer menu
		   tags its rows with ids, so this is a hint, never a requirement. */
		const K_FAVORITE_IDS = "dsh-model-accordion:favorite-ids";
		/* Unified connector-hub preferences (active tab, auto-probe). */
		const K_HUB = "dsh-model-accordion:hub";

		/* DOM markers. */
		const CONTAINER_ATTR = "data-dsh-acc";
		const COLLAPSED_ATTR = "data-dsh-acc-collapsed";
		const OPEN_ATTR = "data-dsh-acc-open";
		const FAV_ATTR = "data-dsh-acc-fav";
		const STAR_ATTR = "data-dsh-acc-star";
		const CLONE_ATTR = "data-dsh-acc-clone";
		const STYLE_ID = "dsh-model-accordion-style";
		/* Separate stylesheet for the connector hub settings page. */
		const HUB_STYLE_ID = "dsh-model-accordion-hub-style";

		/* Refresh events. Other connector plugins can add their own target (see
		   window.__dshModelAccordion.registerRefreshTarget) and listen for the
		   broadcast. */
		const REFRESH_START_EVENT = "dsh-model-accordion:refresh-start";
		const REFRESH_DONE_EVENT = "dsh-model-accordion:refresh-done";
		const REFRESH_REGISTER_EVENT = "dsh-model-accordion:refresh-register";

		/* Built-in connectors exposing a same-origin POST /models/refresh route.
		   Each region is fetched separately because the route branches on the
		   "region" query parameter. Derived from the installed connectors'
		   WORKBUDDY_REGIONS / TRAE_REGIONS. */
		const REFRESH_TARGETS = [
			{ path: "/plugins/dsh-connect-workbuddy/models/refresh", label: "workbuddy", regions: ["cn", "global"] },
			{ path: "/plugins/dsh-connect-trae/models/refresh", label: "trae", regions: ["cn", "ai"] },
			/* @dmh2002/dsh-connect-qoder deliberately uses an UNSCOPED row id
			   (`dsh-connect-qoder`), so its HTTP routes are mounted under that
			   prefix, not the npm scope. The route also requires ?region=.
			   A 404/405 is still reported as a skip rather than a failure. */
			{ path: "/plugins/dsh-connect-qoder/models/refresh", label: "qoder", regions: ["cn", "global"] }
		];

		/**
		 * One selectable model row. The composer menu renders
		 * button[role=menuitemradio]; the /model popup renders div[role=option].
		 */
		const ROW_SELECTOR = 'button[role="menuitemradio"], [role="option"]';

		/** The search field of a model list (composer menu or /model popup). */
		const SEARCH_SELECTOR = '[role="searchbox"], input[type="search"], input[type="text"]';

		/** Sort modes, in cycle order. */
		const SORTS = ["default", "name", "size"];

		/**
		 * The rate chip a provider plugin may append to a model label, e.g.
		 * " · x0.00". Connector plugins (WorkBuddy, Trae, Qoder) render it in its
		 * own span and re-render that span whenever a promotion starts or ends or
		 * the usage snapshot refreshes, so the same row's text is
		 * "DeepSeek-V4.1-Flash" at one moment and "DeepSeek-V4.1-Flash · x0.00" at
		 * the next. A key built from that text is not stable, so the chip is
		 * stripped before the text becomes part of a key.
		 */
		const RATE_SUFFIX = /(?:\s*[\u00b7\u30fb]\s*x\s*\d+(?:\.\d+)?)+$/;

		/**
		 * Class-name segments of label parts that are decoration, not the name:
		 * the rate chip, the promotion chip, the load icon, the "new" mark, the
		 * release tag. Matched as whole `-`/`_`-delimited segments so a hashed
		 * CSS-module name is not skipped by accident.
		 */
		const DECORATION_PART = /(?:^|[-_])(?:rate|promo|promotion|discount|badge|chip|tag|busy|new|mark)(?:[-_]|$)/i;

		/** Strip a trailing rate chip from a model name. */
		function stripRate(text) {
			const trimmed = text.trim();
			const stripped = trimmed.replace(RATE_SUFFIX, "").trim();
			return stripped.length === 0 ? trimmed : stripped;
		}

		/**
		 * Normalise a provider/model key: the provider label is stable, the model
		 * part may carry a rate chip that has to go.
		 * @param key - a stored or freshly built key.
		 */
		function normalizeKey(key) {
			const slash = key.indexOf("/");
			if (slash === -1) return stripRate(key);
			return key.slice(0, slash) + "/" + stripRate(key.slice(slash + 1));
		}

		/** UI strings; the page language picks the dictionary. */
		const MESSAGES = {
			zh: {
				expandAll: "展开",
				collapseAll: "收起",
				expandAllTitle: "全部展开",
				collapseAllTitle: "全部收起",
				favorites: "收藏",
				favoriteHint: "点击模型右侧的星标收藏/取消收藏（也可 Shift+点击或右键）",
				favoriteAdd: "收藏此模型",
				favoriteRemove: "取消收藏",
				sortDefault: "默认顺序",
				sortName: "按名称排序",
				sortSize: "按模型数量排序",
				menu: "模型菜单",
				refresh: "刷新",
				refreshTitle: "从各连接器重新拉取模型列表",
				refreshBusy: "刷新中…",
				refreshDone: "已刷新",
				refreshFailed: "刷新失败"
			},
			en: {
				expandAll: "All",
				collapseAll: "None",
				expandAllTitle: "Expand all providers",
				collapseAllTitle: "Collapse all providers",
				favorites: "Favorites",
				favoriteHint: "Click the star on a model row to favorite it (Shift+click or right-click also work)",
				favoriteAdd: "Add to favorites",
				favoriteRemove: "Remove from favorites",
				sortDefault: "Default order",
				sortName: "Sort by name",
				sortSize: "Sort by model count",
				menu: "Model menu",
				refresh: "Refresh",
				refreshTitle: "Re-fetch the model list from every connector",
				refreshBusy: "Refreshing…",
				refreshDone: "Refreshed",
				refreshFailed: "Refresh failed"
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
			'.' + "dsh-acc-btn" + ':focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}',
			/* refresh button: busy spinner / success / failure state */
			'.' + "dsh-acc-btn" + '[data-dsh-acc-refresh="busy"]{opacity:.6;cursor:progress}',
			'.' + "dsh-acc-btn" + '[data-dsh-acc-refresh="busy"]::before{content:"";display:inline-block;width:8px;height:8px;margin-right:3px;border:1.5px solid currentColor;border-right-color:transparent;border-radius:50%;animation:dsh-acc-spin .7s linear infinite}',
			'@keyframes dsh-acc-spin{to{transform:rotate(360deg)}}',
			'.' + "dsh-acc-btn" + '[data-dsh-acc-refresh="done"]{color:var(--dsw-alias-state-success-primary,#3a9)}',
			'.' + "dsh-acc-btn" + '[data-dsh-acc-refresh="failed"]{color:var(--dsw-alias-state-danger-primary,#d55)}',
			/* per-row favorite star: it lives inside the row's check slot, which is
			   hidden until the row is hovered, so the star fades in on hover too */
			'[data-dsh-acc] ' + '[data-dsh-acc-star]{display:inline-flex;align-items:center;justify-content:center;flex:none;margin-left:auto;width:16px;height:16px;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#81858c);cursor:pointer;opacity:.38;transition:opacity .12s ease,color .12s ease}',
			'[data-dsh-acc] ' + '[data-dsh-acc-star][data-on="true"]{opacity:1;color:var(--dsw-alias-state-warning-primary,#f0a020)}',
			'[data-dsh-acc] button[role="menuitemradio"]:hover > [data-dsh-acc-star],[data-dsh-acc] [role="option"]:hover > [data-dsh-acc-star],[data-dsh-acc] [data-dsh-acc-star]:focus-visible{opacity:1}',
			'[data-dsh-acc] ' + '[data-dsh-acc-star]:hover{color:var(--dsw-alias-state-warning-primary,#f0a020)}',
			'[data-dsh-acc] ' + '[data-dsh-acc-star]:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}',
			'[data-dsh-acc] ' + '[data-dsh-acc-star] svg{display:block;width:12px;height:12px}',
			/* favorites mirrored into the first-level menu */
			'[data-dsh-acc-root] > [class*="cellLabel"]{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:58%}',
			'[data-dsh-acc-root] > [class*="cellValue"]{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;text-align:right;font-size:11px;opacity:.72}',
			'[data-dsh-acc-root] > [class*="cellChevron"]{flex:none;color:var(--dsw-alias-state-warning-primary,#f0a020);opacity:.55}',
			'[data-dsh-acc-root]:hover > [class*="cellChevron"]{opacity:1}'
		].join("\n");

		/* ------------------------------------------------------------ connector hub
		   One settings card that puts all four connector plugins behind a single
		   set of tabs. It does not duplicate their native settings pages — it
		   links to them. Everything is scoped under [data-dsh-hub] so the
		   accordion's own styles are untouched. */
		const HUB_CSS = [
			'[data-dsh-hub]{font:inherit;color:var(--dsw-alias-label-primary,#1f2329);display:flex;flex-direction:column;gap:14px}',
			'[data-dsh-hub] *{box-sizing:border-box}',
			'[data-dsh-hub] .dsh-hub-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}',
			'[data-dsh-hub] .dsh-hub-title{font-size:14px;font-weight:600;line-height:1.4;margin:0}',
			'[data-dsh-hub] .dsh-hub-sub{font-size:11px;line-height:1.5;opacity:.62;margin:3px 0 0;max-width:60ch}',
			'[data-dsh-hub] .dsh-hub-actions{display:flex;gap:6px;flex-wrap:wrap}',
			'[data-dsh-hub] .dsh-hub-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:28px;padding:4px 11px;border:1px solid var(--dsw-alias-border-secondary,rgba(0,0,0,.12));border-radius:7px;background:var(--dsw-alias-bg-base,#fff);color:inherit;font:inherit;font-size:11px;line-height:1.2;cursor:pointer;white-space:nowrap}',
			'[data-dsh-hub] .dsh-hub-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06))}',
			'[data-dsh-hub] .dsh-hub-btn:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}',
			'[data-dsh-hub] .dsh-hub-btn[disabled]{opacity:.5;cursor:progress}',
			'[data-dsh-hub] .dsh-hub-btn-primary{border-color:transparent;background:var(--dsw-alias-state-business-primary,#3b6cf6);color:#fff}',
			'[data-dsh-hub] .dsh-hub-btn-primary:hover{opacity:.9;background:var(--dsw-alias-state-business-primary,#3b6cf6)}',
			'[data-dsh-hub] .dsh-hub-tabs{display:flex;gap:2px;flex-wrap:wrap;border-bottom:1px solid var(--dsw-alias-border-secondary,rgba(0,0,0,.1));padding-bottom:0}',
			'[data-dsh-hub] .dsh-hub-tab{border:0;border-bottom:2px solid transparent;background:transparent;color:inherit;font:inherit;font-size:11px;padding:7px 10px 8px;cursor:pointer;opacity:.6;white-space:nowrap}',
			'[data-dsh-hub] .dsh-hub-tab:hover{opacity:.9}',
			'[data-dsh-hub] .dsh-hub-tab[aria-selected="true"]{opacity:1;border-bottom-color:var(--dsw-alias-state-business-primary,#3b6cf6);font-weight:600}',
			'[data-dsh-hub] .dsh-hub-panel{display:flex;flex-direction:column;gap:12px}',
			'[data-dsh-hub] .dsh-hub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(225px,1fr));gap:10px}',
			'[data-dsh-hub] .dsh-hub-card{display:flex;flex-direction:column;gap:9px;padding:12px;border:1px solid var(--dsw-alias-border-secondary,rgba(0,0,0,.1));border-radius:9px;background:var(--dsw-alias-bg-subtle,rgba(0,0,0,.015))}',
			'[data-dsh-hub] .dsh-hub-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px}',
			'[data-dsh-hub] .dsh-hub-name{font-size:12px;font-weight:600;line-height:1.3}',
			'[data-dsh-hub] .dsh-hub-pkg{font-size:10px;opacity:.5;word-break:break-all;line-height:1.35}',
			'[data-dsh-hub] .dsh-hub-status{display:inline-flex;align-items:center;gap:5px;font-size:10px;padding:2px 7px;border-radius:999px;white-space:nowrap;background:rgba(128,128,128,.14);opacity:.9}',
			'[data-dsh-hub] .dsh-hub-status::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}',
			'[data-dsh-hub] .dsh-hub-status[data-state="ok"]{color:var(--dsw-alias-state-success-primary,#2e9e6b)}',
			'[data-dsh-hub] .dsh-hub-status[data-state="error"]{color:var(--dsw-alias-state-danger-primary,#d55)}',
			'[data-dsh-hub] .dsh-hub-status[data-state="probing"]{color:var(--dsw-alias-state-warning-primary,#c88a12)}',
			'[data-dsh-hub] .dsh-hub-detail{font-size:10px;line-height:1.5;opacity:.68;min-height:1.5em;word-break:break-word}',
			'[data-dsh-hub] .dsh-hub-card-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto}',
			'[data-dsh-hub] .dsh-hub-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 11px;border:1px solid var(--dsw-alias-border-secondary,rgba(0,0,0,.1));border-radius:8px}',
			'[data-dsh-hub] .dsh-hub-row-label{font-size:11px;line-height:1.4}',
			'[data-dsh-hub] .dsh-hub-row-desc{font-size:10px;opacity:.6;line-height:1.4;margin-top:2px}',
			'[data-dsh-hub] .dsh-hub-switch{position:relative;flex:none;width:32px;height:18px;border:0;border-radius:999px;background:rgba(128,128,128,.35);cursor:pointer;transition:background .15s}',
			'[data-dsh-hub] .dsh-hub-switch::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .15s}',
			'[data-dsh-hub] .dsh-hub-switch[aria-checked="true"]{background:var(--dsw-alias-state-business-primary,#3b6cf6)}',
			'[data-dsh-hub] .dsh-hub-switch[aria-checked="true"]::after{transform:translateX(14px)}',
			'[data-dsh-hub] .dsh-hub-note{font-size:10px;line-height:1.6;opacity:.6;padding:9px 11px;border-left:2px solid var(--dsw-alias-border-secondary,rgba(0,0,0,.15));margin:0}',
			'[data-dsh-hub] .dsh-hub-stat{display:flex;gap:16px;flex-wrap:wrap;font-size:11px}',
			'[data-dsh-hub] .dsh-hub-stat b{font-size:15px;font-weight:600;display:block;line-height:1.3}',
			'[data-dsh-hub] .dsh-hub-stat span{opacity:.6}',
			'[data-dsh-hub] .dsh-hub-error{font-size:10px;color:var(--dsw-alias-state-danger-primary,#d55);line-height:1.5}',
			'[data-dsh-hub] .dsh-hub-section{display:flex;flex-direction:column;gap:9px;padding:12px;border:1px solid var(--dsw-alias-border-secondary,rgba(0,0,0,.1));border-radius:9px;background:var(--dsw-alias-bg-subtle,rgba(0,0,0,.015))}',
			'[data-dsh-hub] .dsh-hub-section-title{font-size:12px;font-weight:600;line-height:1.3;margin:0}',
			'[data-dsh-hub] .dsh-hub-kv{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}',
			'[data-dsh-hub] .dsh-hub-kv-item{min-width:0;padding:7px 9px;border:1px solid var(--dsw-alias-border-secondary,rgba(0,0,0,.08));border-radius:7px}',
			'[data-dsh-hub] .dsh-hub-kv-label{font-size:9px;opacity:.6;line-height:1.4}',
			'[data-dsh-hub] .dsh-hub-kv-value{font-size:12px;font-weight:600;line-height:1.4;word-break:break-word}',
			'[data-dsh-hub] .dsh-hub-input{min-height:28px;padding:4px 9px;border:1px solid var(--dsw-alias-border-secondary,rgba(0,0,0,.16));border-radius:7px;background:var(--dsw-alias-bg-base,#fff);color:inherit;font:inherit;font-size:11px;line-height:1.3;min-width:0}',
			'[data-dsh-hub] .dsh-hub-input:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}',
			'[data-dsh-hub] .dsh-hub-select{min-height:28px;padding:4px 7px;border:1px solid var(--dsw-alias-border-secondary,rgba(0,0,0,.16));border-radius:7px;background:var(--dsw-alias-bg-base,#fff);color:inherit;font:inherit;font-size:11px;cursor:pointer}',
			'[data-dsh-hub] .dsh-hub-form-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
			'[data-dsh-hub] .dsh-hub-form-row .dsh-hub-input{flex:1 1 170px}',
			'[data-dsh-hub] .dsh-hub-list{display:flex;flex-direction:column;gap:4px}',
			'[data-dsh-hub] .dsh-hub-list-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 9px;border:1px solid var(--dsw-alias-border-secondary,rgba(0,0,0,.08));border-radius:7px;font-size:11px;line-height:1.4}',
			'[data-dsh-hub] .dsh-hub-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}',
			'[data-dsh-hub] .dsh-hub-tag{font-size:9px;line-height:1.4;padding:1px 6px;border-radius:999px;background:rgba(128,128,128,.14);opacity:.9;white-space:nowrap}',
			'[data-dsh-hub] .dsh-hub-tag[data-variant=\"new\"]{color:var(--dsw-alias-state-business-primary,#3b6cf6)}',
			'[data-dsh-hub] .dsh-hub-tag[data-variant=\"off\"]{color:var(--dsw-alias-state-danger-primary,#d55)}',
			'[data-dsh-hub] .dsh-hub-models{display:flex;flex-direction:column;gap:5px;max-height:330px;overflow:auto;padding-right:2px}',
			'[data-dsh-hub] .dsh-hub-model{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid var(--dsw-alias-border-secondary,rgba(0,0,0,.08));border-radius:8px}',
			'[data-dsh-hub] .dsh-hub-model-main{min-width:0;flex:1}',
			'[data-dsh-hub] .dsh-hub-model-id{font-size:11px;font-weight:600;line-height:1.4;word-break:break-word}',
			'[data-dsh-hub] .dsh-hub-code{font-size:9px;opacity:.55;margin-left:6px;font-weight:400;word-break:break-all}',
			'[data-dsh-hub] .dsh-hub-model-meta{font-size:9px;opacity:.62;line-height:1.5;margin-top:3px;word-break:break-word}',
			'[data-dsh-hub] .dsh-hub-model-actions{display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex:none;max-width:45%}',
			'[data-dsh-hub] .dsh-hub-ok{font-size:9px;line-height:1.5;color:var(--dsw-alias-state-success-primary,#2e9e6b);word-break:break-word;text-align:right}',
			'[data-dsh-hub] .dsh-hub-bad{font-size:9px;line-height:1.5;color:var(--dsw-alias-state-danger-primary,#d55);word-break:break-word;text-align:right}',
			'[data-dsh-hub] .dsh-hub-inline-note{font-size:10px;line-height:1.6;opacity:.65;margin:0}',
			'[data-dsh-hub] .dsh-hub-link{font-size:10px;line-height:1.5;color:var(--dsw-alias-state-business-primary,#3b6cf6);word-break:break-all;margin:0}'
		].join("\n");

		/** Install the stylesheets once (accordion + connector hub). */
		function installStyle() {
			let tag = document.getElementById(STYLE_ID);
			if (tag === null) {
				tag = document.createElement("style");
				tag.id = STYLE_ID;
				tag.dataset.plugin = "dsh-model-accordion";
				document.head.appendChild(tag);
			}
			if (tag.textContent !== CSS) tag.textContent = CSS;
			let hubTag = document.getElementById(HUB_STYLE_ID);
			if (hubTag === null) {
				hubTag = document.createElement("style");
				hubTag.id = HUB_STYLE_ID;
				hubTag.dataset.plugin = "dsh-model-accordion";
				document.head.appendChild(hubTag);
			}
			if (hubTag.textContent !== HUB_CSS) hubTag.textContent = HUB_CSS;
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

		/**
		 * The stable provider/model key of one model row, or null.
		 *
		 * The key is derived from the visible labels rather than from
		 * data-provider-id/data-model-id: only the composer menu tags its rows
		 * with those ids, so an id-based key would not match the same model in
		 * the /model popup and a star set in one surface would look unset in the
		 * other.
		 */
		function keyOf(row) {
			const name = modelNameOf(row);
			if (name === null) return null;
			const section = row.parentElement;
			const provider = section === null ? "" : labelOf(section);
			return provider + "/" + name;
		}

		/** The model id a row carries, or null in surfaces that do not tag rows. */
		function modelIdOf(row) {
			if (row === null) return null;
			const tagged = row.querySelector("[data-provider-id][data-model-id]");
			return tagged === null ? null : tagged.getAttribute("data-model-id");
		}

		/** The id-based key older builds stored, used to migrate favorites. */
		function legacyKeyOf(row) {
			const tagged = row.querySelector("[data-provider-id][data-model-id]");
			if (tagged === null) return null;
			return tagged.getAttribute("data-provider-id") + "/" + tagged.getAttribute("data-model-id");
		}

		/** The star glyph, outlined (not favorited) and filled (favorited). */
		const STAR_SVG_OFF = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false"><path d="M8 2.2l1.72 3.48 3.84.56-2.78 2.71.66 3.83L8 11.02l-3.44 1.76.66-3.83L2.44 6.24l3.84-.56L8 2.2z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>';
		const STAR_SVG_ON = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false"><path d="M8 2.2l1.72 3.48 3.84.56-2.78 2.71.66 3.83L8 11.02l-3.44 1.76.66-3.83L2.44 6.24l3.84-.56L8 2.2z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>';

		/** The star button of one model row, created on first use. */
		function starOf(row) {
			let star = row.querySelector(":scope > [" + STAR_ATTR + "]");
			if (star !== null) return star;
			star = document.createElement("span");
			star.setAttribute(STAR_ATTR, "");
			star.setAttribute("role", "button");
			star.setAttribute("tabindex", "-1");
			/* Keep the selected check-mark at the far right: the star goes just
			   before the row's trailing icon slot when there is one. */
			const last = row.lastElementChild;
			/* The check slot is empty on unselected rows, so the test cannot look
			   for its icon: any trailing text-less child is that slot. */
			const trailing = last !== null && last !== star && (last.textContent || "").trim() === "" && last.querySelector("[data-provider-id]") === null;
			if (trailing) row.insertBefore(star, last);
			else row.appendChild(star);
			return star;
		}

		/**
		 * Rewrite favorites stored by older builds, whose keys came from
		 * data-provider-id/data-model-id, into the label-based keys used now.
		 */
		function migrateFavorites(container) {
			const stored = favorites();
			if (stored.length === 0) return;
			let changed = false;
			const next = stored.map((key) => {
				if (rowByKey(container, key) !== null) return key;
				for (const row of container.querySelectorAll(ROW_SELECTOR)) {
					if (row.closest("[" + FAV_ATTR + "]") !== null) continue;
					if (legacyKeyOf(row) !== key) continue;
					const renamed = keyOf(row);
					if (renamed === null || renamed === key) return key;
					changed = true;
					return renamed;
				}
				return key;
			});
			if (!changed) return;
			/* Two legacy keys can resolve to the same label key. */
			const unique = [];
			for (const key of next) if (unique.indexOf(key) === -1) unique.push(key);
			writeJSON(K_FAVORITES, unique);
		}

		/**
		 * What one model list says about a favorite key: how many rows carry it
		 * and which model ids are on screen.
		 *
		 * A key is "shared" when a provider ships two models under one name
		 * (WorkBuddy Global has a paid and a free "Deepseek-V4.1-Flash"). Only a
		 * shared key needs the remembered id to pick a twin; on a lone row a
		 * stale id must never blank out the star.
		 */
		function keyContext(container) {
			const counts = new Map();
			const present = new Set();
			for (const row of container.querySelectorAll(ROW_SELECTOR)) {
				if (row.closest("[data-dsh-acc-fav]") !== null) continue;
				const key = keyOf(row);
				if (key !== null) counts.set(key, (counts.get(key) || 0) + 1);
				const id = modelIdOf(row);
				if (id !== null) present.add(id);
			}
			const shared = new Set();
			for (const [key, count] of counts) if (count > 1) shared.add(key);
			return { shared: shared, present: present };
		}

		/**
		 * Whether one row shows as favorited.
		 *
		 * When a key has a remembered model id, only that twin is the favorite.
		 * The hint vetoes a row only while the list still shows the hinted model
		 * and the key really is shared; otherwise the favorite would silently
		 * disappear whenever a provider re-ids or renames a model.
		 */
		function isFavorite(keys, ids, key, row, context) {
			if (keys.indexOf(key) === -1) return false;
			const hint = ids[key];
			if (hint === undefined || row === null) return true;
			const id = modelIdOf(row);
			if (id === null || id === hint) return true;
			if (context === undefined) return true;
			if (context.shared.has(key) !== true) return true;
			return context.present.has(hint) !== true;
		}

		/**
		 * Settle the twin of a shared key that was starred before ids were
		 * recorded: the row the session already uses is the one the user was on.
		 */
		function adoptSharedHints(container, ids, context) {
			if (context.shared.size === 0) return ids;
			let next = null;
			for (const key of context.shared) {
				if (ids[key] !== undefined) continue;
				for (const row of container.querySelectorAll(ROW_SELECTOR)) {
					if (row.closest("[data-dsh-acc-fav]") !== null) continue;
					if (keyOf(row) !== key) continue;
					if (row.getAttribute("aria-checked") !== "true" && row.getAttribute("aria-selected") !== "true") continue;
					const id = modelIdOf(row);
					if (id === null) continue;
					if (next === null) next = Object.assign({}, ids);
					next[key] = id;
					break;
				}
			}
			if (next === null) return ids;
			writeJSON(K_FAVORITE_IDS, next);
			return next;
		}

		/** Refresh every star in a model list against the stored favorites. */
		function decorateStars(container) {
			const keys = favorites();
			const context = keyContext(container);
			const ids = adoptSharedHints(container, favoriteIds(), context);
			const dict = t();
			for (const row of container.querySelectorAll(ROW_SELECTOR)) {
				/* A pinned clone knows its key from the attribute; deriving it from
				   the clone's own section would yield "Favorites/<model>". */
				const stored = row.getAttribute(CLONE_ATTR);
				const key = stored === null ? keyOf(row) : normalizeKey(stored);
				if (key === null) continue;
				const on = isFavorite(keys, ids, key, row, context);
				const star = starOf(row);
				const state = on ? "true" : "false";
				if (star.getAttribute("data-on") !== state) star.setAttribute("data-on", state);
				const pressed = on ? "true" : "false";
				if (star.getAttribute("aria-pressed") !== pressed) star.setAttribute("aria-pressed", pressed);
				const title = on ? dict.favoriteRemove : dict.favoriteAdd;
				if (star.getAttribute("title") !== title) star.setAttribute("title", title);
				if (star.getAttribute("aria-label") !== title) star.setAttribute("aria-label", title);
				const html = on ? STAR_SVG_ON : STAR_SVG_OFF;
				if (star.__dshAccSvg !== html) {
					star.innerHTML = html;
					star.__dshAccSvg = html;
				}
			}
		}

		/**
		 * Find the live model row for a provider/model key.
		 *
		 * A key alone can be ambiguous: a provider may ship two models under one
		 * name (WorkBuddy Global has a paid and a free "Deepseek-V4.1-Flash"),
		 * and the rate chip that tells them apart is volatile, so it must not be
		 * part of the key. The model id the user starred when the surface tagged
		 * its rows settles which twin is meant. Without that hint an ambiguous
		 * key resolves to nothing rather than to an arbitrary row — picking the
		 * first would silently switch the user to the paid twin.
		 */
		function rowByKey(container, key) {
			const wanted = normalizeKey(key);
			const hint = favoriteIds()[wanted];
			const matches = [];
			for (const row of container.querySelectorAll(ROW_SELECTOR)) {
				if (row.closest("[data-dsh-acc-fav]") !== null) continue;
				if (keyOf(row) !== wanted) continue;
				if (hint !== undefined && modelIdOf(row) === hint) return row;
				matches.push(row);
			}
			if (matches.length === 1) return matches[0];
			/* No hint yet (a favorite starred before ids were recorded, or in the
			   /model popup, which does not tag rows). The row the session already
			   uses is the safest guess — the user starred what they were on. */
			for (const row of matches) {
				if (row.getAttribute("aria-checked") === "true" || row.getAttribute("aria-selected") === "true") return row;
			}
			return null;
		}

		/**
		 * The visible name of the model a row selects, without its rate chip.
		 *
		 * The model-label slot is a single slot: a connector plugin (WorkBuddy,
		 * Trae, Qoder) renders it as "<name><rate chip><promo chip><load icon>",
		 * and the host renders the bare name when no connector claims the slot.
		 * Only the name span is stable — the chips come and go with promotions and
		 * with the usage snapshot — so the name is the FIRST text-bearing span
		 * that is not marked as decoration, not the deepest one (that would be
		 * "新" or the rate, which is what made the key flip).
		 */
		function modelNameOf(row) {
			if (row === null) return null;
			const tagged = row.querySelector('[data-slot="conversation.input.model.label"]');
			const scope = tagged ?? row;
			let cell = null;
			for (const span of scope.querySelectorAll("span")) {
				if (span.children.length > 0) continue;
				if ((span.textContent || "").trim().length === 0) continue;
				const className = typeof span.className === "string" ? span.className : "";
				if (DECORATION_PART.test(className)) continue;
				cell = span;
				break;
			}
			const text = stripRate(((cell ?? scope).textContent || "").trim());
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
			if (!Array.isArray(stored)) return [];
			const keys = stored.filter((key) => typeof key === "string");
			const next = [];
			let changed = false;
			for (const key of keys) {
				const normal = normalizeKey(key);
				if (normal !== key) changed = true;
				if (next.indexOf(normal) !== -1) {
					changed = true;
					continue;
				}
				next.push(normal);
			}
			/* Keys stored by 0.5.0 and earlier embed the connector's rate chip
			   ("… · x0.00"), which the connector re-renders on every promotion
			   change. Rewriting them once on read keeps the store stable. */
			if (changed) writeJSON(K_FAVORITES, next);
			return next;
		}

		/**
		 * The starred model id per favorite key, when the surface that starred it
		 * tagged its rows. Only the composer menu tags rows with
		 * data-model-id, so the /model popup and older favorites have no entry.
		 */
		function favoriteIds() {
			const stored = readJSON(K_FAVORITE_IDS, null);
			if (stored === null || typeof stored !== "object" || Array.isArray(stored)) return {};
			const next = {};
			for (const key of Object.keys(stored)) {
				const id = stored[key];
				if (typeof id !== "string" || id.length === 0) continue;
				next[normalizeKey(key)] = id;
			}
			return next;
		}

		/** Remember which model id one favorite key stands for. */
		function setFavoriteId(key, id) {
			if (key === null || id === null) return;
			const normal = normalizeKey(key);
			const ids = favoriteIds();
			if (ids[normal] === id) return;
			ids[normal] = id;
			writeJSON(K_FAVORITE_IDS, ids);
		}

		/** Forget the model id of one favorite key. */
		function clearFavoriteId(key) {
			if (key === null) return;
			const normal = normalizeKey(key);
			const ids = favoriteIds();
			if (ids[normal] === undefined) return;
			delete ids[normal];
			writeJSON(K_FAVORITE_IDS, ids);
		}

		/** Add or remove one favorite key. */
		function toggleFavorite(container, key, row) {
			if (key === null) return;
			const normal = normalizeKey(key);
			const list = favorites();
			const index = list.indexOf(normal);
			const clicked = modelIdOf(row ?? null);
			const hint = favoriteIds()[normal];
			if (index === -1) {
				list.push(normal);
				/* Two models can share one name; the id is what tells them apart
				   when the user comes back to this favorite. */
				setFavoriteId(normal, clicked);
			} else if (hint !== undefined && clicked !== null && hint !== clicked) {
				/* The other twin of a duplicated name: move the favorite to the
				   row that was clicked instead of removing it, which is what the
				   user meant by clicking an empty star. */
				setFavoriteId(normal, clicked);
			} else {
				list.splice(index, 1);
				clearFavoriteId(normal);
			}
			writeJSON(K_FAVORITES, list);
			/* Starring proves the row exists, so it must leave the missing set at
			   once; unstarring must not leave a stale entry behind either. */
			if (missingKeys === null) missingKeys = loadMissingKeys();
			if (missingKeys.delete(normal)) saveMissingKeys(missingKeys);
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

		/* ------------------------------------------------------------- model refresh
		   Connector plugins expose a same-origin POST route at
		   /plugins/<id>/models/refresh that performs a LIVE upstream discovery of
		   that connector's model list. The built-in table below covers the
		   installed ones (WorkBuddy cn/global, Trae cn/ai); other plugins can add
		   their own target at runtime through registerRefreshTarget() or the
		   dsh-model-accordion:refresh-register event.

		   Two things a browser plugin MUST do beyond the POSTs:

		   1. Invalidate the composer's model-catalog cache. Simply closing and
		      reopening the menu does NOT re-fetch: ModelCatalogDirectory.load()
		      short-circuits while status === "ready". Only catalog.refresh()
		      (invalidate + load) re-issues session/modelCatalog(). That service
		      is reached best-effort through ctx.get("modelDirectories") — an
		      internal name, so every access is guarded.

		   2. Broadcast start/done CustomEvents so other plugins can react.

		   Honest limitation: a connector's /models/refresh route only RETURNS
		   the live roster and does not emit llm/adapters-updated. Trae (and
		   Qoder) now persist it to lastCatalog host-side, so their refreshed
		   list survives a restart; WorkBuddy's host-side catalog still changes
		   only after that connector commits a settings save, which a browser
		   plugin cannot force. This button does the browser-reachable maximum:
		   warm every connector's upstream data and
		   force the composer to re-read its catalog. */

		/** Shared feedback state; the MutationObserver redraws the toolbar, so the
		    label must not live only on the button element. */
		let refreshState = { status: "idle" };
		let refreshTimer = 0;
		const extraRefreshTargets = [];
		/** Assigned in apply(ctx); forcing the host catalog is best-effort. Returns
		    true only when it actually reached a catalog and called refresh(). */
		let refreshCatalog = () => false;

		/** Flat list of { label, url?, method?, headers?, run? } requests. */
		function refreshRequests() {
			const list = [];
			/** Built-in and registered URL targets share one shape. `regions` is
			    optional: a route without a region query is fetched once. */
			const add = (target) => {
				if (typeof target === "function") {
					list.push({ label: "custom", run: target });
					return;
				}
				if (typeof target === "string") {
					list.push({ label: target, url: target });
					return;
				}
				if (target === null || typeof target !== "object") return;
				const path = typeof target.path === "string" ? target.path : target.url;
				if (typeof path !== "string") return;
				const regions = Array.isArray(target.regions) && target.regions.length > 0 ? target.regions : [null];
				const baseLabel = target.label || path.split("/")[2] || path;
				for (const region of regions) {
					const url = region === null ? path : path + (path.indexOf("?") === -1 ? "?" : "&") + (target.regionParam || "region") + "=" + encodeURIComponent(region);
					list.push({
						label: region === null ? baseLabel : baseLabel + "/" + region,
						url: url,
						method: target.method,
						headers: target.headers
					});
				}
			};
			for (const target of REFRESH_TARGETS) add(target);
			for (const target of extraRefreshTargets) add(target);
			return list;
		}

		/** POST one target with a timeout; never throws. */
		async function runRefreshRequest(entry) {
			if (typeof entry.run === "function") {
				try {
					await entry.run();
					return { label: entry.label, ok: true, count: null, custom: true };
				} catch (error) {
					return { label: entry.label, ok: false, error: error instanceof Error ? error.message : String(error) };
				}
			}
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), 20000);
			try {
				const response = await fetch(entry.url, {
					method: entry.method || "POST",
					headers: Object.assign({ accept: "application/json" }, entry.headers || {}),
					credentials: "same-origin",
					signal: controller.signal
				});
				let body = null;
				try { body = await response.json(); } catch { /* a non-JSON answer is still a completed request */ }
				const count = body !== null && Array.isArray(body.models) ? body.models.length : null;
				/* On this host an uninstalled plugin's POST falls through to a
				   generic 404/405 with an empty body; that is a skip, not a
				   failure. A 405 can also mean a wrong method, but these routes
				   are POST-only and we always POST. */
				const missing = response.status === 404 || response.status === 405;
				return {
					label: entry.label,
					ok: response.ok && count !== null,
					skipped: !response.ok && missing,
					status: response.status,
					count: count,
					/* live roster：Trae / Qoder 会由宿主写回 lastCatalog，但浏览器
					   侧仍留一份，保证 settings 回灌前「刷新全部模型」立刻可见。 */
					models: body !== null && Array.isArray(body.models) ? body.models : null,
					error: response.ok ? null : (body !== null && (body.error || body.message)) || "HTTP " + response.status
				};
			} catch (error) {
				return { label: entry.label, ok: false, error: error instanceof Error ? error.message : String(error) };
			} finally {
				clearTimeout(timer);
			}
		}

		/** Paint every refresh button from the shared state (idempotent). */
		function paintRefreshButtons() {
			const status = refreshState.status;
			const text = status === "busy" ? "" : status === "done" ? "\u2713" : status === "failed" ? "!" : "\u21bb";
			const title = status === "busy" ? t().refreshBusy : status === "done" ? t().refreshDone : status === "failed" ? t().refreshFailed : t().refreshTitle;
			const detail = refreshState.detail;
			for (const button of document.querySelectorAll('[data-dsh-acc-action="refresh"]')) {
				if (button.textContent !== text) button.textContent = text;
				const fullTitle = detail === undefined || detail === "" ? title : title + " \u00b7 " + detail;
				if (button.getAttribute("title") !== fullTitle) button.setAttribute("title", fullTitle);
				if (button.getAttribute("aria-label") !== t().refresh) button.setAttribute("aria-label", t().refresh);
				const mark = status === "idle" ? null : status;
				if (mark === null) {
					if (button.hasAttribute("data-dsh-acc-refresh")) button.removeAttribute("data-dsh-acc-refresh");
				} else if (button.getAttribute("data-dsh-acc-refresh") !== mark) {
					button.setAttribute("data-dsh-acc-refresh", mark);
				}
			}
		}

		function setRefreshState(status, detail) {
			refreshState = { status, at: Date.now(), detail };
			if (refreshTimer !== 0) clearTimeout(refreshTimer);
			refreshTimer = 0;
			if (status !== "idle") {
				refreshTimer = setTimeout(() => {
					refreshTimer = 0;
					setRefreshState("idle");
				}, 3500);
			}
			paintRefreshButtons();
		}

		/**
		 * Register an extra refresh target (a URL string, a { path, regions?,
		 * method?, headers?, label?, regionParam? } object, or an async function).
		 * @returns a disposer that unregisters it again.
		 */
		function registerRefreshTarget(target) {
			if (target === null || target === undefined) return () => {};
			const kind = typeof target;
			if (kind !== "string" && kind !== "function" && kind !== "object") return () => {};
			extraRefreshTargets.push(target);
			return () => {
				const at = extraRefreshTargets.indexOf(target);
				if (at !== -1) extraRefreshTargets.splice(at, 1);
			};
		}

		/**
		 * One-click refresh: fan out to every connector, then force the composer's
		 * model catalog to re-read. Never throws and never blocks the menu.
		 */
		async function refreshModels() {
			if (refreshState.status === "busy") return { started: false };
			setRefreshState("busy");
			const requests = refreshRequests();
			document.dispatchEvent(new CustomEvent(REFRESH_START_EVENT, {
				detail: { targets: requests.map((entry) => entry.label) }
			}));
			const results = await Promise.all(requests.map(runRefreshRequest));
			let catalogRefresh = false;
			try {
				catalogRefresh = refreshCatalog() === true;
			} catch (error) {
				/* The service name is internal; a host upgrade may remove it. */
			}
			const succeeded = results.filter((result) => result.ok).length;
			const failed = results.filter((result) => !result.ok && !result.skipped).length;
			const summary = {
				started: true,
				ok: succeeded > 0,
				partial: failed > 0,
				succeeded: succeeded,
				skipped: results.length - succeeded - failed,
				failed: failed,
				total: results.length,
				models: results.reduce((n, result) => n + (typeof result.count === "number" ? result.count : 0), 0),
				catalogRefresh: catalogRefresh,
				results: results,
				/** `label`（如 `qoder/cn`）→ live models，供 Hub 面板覆盖旧目录。 */
				byTarget: Object.fromEntries(results.filter((r) => Array.isArray(r.models) && r.models.length > 0).map((r) => [r.label, r.models]))
			};
			const detail = succeeded + "/" + (results.length - summary.skipped) + " \u00b7 " + summary.models + " models" + (catalogRefresh ? " \u00b7 catalog" : "");
			setRefreshState(succeeded > 0 || (results.length === 0 && catalogRefresh) ? "done" : "failed", detail);
			document.dispatchEvent(new CustomEvent(REFRESH_DONE_EVENT, { detail: summary }));
			return summary;
		}

		/**
		 * The toolbar next to the search box: expand/collapse all, the sort cycle,
		 * and the one-click model refresh.
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
				const refresh = toolbarButton("dsh-acc-btn");
				refresh.setAttribute("data-dsh-acc-action", "refresh");
				refresh.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					refreshModels();
				});
				bar.appendChild(all);
				bar.appendChild(sort);
				bar.appendChild(refresh);
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
			/* The refresh button's label follows module-level state because the
			   MutationObserver redraws the toolbar on every childList mutation. */
			paintRefreshButtons();
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
			migrateFavorites(container);
			decorateStars(container);
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

		/* ---------------------------------------------------------------- root pane
		   The composer menu opens on a short pane ("模型" / "推理等级") before it
		   drills into the provider list. Favorites are mirrored into that pane as
		   ordinary menu cells, so the models used most are one click away instead
		   of two. The pane and the provider list share one React-owned surface, so
		   the injected cells are re-anchored on every pass and removed as soon as
		   the surface switches to the provider list. */

		/** Marker for the cells this plugin injects into the root pane. */
		const ROOT_ATTR = "data-dsh-acc-root";

		/**
		 * Favorite keys that a COMPLETE provider section proved to be gone: the
		 * provider rendered its rows, and the model was not among them. The root
		 * pane is drawn before any provider list exists, so this cache is what
		 * keeps a favorite whose provider dropped the model out of it.
		 *
		 * It is a negative cache on purpose. An earlier build remembered the
		 * positive set ("keys that resolved last time") and drew the pane from
		 * it, which made a favorite disappear whenever the remembered set had
		 * been rewritten without it — e.g. by a pass that saw only part of the
		 * catalog. Absence of evidence must never hide a favorite; only evidence
		 * of absence may.
		 */
		let missingKeys = null;

		/** Load the remembered missing-key set, if one was stored. */
		function loadMissingKeys() {
			const stored = readJSON(K_MISSING, null);
			if (!Array.isArray(stored)) return new Set();
			const set = new Set();
			for (const key of stored) if (typeof key === "string") set.add(normalizeKey(key));
			return set;
		}

		/** Remember which favorite keys a complete pass proved gone. */
		function saveMissingKeys(set) {
			writeJSON(K_MISSING, Array.from(set));
		}

		/** The menu surfaces currently showing a root pane. */
		function rootPanes() {
			const found = [];
			for (const node of document.querySelectorAll('[role="menu"]')) {
				if (node.id === "" || !/menu$/.test(node.id)) continue;
				if (node.querySelector(":scope > [data-menu-group]") !== null) continue;
				if (node.querySelector(':scope > button[role="menuitem"]') === null) continue;
				found.push(node);
			}
			return found;
		}

		/** The visible label of a root cell ("模型" / "推理等级"). */
		function cellLabelOf(cell) {
			const label = cell.querySelector(':scope > [class*="cellLabel"]');
			const text = label === null ? cell.textContent : label.textContent;
			return (text || "").trim();
		}

		/** The "模型" cell of a root pane, which drills into the provider list. */
		function modelCellOf(pane) {
			let first = null;
			for (const cell of pane.children) {
				if (!cell.matches('button[role="menuitem"]')) continue;
				if (cell.hasAttribute(ROOT_ATTR)) continue;
				if (first === null) first = cell;
				const text = cellLabelOf(cell).toLowerCase();
				if (text.indexOf("模型") !== -1 || text.indexOf("model") !== -1) return cell;
			}
			return first;
		}

		/** Split a favorite key into its provider label and model name. */
		function splitKey(key) {
			const slash = key.indexOf("/");
			if (slash === -1) return { provider: "", name: key };
			return { provider: key.slice(0, slash), name: key.slice(slash + 1) };
		}

		/**
		 * The class name a built-in root cell uses for one of its parts. The
		 * shell's class names are hashed and change between builds, so the name is
		 * copied from the live "模型" cell instead of hard-coded.
		 * @param model - a built-in root cell.
		 * @param part - "cellLabel", "cellValue" or "cellChevron".
		 */
		function partClass(model, part) {
			for (const child of model.children) {
				const name = typeof child.className === "string" ? child.className : "";
				if (name.indexOf(part) !== -1) return name;
			}
			return part;
		}

		/** Build one injected root cell for a favorite model. */
		function rootCell(key, model) {
			const parts = splitKey(key);
			const cell = document.createElement("button");
			cell.type = "button";
			cell.setAttribute("role", "menuitem");
			cell.setAttribute(ROOT_ATTR, "");
			cell.setAttribute(CLONE_ATTR, key);
			cell.setAttribute("tabindex", "0");
			cell.setAttribute("title", parts.provider + " / " + parts.name);
			cell.setAttribute("aria-label", parts.name);
			const label = document.createElement("span");
			label.className = partClass(model, "cellLabel");
			label.textContent = parts.name;
			const value = document.createElement("span");
			value.className = partClass(model, "cellValue");
			value.textContent = parts.provider;
			const star = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			star.setAttribute("viewBox", "0 0 16 16");
			star.setAttribute("width", "11");
			star.setAttribute("height", "11");
			star.setAttribute("aria-hidden", "true");
			star.setAttribute("class", partClass(model, "cellChevron"));
			const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
			path.setAttribute("d", "M8 2.2l1.72 3.48 3.84.56-2.78 2.71.66 3.83L8 11.02l-3.44 1.76.66-3.83L2.44 6.24l3.84-.56L8 2.2z");
			path.setAttribute("fill", "currentColor");
			path.setAttribute("stroke", "currentColor");
			path.setAttribute("stroke-width", "1.2");
			path.setAttribute("stroke-linejoin", "round");
			star.appendChild(path);
			cell.appendChild(label);
			cell.appendChild(value);
			cell.appendChild(star);
			return cell;
		}

		/** Copy the class list and inline style of a built-in cell onto ours. */
		function styleLike(cell, model) {
			cell.className = model.className;
			const style = model.getAttribute("style");
			if (style === null) cell.removeAttribute("style");
			else cell.setAttribute("style", style);
		}

		/** Render or refresh the injected favorite cells of one root pane. */
		function decorateRoot(pane) {
			const model = modelCellOf(pane);
			if (model === null) return;
			const all = favorites();
			const missing = missingKeys ?? loadMissingKeys();
			const keys = missing.size === 0 ? all : all.filter((key) => !missing.has(key));
			const signature = keys.join("\n");
			let cells = Array.from(pane.querySelectorAll(":scope > [" + ROOT_ATTR + "]"));
			if (keys.length === 0) {
				for (const cell of cells) cell.remove();
				pane.__dshAccRootSig = "";
				return;
			}
			if (pane.__dshAccRootSig !== signature || cells.length !== keys.length) {
				pane.__dshAccRootSig = signature;
				for (const cell of cells) cell.remove();
				cells = keys.map((key) => {
					const cell = rootCell(key, model);
					styleLike(cell, model);
					return cell;
				});
				for (const cell of cells) pane.appendChild(cell);
			}
			/* React owns the built-in cells, so the favorites are re-anchored in
			   front of the "模型" cell on every pass instead of trusting a single
			   insertion: the pane is re-rendered whenever the menu reopens. */
			/* Walk backwards so each move targets an anchor that is already in its
			   final place; forward moves would oscillate. */
			for (let index = cells.length - 1; index >= 0; index -= 1) {
				const cell = cells[index];
				const next = index === cells.length - 1 ? model : cells[index + 1];
				if (cell.nextElementSibling !== next) pane.insertBefore(cell, next);
			}
		}

		/** Remove every injected cell, so the provider list is never polluted. */
		function clearRoot() {
			for (const cell of document.querySelectorAll("[" + ROOT_ATTR + "]")) cell.remove();
			for (const pane of rootPanes()) pane.__dshAccRootSig = "";
		}

		/**
		 * Select a favorite from the root pane. The provider list is not mounted
		 * yet, so this drills into it first, then clicks the live row — the same
		 * path a manual two-step selection takes.
		 * @param key - the favorite key.
		 */
		function selectFromRoot(key) {
			const pane = rootPanes()[0];
			if (pane === undefined) return;
			const model = modelCellOf(pane);
			if (model === null) return;
			const options = { bubbles: true, cancelable: true, view: window, button: 0 };
			for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
				model.dispatchEvent(new PointerEvent(type, options));
			}
			let tries = 0;
			const step = () => {
				tries += 1;
				const container = document.querySelector('[id$="-models"]');
				const row = container === null ? null : rowByKey(container, key);
				if (row !== null) {
					for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
						row.dispatchEvent(new PointerEvent(type, options));
					}
					return;
				}
				if (tries > 120) {
					/* The model did not show up. Do not delete the favorite — a slow
					   provider could still be loading — just close the menu. */
					const open = document.querySelector('[aria-label="模型与推理等级"]');
					if (open !== null) {
						open.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
					}
					return;
				}
				window.setTimeout(step, 25);
			};
			window.setTimeout(step, 25);
		}

		/**
		 * Wire one root pane once.
		 * @returns a disposer.
		 */
		function attachRoot(pane) {
			if (typeof pane.__dshAccRootOff === "function") return pane.__dshAccRootOff;
			const onClick = (event) => {
				const target = event.target instanceof Element ? event.target : null;
				if (target === null) return;
				const cell = target.closest("[" + ROOT_ATTR + "]");
				if (cell === null) return;
				event.preventDefault();
				event.stopPropagation();
				const key = cell.getAttribute(CLONE_ATTR);
				if (key !== null) selectFromRoot(key);
			};
			const onKeyDown = (event) => {
				const target = event.target instanceof Element ? event.target : null;
				if (target === null) return;
				const cell = target.closest("[" + ROOT_ATTR + "]");
				if (cell === null) return;
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					event.stopPropagation();
					const key = cell.getAttribute(CLONE_ATTR);
					if (key !== null) selectFromRoot(key);
					return;
				}
				/* Arrow keys walk the whole root pane, injected cells included: the
				   shell only knows its own React-owned cells. */
				if (event.key === "ArrowDown" || event.key === "ArrowUp") {
					const cells = Array.from(pane.querySelectorAll(':scope > button[role="menuitem"]'));
					const index = cells.indexOf(cell);
					if (index === -1) return;
					const next = cells[index + (event.key === "ArrowDown" ? 1 : -1)];
					if (next === undefined) return;
					event.preventDefault();
					event.stopPropagation();
					next.focus();
				}
			};
			pane.addEventListener("click", onClick, true);
			pane.addEventListener("keydown", onKeyDown, true);
			const off = () => {
				pane.removeEventListener("click", onClick, true);
				pane.removeEventListener("keydown", onKeyDown, true);
				pane.__dshAccRootOff = undefined;
			};
			pane.__dshAccRootOff = off;
			return off;
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
				/* The favorite star sits inside a row, so it must win over both the
				   row's own click (which would select the model) and the clone
				   forwarding below. */
				const star = target.closest("[" + STAR_ATTR + "]");
				if (star !== null) {
					event.preventDefault();
					event.stopPropagation();
					const host = star.parentElement;
					const cloned = host === null ? null : host.getAttribute(CLONE_ATTR);
					toggleFavorite(container, cloned !== null ? cloned : keyOf(host), host);
					return;
				}
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
					} else if (action === "refresh") {
						refreshModels();
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
					toggleFavorite(container, keyOf(row), row);
				}
			};
			const onContextMenu = (event) => {
				const target = event.target instanceof Element ? event.target : null;
				if (target === null) return;
				const row = target.closest(ROW_SELECTOR);
				if (row === null || row.closest("[" + CLONE_ATTR + "]") !== null) return;
				event.preventDefault();
				event.stopPropagation();
				toggleFavorite(container, keyOf(row), row);
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
		/* ------------------------------------------------------------ connector hub
		   A single settings page that gathers the four installed connector plugins
		   behind one set of tabs. The connectors themselves are NOT bundled here:
		   they keep their own host adapters, login state and cordis.patch.yml
		   rows. This page only probes their read-only status endpoints, refreshes
		   their model lists, links to their native settings pages, and exposes
		   the accordion's own options. */

		const HUB_NS = "settings.model-accordion";
		const HUB_MESSAGES = {
			zh: {
				title: "模型连接器中心",
				description: "在一处集中查看四个连接器的账号信息、模型列表与状态，配置账号、刷新与测试模型，并管理模型菜单手风琴选项。",
				sub: "四个连接器的宿主与登录代码已内置于本插件；即使卸载原独立插件，模型与登录态照常可用。此处集中查看状态、刷新模型，并跳转到各连接器的完整配置页。",
				probe: "重新探测", probing: "探测中…", probeOne: "探测",
				refreshAll: "刷新全部模型", refreshAllBtn: "刷新", refreshing: "刷新中…", refreshOne: "刷新模型",
				openNative: "打开连接器设置", openNativeFail: "未找到该连接器设置入口，请先在「插件」页打开「模型连接器中心」或对应连接器。",
				noProbe: "尚未探测", regions: "区域", providers: "提供方",
				tabOverview: "总览", tabWorkbuddy: "WorkBuddy", tabTrae: "Trae",
				tabQoder: "Qoder", tabOpencode: "OpenCode", tabAccordion: "手风琴选项",
				notInstalled: "未安装 / 不可用", enabled: "已启用", disabled: "未启用",
				signedIn: "已登录", signedOut: "未登录", accounts: "账号", reachable: "可访问", poolSize: "IP 池",
				statusOk: "正常", statusError: "异常", statusProbing: "探测中", statusUnknown: "未知",
				statConnectors: "连接器", statFavorites: "收藏模型", statSort: "排序",
				nativeNote: "点击「打开连接器设置」进入各连接器自带的完整配置页（账号、积分、能力、诊断等）；这些页面由本插件内置的连接器提供。",
				overviewNote: "下面是四个内置连接器的实时状态。状态探测走各插件的只读 /usage 接口，参数缺失或不可达会显示「未知」。",
				sortLabel: "模型排序", sortDesc: "点击切换：默认 → 名称 → 数量",
				sortDefault: "默认顺序", sortName: "按名称", sortSize: "按数量",
				stableLabel: "稳定菜单高度", stableDesc: "模型较多时固定弹层高度，避免闪动",
				favoritesLabel: "收藏模型", favoritesDesc: "当前收藏数量", clearFavorites: "清空收藏",
				autoProbeLabel: "自动探测状态", autoProbeDesc: "打开此页时自动刷新连接器状态",
				refreshAllLabel: "刷新全部模型", refreshAllDesc: "从所有连接器重新拉取模型并刷新目录",
				refreshed: "已刷新", refreshFailed: "刷新失败",
				accordionNote: "这些选项与模型菜单工具栏中的按钮一致，改动会立即生效。",
				accountInfo: "账号信息", currentAccount: "当前账号", credits: "积分", creditTotal: "积分总额",
				used: "已用", available: "可用", modelsCount: "模型数", expires: "凭据到期", unknownValue: "—",
				accountsList: "账号列表", noAccounts: "暂无账号", selected: "当前",
				checkin: "签到", checkedIn: "今日已签到", notCheckedIn: "今日未签到", poolInfo: "资源池",
				modelList: "模型列表", modelSearch: "搜索模型（id 或名称）…", noModels: "暂无模型数据，点击「刷新模型」或「刷新账号信息」获取。",
				context: "上下文", modelEnabled: "已启用", modelNew: "新增", modelOff: "已关闭",
				reasoning: "推理", images: "图片", testModel: "测试", testing: "测试中…",
				testOk: "可用", testFail: "不可用", testWarn: "测试模型会向上游发起一次真实调用并消耗少量额度。",
				refreshAccount: "刷新账号信息", accountConfig: "账号配置", addAccount: "添加账号",
				oauthLogin: "登录 / 添加账号", oauthHint: "点击后在浏览器完成登录，此页会自动更新状态（最长等待 5 分钟）。", oauthUri: "登录链接",
				patLabel: "Qoder PAT", patPlaceholder: "粘贴 Personal Access Token", nameLabel: "备注名（可选）",
				removeAccount: "移除", switchAccount: "切换账号",
				localLogin: "Qoder 本地登录", pullLocalLogin: "拉取当前本地登录",
				localLoginHint: "直接读取 Qoder 桌面客户端此刻的登录态（无需 PAT），记入账号池后即可在下拉里切换。切换前请先到客户端登录目标账号，再回来点「拉取」。",
				localLoginActive: "客户端当前登录", localLoginRecorded: "已记录", localLoginInactive: "非当前登录（需在客户端切换）",
				localLoginPullOk: "已拉取并记入账号池", localLoginPullFail: "未读到登录态", localLoginRemoved: "记录已删除",
				qoderAccountHint: "Qoder 账号可来自 PAT，也可直接来自桌面客户端登录态；本地登录账号与 PAT 账号在同一下拉里切换。",
				traeAccountHint: "Trae 账号取自桌面客户端的登录态（~/.dsh/.trae-auth*）。更换账号请在 Trae 客户端重新登录后点「刷新账号信息」，或使用原生设置页的凭据导入。",
				traeLocalAccounts: "Trae 本地账号库", traeSyncLocal: "同步本地账号", traeSwitchLocal: "切换",
				traeLocalHint: "读取本机已保存的 Trae 登录快照（TraeDaddy 账号库），可在这里直接切换账号，无需重新登录客户端。",
				traeLocalActive: "客户端当前登录", traeLocalSynced: "本地账号已同步", traeLocalSwitched: "已切换账号",
				traeLocalSwitchedTo: "已切换到",
				refreshPartial: "部分区域刷新失败",
				opencodeHint: "OpenCode 通过 IP 池桥接，账号由 opencode.ai 提供；这里可以查看池状态、模型列表并探测出口。",
				refreshPool: "刷新状态", probePool: "探测全部出口", accountAddOk: "账号已添加", accountRemoved: "账号已移除",
				opFailed: "操作失败", saved: "已保存", regionLabel: "区域", modelsRefreshed: "模型列表已更新",
				poolState: "池状态", poolTotal: "出口数", poolEnabled: "已启用", poolDisabled: "未启用",
				reactMissing: "设置界面需要 React 运行时（当前不可用）。"
			},
			en: {
				title: "Model Connector Hub",
				description: "Account info, model lists, account setup, model refresh and model testing for all four connectors in one place, plus the accordion options.",
				sub: "The four connector hosts and their login code are bundled into this plugin; models and sign-in keep working even after the original standalone plugins are uninstalled. This page shows status, refreshes models and links to each connector's full settings.",
				probe: "Re-probe", probing: "Probing…", probeOne: "Probe",
				refreshAll: "Refresh all models", refreshAllBtn: "Refresh", refreshing: "Refreshing…", refreshOne: "Refresh models",
				openNative: "Open connector settings", openNativeFail: "Connector settings entry not found; open the Model Connector Hub or the connector from the Plugins page first.",
				noProbe: "Not probed yet", regions: "Regions", providers: "Providers",
				tabOverview: "Overview", tabWorkbuddy: "WorkBuddy", tabTrae: "Trae",
				tabQoder: "Qoder", tabOpencode: "OpenCode", tabAccordion: "Accordion",
				notInstalled: "Not installed / unavailable", enabled: "Enabled", disabled: "Disabled",
				signedIn: "Signed in", signedOut: "Signed out", accounts: "Accounts", reachable: "Reachable", poolSize: "IP pool",
				statusOk: "OK", statusError: "Error", statusProbing: "Probing", statusUnknown: "Unknown",
				statConnectors: "Connectors", statFavorites: "Favorites", statSort: "Sort",
				nativeNote: "Use \"Open connector settings\" for each connector's full configuration (accounts, credits, capabilities, diagnostics); those pages are served by the connectors bundled in this plugin.",
				overviewNote: "Live status of the four bundled connectors. Probing uses each plugin's read-only /usage endpoint; a missing parameter or an unreachable endpoint shows \"Unknown\".",
				sortLabel: "Model sort", sortDesc: "Click to cycle: default → name → size",
				sortDefault: "Default order", sortName: "By name", sortSize: "By size",
				stableLabel: "Stable menu height", stableDesc: "Fix the popup height when a provider has many models",
				favoritesLabel: "Favorite models", favoritesDesc: "Current count", clearFavorites: "Clear favorites",
				autoProbeLabel: "Auto-probe status", autoProbeDesc: "Refresh connector status when this page opens",
				refreshAllLabel: "Refresh all models", refreshAllDesc: "Re-fetch models from every connector and refresh the catalog",
				refreshed: "Refreshed", refreshFailed: "Refresh failed",
				accordionNote: "These mirror the model-menu toolbar buttons and take effect immediately.",
				accountInfo: "Account info", currentAccount: "Current account", credits: "Credits", creditTotal: "Total credits",
				used: "Used", available: "Available", modelsCount: "Models", expires: "Token expires", unknownValue: "—",
				accountsList: "Accounts", noAccounts: "No accounts", selected: "Current",
				checkin: "Check-in", checkedIn: "Checked in today", notCheckedIn: "Not checked in today", poolInfo: "Pool",
				modelList: "Model list", modelSearch: "Search models (id or name)…", noModels: "No models yet — use \"Refresh models\" or \"Refresh account info\".",
				context: "Context", modelEnabled: "Enabled", modelNew: "New", modelOff: "Off",
				reasoning: "Reasoning", images: "Images", testModel: "Test", testing: "Testing…",
				testOk: "Available", testFail: "Unavailable", testWarn: "Testing a model makes one real upstream call and costs a small amount of quota.",
				refreshAccount: "Refresh account info", accountConfig: "Account configuration", addAccount: "Add account",
				oauthLogin: "Sign in / add account", oauthHint: "Complete the sign-in in your browser; this page updates automatically (up to 5 minutes).", oauthUri: "Sign-in URL",
				patLabel: "Qoder PAT", patPlaceholder: "Paste Personal Access Token", nameLabel: "Display name (optional)",
				removeAccount: "Remove", switchAccount: "Switch account",
				localLogin: "Qoder local login", pullLocalLogin: "Pull current local login",
				localLoginHint: "Reads the Qoder desktop client's live sign-in (no PAT needed), records it into the account pool, and lets you switch to it from the dropdown. Sign in to the target account in the client first, then click \"Pull\" here.",
				localLoginActive: "Client's current login", localLoginRecorded: "Recorded", localLoginInactive: "Not the current login (switch in the client)",
				localLoginPullOk: "Pulled and added to the account pool", localLoginPullFail: "No local login found", localLoginRemoved: "Record removed",
				qoderAccountHint: "Qoder accounts can come from a PAT or directly from the desktop client's local sign-in; both appear in the same account dropdown.",
				traeAccountHint: "Trae accounts come from the desktop client's saved login state (~/.dsh/.trae-auth*). To change accounts, sign in again in the Trae client and click \"Refresh account info\", or import credentials in its native settings.",
				traeLocalAccounts: "Trae local accounts", traeSyncLocal: "Sync local accounts", traeSwitchLocal: "Switch",
				traeLocalHint: "Reads the login snapshots already saved on this machine (TraeDaddy account library) and lets you switch accounts here without signing in again.",
				traeLocalActive: "Client's current login", traeLocalSynced: "Local accounts synced", traeLocalSwitched: "Account switched",
				traeLocalSwitchedTo: "Switched to",
				refreshPartial: "Some regions failed to refresh",
				opencodeHint: "OpenCode bridges through an IP pool; accounts are provided by opencode.ai. View pool status, models and probe exits here.",
				refreshPool: "Refresh status", probePool: "Probe all exits", accountAddOk: "Account added", accountRemoved: "Account removed",
				opFailed: "Operation failed", saved: "Saved", regionLabel: "Region", modelsRefreshed: "Model list updated",
				poolState: "Pool state", poolTotal: "Exits", poolEnabled: "Enabled", poolDisabled: "Disabled",
				reactMissing: "The settings page needs the React runtime (currently unavailable)."
			}
		};

		/** Translate a hub string for the current page language. */
		function hubText() {
			const lang = String(document.documentElement.lang || navigator.language || "en").toLowerCase();
			const dict = lang.indexOf("zh") === 0 ? HUB_MESSAGES.zh : HUB_MESSAGES.en;
			return (key) => Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
		}

		/** Metadata for the connectors that are installed independently. */
				const CONNECTORS = [
					{
						id: "workbuddy", pkg: "dsh-connect-workbuddy", name: "WorkBuddy", version: "5.17.0",
						providers: ["workbuddy", "workbuddy-global"], regions: ["cn", "global"],
						usage: "/plugins/dsh-connect-workbuddy/usage",
						refresh: "/plugins/dsh-connect-workbuddy/models/refresh",
						credits: "/plugins/dsh-connect-workbuddy/account-credits",
						accountsRefresh: "/plugins/dsh-connect-workbuddy/accounts/refresh",
						probe: "/plugins/dsh-connect-workbuddy/probe",
						oauth: "/plugins/dsh-connect-workbuddy/oauth",
						save: "/plugins/dsh-connect-workbuddy/__save"
					},
					{
						id: "trae", pkg: "dsh-connect-trae", name: "Trae", version: "4.6.12",
						providers: ["trae", "trae-enterprise", "trae-global"], regions: ["cn", "ai"],
						usage: "/plugins/dsh-connect-trae/usage",
						refresh: "/plugins/dsh-connect-trae/models/refresh",
						credits: "/plugins/dsh-connect-trae/account-credits",
						accountsRefresh: "/plugins/dsh-connect-trae/accounts/refresh",
						localAccounts: "/plugins/dsh-connect-trae/local-accounts",
						test: "/plugins/dsh-connect-trae/models/test"
					},
					{
						id: "qoder", pkg: "@dmh2002/dsh-connect-qoder", name: "Qoder", version: "1.16.4",
						providers: ["qoder", "qoder-global"], regions: ["cn", "global"],
						usage: "/plugins/dsh-connect-qoder/usage",
						refresh: "/plugins/dsh-connect-qoder/models/refresh",
						credits: "/plugins/dsh-connect-qoder/account-credits",
						accountsRefresh: "/plugins/dsh-connect-qoder/accounts/refresh",
						accounts: "/plugins/dsh-connect-qoder/accounts",
						save: "/plugins/dsh-connect-qoder/__save",
						localLogin: "/plugins/dsh-connect-qoder/local-login",
						probe: "/plugins/dsh-connect-qoder/probe"
					},
					{
						id: "opencode", pkg: "@opencode2dsh/dsh-plugin", name: "OpenCode", version: "0.3.14",
						providers: ["opencode", "delegate"], regions: [],
						bridge: "/api/opencode2dsh/ip-pool/status",
						bridgeModels: "/api/opencode2dsh/ip-pool/models",
						bridgeProbe: "/api/opencode2dsh/ip-pool/probe"
					}
				];

		const HUB_TABS = [
			{ id: "overview", key: "tabOverview" },
			{ id: "workbuddy", key: "tabWorkbuddy" },
			{ id: "trae", key: "tabTrae" },
			{ id: "qoder", key: "tabQoder" },
			{ id: "opencode", key: "tabOpencode" },
			{ id: "accordion", key: "tabAccordion" }
		];

		/** Re-run the accordion's full sweep after a hub-side option change. */
		let hubRescan = () => {};

		/** Read the accordion options that the hub exposes. */
		function readAccordionState() {
			const mode = sortMode();
			return {
				sort: mode,
				sortLabel: mode === "name" ? hubText()("sortName") : mode === "size" ? hubText()("sortSize") : hubText()("sortDefault"),
				stable: readJSON(K_STABLE_HEIGHT, true) !== false,
				favorites: favorites().length
			};
		}

		/** Re-decorate every open model list (and root panes) in place. */
		function redecorateAll() {
			try { for (const container of modelLists()) decorate(container); } catch (error) {}
			try { hubRescan(); } catch (error) {}
		}

		/** Turn a connector's status payload into a short human-readable line. */
		function hubSummarize(conn, body) {
			const H = hubText();
			const parts = [];
			if (conn.bridge) {
				const value = body && body.value ? body.value : {};
				/* The current OpenCode bridge returns a flat value; older shapes nested
				it under `snapshot`. Accept both. */
				const snap = value.snapshot || value;
				const enabled = value.enabled === true;
				parts.push(enabled ? H("enabled") : H("disabled"));
				if (typeof snap.total === "number") parts.push(H("poolSize") + ": " + snap.total);
				if (snap.state) parts.push(String(snap.state));
				if (value.deferredReason) parts.push(String(value.deferredReason));
				return { state: enabled ? "ok" : "unknown", detail: parts.join(" · "), at: Date.now() };
			}
			const status = body && body.status ? String(body.status) : "";
			if (status === "signed-in") parts.push(H("signedIn"));
			else if (status === "signed-out") parts.push(H("signedOut"));
			else if (status) parts.push(status);
			if (body && body.accountName) parts.push(String(body.accountName));
			if (body && body.credits && typeof body.credits.total === "number") parts.push(H("credits") + ": " + body.credits.total);
			if (body && Array.isArray(body.accounts)) parts.push(H("accounts") + ": " + body.accounts.length);
			if (body && body.message) parts.push(String(body.message));
			if (parts.length === 0) parts.push(H("reachable"));
			return {
				state: status === "signed-in" ? "ok" : status === "signed-out" ? "unknown" : "ok",
				detail: parts.join(" · "), at: Date.now()
			};
		}

		/** Format a millisecond timestamp for the account card. */
		function hubDate(ms) {
			if (typeof ms !== "number" || ms <= 0) return "";
			try { return new Date(ms).toLocaleString(); } catch (error) { return String(ms); }
		}

		/**
		* Normalize a connector's /usage payload (plus /account-credits) into one small,
		* stable view model. This mirrors daddy-suite's mapUsage / toPanelData idea: the
		* cards never need to know which connector flavour they are rendering.
		*/
		function hubUsageView(conn, st) {
			const b = st && st.body && typeof st.body === "object" ? st.body : {};
			const val = conn.bridge ? (b.value && typeof b.value === "object" ? b.value : {}) : b;
			const accounts = Array.isArray(b.accounts) ? b.accounts : [];
			const creditRows = st && st.creditsBody && Array.isArray(st.creditsBody.accounts) ? st.creditsBody.accounts : [];
			const creditById = {};
			for (const row of creditRows) {
				if (row && typeof row === "object" && typeof row.id === "string") creditById[row.id] = row;
			}
			const viewAccounts = accounts.map((a) => {
				const extra = creditById[a.id] || {};
				const credit = typeof extra.credits === "number" ? extra.credits
					: typeof extra.generalAvailable === "number" ? extra.generalAvailable
					: typeof extra.remain === "number" ? extra.remain : null;
				return {
					id: String(a.id || ""),
					name: String(a.accountName || a.name || a.displayDesc || a.id || ""),
					selected: a.selected === true,
					domain: String(a.domain || ""),
					edition: String(a.edition || ""),
					source: String(a.source || ""),
					credit: credit,
					expiresAtMs: a.tokenExpiresAtMs || a.refreshExpiresAtMs || 0
				};
			});
			const cr = b.credits && typeof b.credits === "object" ? b.credits : null;
			let models = Array.isArray(b.models) ? b.models
				: (b.pool && Array.isArray(b.pool.catalog)) ? b.pool.catalog
				: Array.isArray(val.catalog) ? val.catalog : [];
			if (conn.bridge && st && Array.isArray(st.extraModels)) models = st.extraModels;
			return {
				bridge: !!conn.bridge,
				status: String(b.status || ""), message: String(b.message || ""),
				accountName: String(b.accountName || ""), accountId: String(b.accountId || ""),
				domain: String(b.domain || ""), source: String(b.source || ""),
				region: String((st && st.region) || b.region || ""),
				expiresAtMs: b.tokenExpiresAtMs || b.refreshExpiresAtMs || 0,
				credits: cr ? {
					total: typeof cr.total === "number" ? cr.total : null,
					used: typeof cr.consumed === "number" ? cr.consumed : null,
					available: typeof cr.available === "number" ? cr.available : null,
					packages: Array.isArray(cr.packages) ? cr.packages : Array.isArray(cr.accounts) ? cr.accounts : []
				} : null,
				checkin: b.checkin && typeof b.checkin === "object" ? b.checkin : null,
				pool: conn.bridge ? val : (b.pool && typeof b.pool === "object" ? b.pool : null),
				accounts: viewAccounts,
				models: models.map((m) => ({
					/* Qoder 的 /usage 模型条目用 `key`（settings 目录就是这种形状），
					   Trae / WorkBuddy 用 `id`。只认 `id` 会把 Qoder 整份模型表
					   过滤成空 —— 这是「Qoder 模型列表刷新后仍是 0」的根因。 */
					id: String(m.id || m.key || ""), name: String(m.name || m.displayName || m.id || m.key || ""),
					contextWindow: m.contextWindow || m.maxContextWindow || m.nativeContextWindow || null,
					creditMultiplier: typeof m.creditMultiplier === "number" ? m.creditMultiplier : null,
					supportsImages: m.supportsImages === true || m.multimodal === true || (Array.isArray(m.input) && m.input.indexOf("image") !== -1),
					reasoning: !!(m.reasoning || m.reasoningSupported || m.supportsThinking), verified: m.verified === true
				})).filter((m) => m.id !== ""),
				enabledModelIds: Array.isArray(b.enabledModelIds) ? b.enabledModelIds.map(String) : [],
				newModelIds: Array.isArray(b.newModelIds) ? b.newModelIds.map(String) : [],
				offModelIds: Array.isArray(b.offModelIds) ? b.offModelIds.map(String) : []
			};
		}

		/** Fetch + parse JSON with same-origin credentials. Never throws. */
		async function hubJson(url, options) {
			const opts = Object.assign({ credentials: "same-origin" }, options || {});
			let timer = 0;
			if (typeof opts.timeoutMs === "number" && opts.signal === undefined && typeof AbortController === "function") {
				const controller = new AbortController();
				opts.signal = controller.signal;
				timer = setTimeout(() => controller.abort(), opts.timeoutMs);
			}
			delete opts.timeoutMs;
			try {
				const response = await fetch(url, opts);
				let body = null;
				try { body = await response.json(); } catch (error) {}
				return { ok: response.ok, status: response.status, body: body };
			} catch (error) {
				return { ok: false, status: 0, body: null, error: error instanceof Error ? error.message : String(error) };
			} finally {
				if (timer) clearTimeout(timer);
			}
		}

		/** Probe one connector's status, account credits and (bridge) model list. */
		async function probeConnector(conn, region) {
			const H = hubText();
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), 8000);
			try {
				let response, body = null, creditsBody = null, extraModels = null;
				if (conn.bridge) {
					response = await fetch(conn.bridge, {
						method: "POST", credentials: "same-origin", signal: controller.signal,
						headers: { "content-type": "application/json", accept: "application/json" }, body: "{}"
					});
					try { body = await response.json(); } catch (error) {}
					if (conn.bridgeModels) {
						const mr = await hubJson(conn.bridgeModels, {
							method: "POST", signal: controller.signal,
							headers: { "content-type": "application/json", accept: "application/json" }, body: "{}"
						});
						if (mr.ok && mr.body && mr.body.value && Array.isArray(mr.body.value.models)) extraModels = mr.body.value.models;
					}
				} else {
					const reg = region || conn.regions[0] || "cn";
					response = await fetch(conn.usage + "?region=" + encodeURIComponent(reg), {
						method: "GET", credentials: "same-origin", signal: controller.signal,
						headers: { accept: "application/json" }
					});
					try { body = await response.json(); } catch (error) {}
					if (conn.credits) {
						const cr = await hubJson(conn.credits + "?region=" + encodeURIComponent(reg), {
							method: "GET", signal: controller.signal, headers: { accept: "application/json" }
						});
						if (cr.ok) creditsBody = cr.body;
					}
				}
				const unknown = response.status === 400 || response.status === 404 || response.status === 405;
				if (!response.ok || unknown) {
					return { state: "unknown", detail: H("notInstalled") + " · HTTP " + response.status, at: Date.now(), region: region || "" };
				}
				const summary = hubSummarize(conn, body);
				summary.body = body;
				summary.creditsBody = creditsBody;
				summary.region = region || (conn.regions[0] || "");
				summary.extraModels = extraModels;
				return summary;
			} catch (error) {
				return { state: "error", detail: error instanceof Error ? error.message : String(error), at: Date.now(), region: region || "" };
			} finally {
				clearTimeout(timer);
			}
		}

		/** Run one real upstream call against a single model and normalize the result. */
		async function hubTestModel(conn, region, modelId) {
			const reg = region || conn.regions[0] || "cn";
			let result;
			if (conn.test) {
				result = await hubJson(conn.test + "?region=" + encodeURIComponent(reg), {
					method: "POST", timeoutMs: 30000,
					headers: { accept: "application/json", "content-type": "application/json" },
					body: JSON.stringify({ ids: [modelId] })
				});
			} else if (conn.probe && conn.id === "qoder") {
				result = await hubJson(conn.probe + "?region=" + encodeURIComponent(reg) + "&model=" + encodeURIComponent(modelId), {
					method: "GET", timeoutMs: 30000, headers: { accept: "application/json" }
				});
			} else if (conn.probe) {
				result = await hubJson(conn.probe + "?region=" + encodeURIComponent(reg), {
					method: "POST", timeoutMs: 30000,
					headers: { accept: "application/json", "content-type": "application/json" },
					body: JSON.stringify({ modelIds: [modelId] })
				});
			} else {
				return { ok: false, label: "unsupported" };
			}
			if (!result.ok) return { ok: false, label: "HTTP " + result.status, detail: (result.body && result.body.error) || result.error || "" };
			const raw = result.body;
			const row = raw && Array.isArray(raw.results) ? raw.results[0] : raw;
			if (!row || typeof row !== "object") return { ok: false, label: "empty" };
			const label = String(row.verdict || row.outcome || "");
			const ok = label === "available" || label === "ok" || label === "queued";
			const detail = [row.detail || row.message || "", typeof row.elapsedMs === "number" ? row.elapsedMs + "ms" : ""].filter(Boolean).join(" · ");
			return { ok: ok, label: label || "done", detail: detail };
		}
		/** Best-effort deep link into a connector's native settings detail page. */
		function openNative(pkg, onFail) {
			const open = () => {
				const row = document.querySelector('[data-plugin-package="' + pkg + '"]');
				if (row === null) return false;
				const button = row.querySelector('button[aria-label^="查看"], button[aria-label^="View"]');
				if (button === null) return false;
				button.click();
				return true;
			};
			if (open()) return;
			/* The plugins page may not be open yet: click the sidebar entry, then
			   poll briefly for the package row. A quoted attribute value keeps the
			   @scope/name package id safe inside the selector. */
			try {
				const buttons = Array.from(document.querySelectorAll("button"));
				const sidebar = buttons.find((button) => {
					const text = (button.textContent || "").trim();
					const label = button.getAttribute("aria-label") || "";
					return text === "插件" || label.indexOf("插件") !== -1 || text === "Plugins";
				});
				if (sidebar) sidebar.click();
			} catch (error) {}
			let tries = 0;
			const poll = () => {
				if (open()) return;
				if (++tries < 40) setTimeout(poll, 120);
				else if (typeof onFail === "function") onFail();
			};
			setTimeout(poll, 150);
		}

		/** The slot component registered for plugins.item / row.config / bundle.config. */
		function HubCard(props) {
			const H = hubText();
			const view = props && props.view;
			if (view === "summary") return H("description");
			if (React === null || typeof React.useState !== "function") return H("reactMissing");
			return React.createElement(HubPanel, {});
		}

		function HubPanel() {
			const H = hubText();
			const h = React.createElement;
			const [tab, setTab] = React.useState(() => {
				const prefs = readJSON(K_HUB, {});
				return typeof prefs.tab === "string" ? prefs.tab : "overview";
			});
			const [autoProbe, setAutoProbe] = React.useState(() => readJSON(K_HUB, {}).autoProbe !== false);
			const [status, setStatus] = React.useState({});
			/**
			* 「刷新模型」按钮拉回来的实时模型目录，按 `connId|region` 缓存。
			*
			* Qoder / Trae 的 `/models/refresh` 只把 live roster 返回到 settings
			* draft，**不会**写回 `/usage` 的展示目录（host 也不重发
			* `llm/adapters-updated`）。所以刷新后重新 probe `/usage` 看到的仍是
			* 旧的少量模型，用户会觉得「刷新没反应」。这里把 POST 返回的模型留在
			* 前端，modelsCard 优先用它。
			*
			* 值是 `{ accountId, models }` 而不是裸数组：切换账号 / 区域后
			* `/usage` 的 `accountId` 会变，缓存必须跟着失效，否则用户会一直看到
			* **上一个账号**的模型列表（「刷新不对」最常见的成因）。刷新失败时
			* 也要清掉对应缓存，不能拿旧结果冒充本次刷新成功。
			*/
			const [refreshedModels, setRefreshedModels] = React.useState({});
			/**
			* 最新 status 的镜像。异步回调（`probeSingle(...).then(() => refreshSingle(...))`）
			* 里闭包捕获的 `status` 是定义那一刻的旧值，切账号后刚 probe 回来的
			* accountId 还没进 state；用 ref 才能给 live roster 打上**新账号**的标记。
			*/
			const statusRef = React.useRef({});
			statusRef.current = status;
			/** Trae 本机账号库（TraeDaddy 登录快照），按区域缓存。 */
			const [traeLocals, setTraeLocals] = React.useState({});
			const [probing, setProbing] = React.useState(false);
			const [refreshing, setRefreshing] = React.useState(false);
			const [refreshNote, setRefreshNote] = React.useState("");
			const [acc, setAcc] = React.useState(() => readAccordionState());
			const [regions, setRegions] = React.useState({});
			const [testResults, setTestResults] = React.useState({});
			const [testing, setTesting] = React.useState({});
			const [modelQuery, setModelQuery] = React.useState("");
			const [patInput, setPatInput] = React.useState("");
			const [nameInput, setNameInput] = React.useState("");
			const [oauth, setOauth] = React.useState({});
			const [busy, setBusy] = React.useState("");
			const [actionNote, setActionNote] = React.useState("");

			const regionFor = (conn) => regions[conn.id] || conn.regions[0] || "";

			const runProbe = () => {
				setProbing(true);
				setStatus((prev) => {
					const next = Object.assign({}, prev);
					for (const conn of CONNECTORS) next[conn.id] = { state: "probing" };
					return next;
				});
				Promise.all(CONNECTORS.map((conn) => probeConnector(conn, regions[conn.id]).then((result) => ({ id: conn.id, result }))))
					.then((items) => {
						setStatus((prev) => {
							const next = Object.assign({}, prev);
							for (const item of items) next[item.id] = item.result;
							statusRef.current = next;
							return next;
						});
					})
					.finally(() => setProbing(false));
			};

			React.useEffect(() => { if (autoProbe) runProbe(); }, [autoProbe]);
			/* 打开 Qoder 分页时读一次本地登录记录簿（只读，不触碰钥匙串凭据）。 */
			React.useEffect(() => {
				if (tab !== "qoder") return;
				const conn = CONNECTORS.find((item) => item.id === "qoder");
				if (conn && conn.localLogin) loadLocalLogins(conn, regionFor(conn));
			}, [tab, regions]);
			/* 打开 Trae 分页时读一次本机账号库（只读，不下发令牌）。 */
			React.useEffect(() => {
				if (tab !== "trae") return;
				const conn = CONNECTORS.find((item) => item.id === "trae");
				if (conn && conn.localAccounts) loadTraeLocals(conn, regionFor(conn));
			}, [tab, regions]);

			/* Lightweight live refresh of the OPEN connector tab (daddy-suite style:
			poll on an interval, but skip the tick while the document is hidden). */
			React.useEffect(() => {
				if (!autoProbe) return;
				const conn = CONNECTORS.find((item) => item.id === tab);
				if (!conn) return;
				const timer = setInterval(() => {
					if (document.hidden) return;
					probeConnector(conn, regions[conn.id]).then((result) => {
						statusRef.current = Object.assign({}, statusRef.current, { [conn.id]: result });
						setStatus((prev) => Object.assign({}, prev, { [conn.id]: result }));
					});
				}, 60000);
				return () => clearInterval(timer);
			}, [tab, autoProbe, regions]);

			const chooseTab = (id) => {
				setTab(id);
				setModelQuery("");
				setActionNote("");
				const prefs = readJSON(K_HUB, {});
				prefs.tab = id;
				writeJSON(K_HUB, prefs);
			};

			const probeSingle = (conn, reg) => {
				const region = reg || regionFor(conn);
				setStatus((prev) => Object.assign({}, prev, { [conn.id]: { state: "probing" } }));
				return probeConnector(conn, region).then((result) => {
					setStatus((prev) => Object.assign({}, prev, { [conn.id]: result }));
					/* 立刻更新镜像，供同一 then 链里的 refreshSingle 读新账号。 */
					statusRef.current = Object.assign({}, statusRef.current, { [conn.id]: result });
					return result;
				});
			};

			const changeRegion = (conn, reg) => {
				setRegions((prev) => Object.assign({}, prev, { [conn.id]: reg }));
				/* 换区域后旧 live roster 属于另一个区域，别继续显示。 */
				setRefreshedModels((prev) => {
					const next = Object.assign({}, prev);
					for (const key of Object.keys(next)) if (key.indexOf(conn.id + "|") === 0) delete next[key];
					return next;
				});
				probeSingle(conn, reg);
			};

			const refreshSingle = (conn) => {
				if (!conn.refresh) { probeSingle(conn); return; }
				setRefreshing(true);
				setRefreshNote("");
				/* 缓存按账号绑定：切换账号后这份 live roster 必须失效。 */
				const st = statusRef.current[conn.id];
				const accountId = String((st && st.body && st.body.accountId) || "");
				const regionsToRefresh = conn.regions.length ? conn.regions : [null];
				Promise.all(regionsToRefresh.map(async (region) => {
					const url = region === null ? conn.refresh : conn.refresh + "?region=" + encodeURIComponent(region);
					try {
						const response = await fetch(url, { method: "POST", credentials: "same-origin", headers: { accept: "application/json" } });
						let models = null;
						let reason = "";
						try {
							const body = await response.json();
							if (body && Array.isArray(body.models)) models = body.models;
							if (body && !response.ok) reason = String(body.error || body.message || "");
						} catch (error) {}
						return { ok: response.ok, status: response.status, region: region || "", models: models, reason: reason };
					} catch (error) { return { ok: false, status: 0, region: region || "", models: null, reason: String(error && error.message || error) }; }
				})).then((results) => {
					try { refreshCatalog(); } catch (error) {}
					/* 成功才写缓存；失败必须清掉旧结果，不能拿上次的目录冒充本次刷新。 */
					setRefreshedModels((prev) => {
						const next = Object.assign({}, prev);
						for (const result of results) {
							const key = conn.id + "|" + result.region;
							if (result.ok && result.models !== null) next[key] = { accountId: accountId, models: result.models };
							else delete next[key];
						}
						return next;
					});
					const ok = results.filter((result) => result.ok).length;
					const total = results.reduce((n, r) => n + (r.models === null ? 0 : r.models.length), 0);
					const failures = results.filter((r) => !r.ok);
					const reasons = failures.map((r) => (r.region ? r.region + ": " : "") + (r.reason || "HTTP " + r.status)).filter(Boolean);
					setRefreshNote(H("refreshed") + " " + ok + "/" + results.length
						+ (total > 0 ? " · " + total + " models" : "") + " · " + H("modelsRefreshed")
						+ (failures.length > 0 ? " · " + H("refreshPartial") + (reasons.length > 0 ? ": " + reasons.join("; ") : "") : ""));
					setRefreshing(false);
					probeSingle(conn, regionFor(conn));
				});
			};

			const refreshAll = () => {
				setRefreshing(true);
				setRefreshNote("");
				refreshModels().then((summary) => {
					/* 成功的目标写 live roster（绑定账号）；失败的目标清掉旧缓存。 */
					if (summary && Array.isArray(summary.results)) {
						setRefreshedModels((prev) => {
							const next = Object.assign({}, prev);
							for (const result of summary.results) {
								const parts = String(result.label || "").split("/");
								const connId = parts[0];
								const region = parts.slice(1).join("/");
								if (!CONNECTORS.some((item) => item.id === connId)) continue;
								const key = connId + "|" + region;
								if (result.ok && Array.isArray(result.models)) {
									const st = statusRef.current[connId];
									const accountId = String((st && st.body && st.body.accountId) || "");
									next[key] = { accountId: accountId, models: result.models };
								} else {
									delete next[key];
								}
							}
							return next;
						});
					}
					const failures = summary && Array.isArray(summary.results)
						? summary.results.filter((r) => !r.ok && !r.skipped) : [];
					const reasons = failures.map((r) => String(r.label || "") + (r.error ? ": " + r.error : r.status ? ": HTTP " + r.status : "")).filter(Boolean);
					setRefreshNote(summary && summary.started
						? H("refreshed") + " · " + summary.succeeded + "/" + summary.total + " · " + summary.models + " models"
							+ (failures.length > 0 ? " · " + H("refreshPartial") + (reasons.length > 0 ? ": " + reasons.join("; ") : "") : "")
						: H("refreshing"));
					setRefreshing(false);
					runProbe();
				}).catch(() => { setRefreshing(false); });
			};

			const cycleSort = () => {
				const next = SORTS[(SORTS.indexOf(sortMode()) + 1) % SORTS.length];
				writeJSON(K_SORT, next);
				setAcc(readAccordionState());
				redecorateAll();
			};
			const toggleStable = () => {
				writeJSON(K_STABLE_HEIGHT, !(readJSON(K_STABLE_HEIGHT, true) !== false));
				setAcc(readAccordionState());
				redecorateAll();
			};
			const clearFavorites = () => {
				writeJSON(K_FAVORITES, []);
				writeJSON(K_FAVORITE_IDS, {});
				setAcc(readAccordionState());
				redecorateAll();
			};
			const toggleAutoProbe = () => {
				const prefs = readJSON(K_HUB, {});
				prefs.autoProbe = !autoProbe;
				writeJSON(K_HUB, prefs);
				setAutoProbe(!autoProbe);
			};

			const statusBadge = (st) => {
				const state = st ? st.state : "unknown";
				const label = state === "ok" ? H("statusOk") : state === "error" ? H("statusError") : state === "probing" ? H("statusProbing") : H("statusUnknown");
				return h("span", { className: "dsh-hub-status", "data-state": state }, label);
			};

			const connectorCard = (conn, st) => h("div", { className: "dsh-hub-card", key: conn.id },
				h("div", { className: "dsh-hub-card-head" },
					h("div", null,
						h("div", { className: "dsh-hub-name" }, conn.name),
						h("div", { className: "dsh-hub-pkg" }, conn.pkg + " · v" + conn.version)
					),
					statusBadge(st)
				),
				h("div", { className: "dsh-hub-detail" }, st && st.detail ? st.detail : H("noProbe")),
				conn.providers.length ? h("div", { className: "dsh-hub-pkg" }, H("providers") + ": " + conn.providers.join(" / ")) : null,
				conn.regions.length ? h("div", { className: "dsh-hub-pkg" }, H("regions") + ": " + conn.regions.join(" / ")) : null,
				h("div", { className: "dsh-hub-card-actions" },
					h("button", { className: "dsh-hub-btn", type: "button", onClick: () => probeSingle(conn) }, H("probeOne")),
					conn.refresh
						? h("button", { className: "dsh-hub-btn", type: "button", onClick: () => refreshSingle(conn) }, H("refreshOne"))
						: null,
					h("button", { className: "dsh-hub-btn", type: "button", onClick: () => openNative(conn.pkg, () => setRefreshNote(H("openNativeFail"))) }, H("openNative"))
				)
			);

			const overviewPanel = () => h("div", { className: "dsh-hub-panel" },
				h("div", { className: "dsh-hub-stat" },
					h("div", null, h("b", null, String(CONNECTORS.length)), h("span", null, H("statConnectors"))),
					h("div", null, h("b", null, String(acc.favorites)), h("span", null, H("statFavorites"))),
					h("div", null, h("b", null, acc.sortLabel), h("span", null, H("statSort")))
				),
				h("div", { className: "dsh-hub-grid" }, CONNECTORS.map((conn) => connectorCard(conn, status[conn.id]))),
				h("p", { className: "dsh-hub-note" }, H("nativeNote")),
				h("p", { className: "dsh-hub-note" }, H("overviewNote"))
			);

			const kv = (label, value) => h("div", { className: "dsh-hub-kv-item" },
				h("div", { className: "dsh-hub-kv-label" }, label),
				h("div", { className: "dsh-hub-kv-value" },
					value === "" || value === null || value === undefined ? H("unknownValue") : String(value))
			);

			const accountCard = (conn, view) => h("div", { className: "dsh-hub-section", key: "account" },
				h("div", { className: "dsh-hub-section-title" }, H("accountInfo")),
				h("div", { className: "dsh-hub-kv" },
					kv(H("currentAccount"), view.accountName || view.message || H("signedOut")),
					kv(H("accounts"), String(view.accounts.length)),
					kv(H("modelsCount"), String(view.models.length)),
					kv(H("credits"), view.credits && view.credits.total !== null
						? String(view.credits.total)
						: (view.accounts.length && view.accounts[0].credit !== null ? String(view.accounts[0].credit) : "")),
					kv(H("regionLabel"), view.region),
					kv(H("expires"), hubDate(view.expiresAtMs))
				),
				h("div", { className: "dsh-hub-list" },
					view.accounts.length
						? view.accounts.map((a) => h("div", { className: "dsh-hub-list-row", key: a.id },
							h("div", null,
								h("span", null, a.name || a.id),
								a.selected ? h("span", { className: "dsh-hub-tag", "data-variant": "new", style: { marginLeft: "6px" } }, H("selected")) : null,
								(a.domain || a.edition) ? h("div", { className: "dsh-hub-model-meta" }, a.domain + (a.edition ? " · " + a.edition : "")) : null
							),
							a.credit !== null ? h("span", { className: "dsh-hub-kv-value" }, H("credits") + " " + String(a.credit)) : null
						))
						: h("p", { className: "dsh-hub-inline-note" }, H("noAccounts"))
				),
				view.checkin ? h("p", { className: "dsh-hub-inline-note" },
					H("checkin") + ": " + (view.checkin.todayCheckedIn ? H("checkedIn") : H("notCheckedIn")) +
					(typeof view.checkin.streakDays === "number" ? " · " + view.checkin.streakDays + "d" : "")) : null,
				(view.credits && view.credits.packages.length)
					? h("p", { className: "dsh-hub-inline-note" }, view.credits.packages.slice(0, 4).map((p) =>
						String(p.packageName || p.displayDesc || "") + " " + String(p.remain !== undefined ? p.remain : (p.size !== undefined ? p.size : ""))).join(" · "))
					: null
			);

			const poolCard = (conn, view) => {
				const p = view.pool || {};
				return h("div", { className: "dsh-hub-section", key: "pool" },
					h("div", { className: "dsh-hub-section-title" }, H("poolInfo")),
					h("div", { className: "dsh-hub-kv" },
						kv(H("poolState"), p.state || ""),
						kv(H("poolTotal"), typeof p.total === "number" ? String(p.total) : ""),
						kv(H("enabled"), p.enabled ? H("poolEnabled") : H("poolDisabled")),
						kv(H("modelsCount"), String(view.models.length))
					),
					h("p", { className: "dsh-hub-inline-note" }, H("opencodeHint")),
					h("div", { className: "dsh-hub-actions" },
						h("button", { className: "dsh-hub-btn", type: "button", onClick: () => probeSingle(conn) }, H("refreshPool")),
						conn.bridgeProbe
							? h("button", { className: "dsh-hub-btn", type: "button", disabled: busy === conn.id + ":pool",
								onClick: () => {
									setBusy(conn.id + ":pool");
									hubJson(conn.bridgeProbe, {
										method: "POST", timeoutMs: 30000,
										headers: { "content-type": "application/json", accept: "application/json" },
										body: JSON.stringify({ scope: "all" })
									}).then((r) => {
										setBusy("");
										setActionNote(r.ok ? H("saved") : H("opFailed") + " · " + ((r.body && r.body.message) || r.status));
									});
								} }, H("probePool"))
							: null
					)
				);
			};

			const modelRow = (conn, m, view) => {
				const enabled = view.enabledModelIds.length === 0 || view.enabledModelIds.indexOf(m.id) !== -1;
				const isNew = view.newModelIds.indexOf(m.id) !== -1;
				const isOff = view.offModelIds.indexOf(m.id) !== -1;
				const key = conn.id + "|" + m.id;
				const result = testResults[key];
				const isTesting = !!testing[key];
				const tags = [];
				if (isNew) tags.push(h("span", { className: "dsh-hub-tag", "data-variant": "new", key: "n" }, H("modelNew")));
				if (isOff || !enabled) tags.push(h("span", { className: "dsh-hub-tag", "data-variant": "off", key: "o" }, H("modelOff")));
				if (m.reasoning) tags.push(h("span", { className: "dsh-hub-tag", key: "r" }, H("reasoning")));
				if (m.supportsImages) tags.push(h("span", { className: "dsh-hub-tag", key: "i" }, H("images")));
				if (m.verified) tags.push(h("span", { className: "dsh-hub-tag", key: "v" }, H("testOk")));
				const meta = [];
				if (m.contextWindow) meta.push(H("context") + " " + String(m.contextWindow));
				if (m.creditMultiplier !== null) meta.push("×" + String(m.creditMultiplier));
				if (m.id !== m.name) meta.push(m.id);
				return h("div", { className: "dsh-hub-model", key: m.id },
					h("div", { className: "dsh-hub-model-main" },
						h("div", { className: "dsh-hub-model-id" }, m.name),
						meta.length ? h("div", { className: "dsh-hub-model-meta" }, meta.join(" · ")) : null,
						tags.length ? h("div", { className: "dsh-hub-tags" }, tags) : null
					),
					h("div", { className: "dsh-hub-model-actions" },
						(conn.probe || conn.test)
							? h("button", { className: "dsh-hub-btn", type: "button", disabled: isTesting,
								onClick: () => {
									const k = conn.id + "|" + m.id;
									setTesting((prev) => Object.assign({}, prev, { [k]: true }));
									hubTestModel(conn, regionFor(conn), m.id).then((r) => {
										setTestResults((prev) => Object.assign({}, prev, { [k]: r }));
										setTesting((prev) => Object.assign({}, prev, { [k]: false }));
									});
								} }, isTesting ? H("testing") : H("testModel"))
							: null,
						result ? h("span", { className: result.ok ? "dsh-hub-ok" : "dsh-hub-bad" },
							(result.ok ? H("testOk") : H("testFail")) + (result.label ? " · " + result.label : "") + (result.detail ? " · " + result.detail : "")) : null
					)
				);
			};

			const modelsCard = (conn, view) => {
				const q = modelQuery.trim().toLowerCase();
				const rows = view.models.filter((m) => !q || m.id.toLowerCase().indexOf(q) !== -1 || m.name.toLowerCase().indexOf(q) !== -1);
				return h("div", { className: "dsh-hub-section", key: "models" },
					h("div", { className: "dsh-hub-card-head" },
						h("div", { className: "dsh-hub-section-title" }, H("modelList") + " · " + view.models.length),
						h("div", { className: "dsh-hub-actions" },
							conn.regions.length > 1
								? h("select", { className: "dsh-hub-select", value: regionFor(conn), "aria-label": H("regionLabel"),
									onChange: (e) => changeRegion(conn, e.target.value) },
									conn.regions.map((r) => h("option", { key: r, value: r }, r)))
								: null,
							conn.refresh
								? h("button", { className: "dsh-hub-btn", type: "button", onClick: () => refreshSingle(conn) }, H("refreshOne"))
								: null,
							h("button", { className: "dsh-hub-btn", type: "button", onClick: () => probeSingle(conn, regionFor(conn)) }, H("refreshAccount"))
						)
					),
					h("input", { className: "dsh-hub-input", type: "search", value: modelQuery, placeholder: H("modelSearch"),
						"aria-label": H("modelSearch"), onChange: (e) => setModelQuery(e.target.value) }),
					rows.length
						? h("div", { className: "dsh-hub-models" }, rows.map((m) => modelRow(conn, m, view)))
						: h("p", { className: "dsh-hub-note" }, H("noModels")),
					h("p", { className: "dsh-hub-note" }, H("testWarn"))
				);
			};

			const addQoder = (conn, reg) => {
				const pat = patInput.trim();
				if (pat === "") { setActionNote(H("patLabel") + " · " + H("opFailed")); return; }
				setBusy(conn.id + ":add");
				hubJson(conn.accounts + "?region=" + encodeURIComponent(reg) + "&action=add", {
					method: "POST", timeoutMs: 30000,
					headers: { "content-type": "application/json", accept: "application/json" },
					body: JSON.stringify({ pat: pat, name: nameInput.trim() })
				}).then((r) => {
					setBusy("");
					if (r.ok && r.body && r.body.accountId) {
						setPatInput("");
						setNameInput("");
						setActionNote(H("accountAddOk") + " · " + String(r.body.accountName || ""));
						probeSingle(conn, reg);
					} else {
						setActionNote(H("opFailed") + " · " + ((r.body && r.body.error) || r.status));
					}
				});
			};

			const removeQoder = (conn, reg, accountId) => {
				setBusy(conn.id + ":rm:" + accountId);
				hubJson(conn.accounts + "?region=" + encodeURIComponent(reg) + "&action=remove", {
					method: "POST", timeoutMs: 30000,
					headers: { "content-type": "application/json", accept: "application/json" },
					body: JSON.stringify({ accountId: accountId })
				}).then((r) => {
					setBusy("");
					setActionNote(r.ok ? H("accountRemoved") : H("opFailed") + " · " + ((r.body && r.body.error) || r.status));
					probeSingle(conn, reg);
				});
			};

			const pollLogin = (conn, reg, loginId, tries) => {
				if (tries > 100) { setActionNote(H("opFailed") + " · timeout"); return; }
				setTimeout(() => {
					hubJson(conn.oauth + "?region=" + encodeURIComponent(reg) + "&action=poll", {
						method: "POST", timeoutMs: 30000,
						headers: { "content-type": "application/json", accept: "application/json" },
						body: JSON.stringify({ loginId: loginId })
					}).then((r) => {
						if (!r.ok || !r.body) { setActionNote(H("opFailed") + " · " + r.status); return; }
						if (r.body.done === true) {
							setOauth((prev) => { const next = Object.assign({}, prev); delete next[conn.id]; return next; });
							setActionNote(H("accountAddOk"));
							probeSingle(conn, reg);
						} else {
							pollLogin(conn, reg, loginId, tries + 1);
						}
					});
				}, 3000);
			};

			const startLogin = (conn, reg) => {
				setBusy(conn.id + ":oauth");
				hubJson(conn.oauth + "?region=" + encodeURIComponent(reg) + "&action=start", {
					method: "POST", timeoutMs: 30000, headers: { accept: "application/json" }
				}).then((r) => {
					setBusy("");
					if (!r.ok || !r.body || !r.body.loginId) {
						setActionNote(H("opFailed") + " · " + ((r.body && r.body.error) || r.status));
						return;
					}
					setOauth((prev) => Object.assign({}, prev, { [conn.id]: { uri: String(r.body.verificationUri || "") } }));
					setActionNote(H("oauthHint"));
					pollLogin(conn, reg, r.body.loginId, 0);
				});
			};

			const switchAccount = (conn, reg, accountId) => {
				setBusy(conn.id + ":switch");
				/* Qoder 的选中态在 `regions.<region>.accountId`（不是 workbuddy 的
				   `accounts.<region>`）；宿主 `mergeSlotWise` 会按槽位合并，所以
				   这里只带一个区域槽即可，不会抹掉另一侧。 */
				const isQoder = conn.id === "qoder";
				const payload = isQoder
					? { field: "regions", value: { [reg]: { accountId: accountId } } }
					: { field: "accounts", value: { [reg]: accountId } };
				hubJson(conn.save, {
					method: "POST", timeoutMs: 30000,
					headers: { "content-type": "application/json", accept: "application/json" },
					body: JSON.stringify(payload)
				}).then((r) => {
					setBusy("");
					setActionNote(r.ok ? H("saved") : H("opFailed") + " · " + ((r.body && r.body.error) || r.status));
					/* 换账号后旧 live roster 属于别的账号，清掉再按新账号重拉。 */
					if (r.ok) {
						setRefreshedModels((prev) => {
							const next = Object.assign({}, prev);
							for (const key of Object.keys(next)) if (key.indexOf(conn.id + "|") === 0) delete next[key];
							return next;
						});
					}
					probeSingle(conn, reg).then(() => {
						if (r.ok) refreshSingle(conn);
					});
				});
			};

			/* 本机 Qoder 桌面客户端登录态：当前登录 + 记录簿历史。 */
			const [localLogins, setLocalLogins] = React.useState({});
			const localLoginUrl = (conn, reg) => conn.localLogin + "?region=" + encodeURIComponent(reg);
			const loadLocalLogins = (conn, reg) => {
				hubJson(localLoginUrl(conn, reg), { headers: { accept: "application/json" } }).then((r) => {
					if (r.ok && r.body && Array.isArray(r.body.accounts)) {
						setLocalLogins((prev) => Object.assign({}, prev, { [reg]: r.body }));
					}
				});
			};
			const pullLocalLogin = (conn, reg) => {
				setBusy(conn.id + ":pull");
				hubJson(localLoginUrl(conn, reg), {
					method: "POST", timeoutMs: 60000,
					headers: { "content-type": "application/json", accept: "application/json" },
					body: JSON.stringify({ action: "pull" })
				}).then((r) => {
					setBusy("");
					setActionNote(r.ok ? H("localLoginPullOk") + " · " + ((r.body.account && r.body.account.accountName) || "")
						: H("localLoginPullFail") + " · " + ((r.body && r.body.error) || r.status));
					loadLocalLogins(conn, reg);
					probeSingle(conn, reg);
				});
			};
			const removeLocalLogin = (conn, reg, accountId) => {
				setBusy(conn.id + ":lrm:" + accountId);
				hubJson(localLoginUrl(conn, reg), {
					method: "POST", timeoutMs: 30000,
					headers: { "content-type": "application/json", accept: "application/json" },
					body: JSON.stringify({ action: "remove", accountId: accountId })
				}).then((r) => {
					setBusy("");
					setActionNote(r.ok ? H("localLoginRemoved") : H("opFailed") + " · " + ((r.body && r.body.error) || r.status));
					loadLocalLogins(conn, reg);
					probeSingle(conn, reg);
				});
			};

			const refreshAccounts = (conn, reg) => {
				setBusy(conn.id + ":refresh");
				hubJson(conn.accountsRefresh + "?region=" + encodeURIComponent(reg), {
					method: "POST", timeoutMs: 30000, headers: { accept: "application/json" }
				}).then((r) => {
					setBusy("");
					setActionNote(r.ok ? H("saved") : H("opFailed") + " · " + r.status);
					probeSingle(conn, reg);
				});
			};

			/* 本机 Trae 账号库（TraeDaddy 登录快照）：列表 + 同步 + 切换。 */
			const traeLocalUrl = (conn, reg) => conn.localAccounts + "?region=" + encodeURIComponent(reg);
			const loadTraeLocals = (conn, reg) => {
				if (!conn.localAccounts) return;
				hubJson(traeLocalUrl(conn, reg), { headers: { accept: "application/json" } }).then((r) => {
					if (r.ok && r.body && Array.isArray(r.body.accounts)) {
						setTraeLocals((prev) => Object.assign({}, prev, { [reg]: r.body }));
					}
				});
			};
			const postTraeLocal = (conn, reg, payload, okText) => {
				setBusy(conn.id + ":tl");
				hubJson(traeLocalUrl(conn, reg), {
					method: "POST", timeoutMs: 60000,
					headers: { "content-type": "application/json", accept: "application/json" },
					body: JSON.stringify(payload)
				}).then((r) => {
					setBusy("");
					const name = r.body && (r.body.accountName || "");
					setActionNote(r.ok ? okText + (name ? " · " + name : "") : H("opFailed") + " · " + ((r.body && r.body.error) || r.status));
					loadTraeLocals(conn, reg);
					/* 切账号后旧模型目录属于另一个账号：先清缓存，再按新账号重拉。 */
					const switched = r.ok && payload.action === "switch";
					if (switched) {
						setRefreshedModels((prev) => {
							const next = Object.assign({}, prev);
							for (const key of Object.keys(next)) if (key.indexOf(conn.id + "|") === 0) delete next[key];
							return next;
						});
					}
					probeSingle(conn, reg).then(() => {
						if (switched) refreshSingle(conn);
					});
				});
			};
			const syncTraeLocals = (conn, reg) => postTraeLocal(conn, reg, { action: "sync" }, H("traeLocalSynced"));
			const switchTraeLocal = (conn, reg, accountId) => postTraeLocal(conn, reg, { action: "switch", accountId: accountId }, H("traeLocalSwitched"));

			const configCard = (conn, view) => {
				const reg = regionFor(conn);
				if (conn.id === "qoder") {
					const localState = localLogins[reg] || {};
					const localAccounts = Array.isArray(localState.accounts) ? localState.accounts : [];
					const localStatus = localState.status || null;
					return h("div", { className: "dsh-hub-section", key: "cfg" },
						h("div", { className: "dsh-hub-section-title" }, H("switchAccount")),
						h("div", { className: "dsh-hub-form-row" },
							h("select", { className: "dsh-hub-select", value: view.accountId, "aria-label": H("switchAccount"),
								onChange: (e) => switchAccount(conn, reg, e.target.value) },
								view.accounts.map((a) => h("option", { key: a.id, value: a.id },
									(a.name || a.id) + (a.source === "local-login" ? " · " + H("localLogin") : "")))),
							h("button", { className: "dsh-hub-btn", type: "button", disabled: busy === conn.id + ":refresh",
								onClick: () => { refreshAccounts(conn, reg); loadLocalLogins(conn, reg); } }, H("refreshAccount"))
						),
						h("p", { className: "dsh-hub-inline-note" }, H("qoderAccountHint")),
						h("div", { className: "dsh-hub-section-title" }, H("accountConfig")),
						h("div", { className: "dsh-hub-form-row" },
							h("input", { className: "dsh-hub-input", type: "password", value: patInput, placeholder: H("patPlaceholder"),
								"aria-label": H("patLabel"), onChange: (e) => setPatInput(e.target.value) }),
							h("input", { className: "dsh-hub-input", type: "text", value: nameInput, placeholder: H("nameLabel"),
								"aria-label": H("nameLabel"), onChange: (e) => setNameInput(e.target.value) }),
							h("button", { className: "dsh-hub-btn dsh-hub-btn-primary", type: "button", disabled: busy === conn.id + ":add",
								onClick: () => addQoder(conn, reg) }, H("addAccount"))
						),
						h("div", { className: "dsh-hub-list" },
							view.accounts.length
								? view.accounts.map((a) => h("div", { className: "dsh-hub-list-row", key: a.id },
									h("span", null, a.name || a.id,
										a.selected ? h("span", { className: "dsh-hub-tag", "data-variant": "new", style: { marginLeft: "6px" } }, H("selected")) : null),
									a.source === "vault"
										? h("button", { className: "dsh-hub-btn", type: "button", disabled: busy === conn.id + ":rm:" + a.id,
											onClick: () => removeQoder(conn, reg, a.id) }, H("removeAccount"))
										: null
								))
								: h("p", { className: "dsh-hub-inline-note" }, H("noAccounts"))
						),
						h("div", { className: "dsh-hub-section-title" }, H("localLogin")),
						h("p", { className: "dsh-hub-inline-note" }, H("localLoginHint")),
						h("div", { className: "dsh-hub-form-row" },
							h("button", { className: "dsh-hub-btn dsh-hub-btn-primary", type: "button", disabled: busy === conn.id + ":pull",
								onClick: () => pullLocalLogin(conn, reg) }, H("pullLocalLogin")),
							localStatus && localStatus.name
								? h("span", { className: "dsh-hub-inline-note" }, H("localLoginActive") + ": " + localStatus.name)
								: null
						),
						h("div", { className: "dsh-hub-list" },
							localAccounts.length
								? localAccounts.map((a) => h("div", { className: "dsh-hub-list-row", key: a.id },
									h("span", null, a.accountName || a.uid || a.id,
										h("span", { className: "dsh-hub-tag", "data-variant": a.active ? "new" : "off", style: { marginLeft: "6px" } },
											a.active ? H("localLoginActive") : H("localLoginInactive"))),
									h("button", { className: "dsh-hub-btn", type: "button", disabled: busy === conn.id + ":switch",
										onClick: () => switchAccount(conn, reg, a.id) }, H("switchAccount")),
									h("button", { className: "dsh-hub-btn", type: "button", disabled: busy === conn.id + ":lrm:" + a.id,
										onClick: () => removeLocalLogin(conn, reg, a.id) }, H("removeAccount"))
								))
								: h("p", { className: "dsh-hub-inline-note" }, H("noAccounts"))
						)
					);
				}
				if (conn.id === "workbuddy") {
					const login = oauth[conn.id];
					return h("div", { className: "dsh-hub-section", key: "cfg" },
						h("div", { className: "dsh-hub-section-title" }, H("accountConfig")),
						h("div", { className: "dsh-hub-form-row" },
							h("select", { className: "dsh-hub-select", value: view.accountId, "aria-label": H("switchAccount"),
								onChange: (e) => switchAccount(conn, reg, e.target.value) },
								view.accounts.map((a) => h("option", { key: a.id, value: a.id }, a.name || a.id))),
							h("button", { className: "dsh-hub-btn", type: "button", disabled: busy === conn.id + ":oauth",
								onClick: () => startLogin(conn, reg) }, H("oauthLogin")),
							h("button", { className: "dsh-hub-btn", type: "button", disabled: busy === conn.id + ":refresh",
								onClick: () => refreshAccounts(conn, reg) }, H("refreshAccount"))
						),
						(login && login.uri) ? h("p", { className: "dsh-hub-link" }, H("oauthUri") + ": " + login.uri) : null,
						h("p", { className: "dsh-hub-inline-note" }, H("oauthHint"))
					);
				}
				if (conn.id === "trae") {
					const localState = traeLocals[reg] || {};
					const locals = Array.isArray(localState.accounts) ? localState.accounts : [];
					return h("div", { className: "dsh-hub-section", key: "cfg" },
						h("div", { className: "dsh-hub-section-title" }, H("switchAccount")),
						h("div", { className: "dsh-hub-form-row" },
							h("select", { className: "dsh-hub-select", value: view.accountId, "aria-label": H("switchAccount"),
								onChange: (e) => switchTraeLocal(conn, reg, e.target.value) },
								view.accounts.map((a) => h("option", { key: a.id, value: a.id }, a.name || a.id))),
							h("button", { className: "dsh-hub-btn", type: "button", disabled: busy === conn.id + ":refresh",
								onClick: () => refreshAccounts(conn, reg) }, H("refreshAccount"))
						),
						h("div", { className: "dsh-hub-section-title" }, H("traeLocalAccounts")),
						h("p", { className: "dsh-hub-inline-note" }, H("traeLocalHint")),
						h("div", { className: "dsh-hub-form-row" },
							h("button", { className: "dsh-hub-btn dsh-hub-btn-primary", type: "button", disabled: busy === conn.id + ":tl",
								onClick: () => syncTraeLocals(conn, reg) }, H("traeSyncLocal"))
						),
						h("div", { className: "dsh-hub-list" },
							locals.length
								? locals.map((a) => h("div", { className: "dsh-hub-list-row", key: a.id },
									h("span", null, a.accountName || a.userId || a.id,
										a.active ? h("span", { className: "dsh-hub-tag", "data-variant": "new", style: { marginLeft: "6px" } }, H("traeLocalActive")) : null,
										localState.selectedAccountId === a.id ? h("span", { className: "dsh-hub-tag", "data-variant": "new", style: { marginLeft: "6px" } }, H("selected")) : null),
									h("button", { className: "dsh-hub-btn", type: "button", disabled: busy === conn.id + ":tl",
										onClick: () => switchTraeLocal(conn, reg, a.id) }, H("traeSwitchLocal"))
								))
								: h("p", { className: "dsh-hub-inline-note" }, H("noAccounts"))
						),
						h("p", { className: "dsh-hub-inline-note" }, H("traeAccountHint"))
					);
				}
				return null;
			};

			const connectorPanel = (conn) => {
				const st = status[conn.id];
				let view = hubUsageView(conn, st || {});
				/**
				* 「刷新模型」拉回来的 live roster 优先于 `/usage` 的目录。
				* Trae / Qoder 现在由宿主写回 lastCatalog，但 settings 回灌与
				* 重新 probe 之间有一小段窗口，留这份缓存能让列表立刻变化；
				* 新 probe 到达后 `/usage` 本身就是全量，两者一致。
				*
				* 但缓存必须**绑定账号**：切换账号（或刷新失败）后 accountId 变化 /
				* 缓存被删除，这里就回落到 `/usage` 的真实目录，绝不拿上一个账号
				* 的模型冒充当前账号 —— 那正是「模型列表刷新不对」的根因。
				*/
				const cached = refreshedModels[conn.id + "|" + (view.region || regionFor(conn) || "")];
				const live = cached && Array.isArray(cached.models) ? cached.models : null;
				const currentAccountId = String((st && st.body && st.body.accountId) || "");
				if (live && live.length > 0 && st && st.body && typeof st.body === "object"
					&& String(cached.accountId || "") === currentAccountId) {
					view = hubUsageView(conn, Object.assign({}, st, { body: Object.assign({}, st.body, { models: live }) }));
				}
				return h("div", { className: "dsh-hub-panel", key: conn.id },
					connectorCard(conn, st),
					conn.bridge ? poolCard(conn, view) : accountCard(conn, view),
					modelsCard(conn, view),
					conn.bridge ? null : configCard(conn, view),
					actionNote ? h("p", { className: "dsh-hub-note" }, actionNote) : null,
					h("p", { className: "dsh-hub-note" }, H("nativeNote"))
				);
			};

			const optionRow = (label, desc, control) => h("div", { className: "dsh-hub-row" },
				h("div", null,
					h("div", { className: "dsh-hub-row-label" }, label),
					h("div", { className: "dsh-hub-row-desc" }, desc)
				),
				control
			);

			const accordionPanel = () => h("div", { className: "dsh-hub-panel" },
				optionRow(H("sortLabel"), H("sortDesc"),
					h("button", { className: "dsh-hub-btn", type: "button", onClick: cycleSort }, acc.sortLabel)),
				optionRow(H("stableLabel"), H("stableDesc"),
					h("button", { className: "dsh-hub-switch", type: "button", role: "switch",
						"aria-checked": acc.stable ? "true" : "false", "aria-label": H("stableLabel"), onClick: toggleStable })),
				optionRow(H("favoritesLabel"), H("favoritesDesc") + " · " + acc.favorites,
					h("button", { className: "dsh-hub-btn", type: "button", onClick: clearFavorites }, H("clearFavorites"))),
				optionRow(H("autoProbeLabel"), H("autoProbeDesc"),
					h("button", { className: "dsh-hub-switch", type: "button", role: "switch",
						"aria-checked": autoProbe ? "true" : "false", "aria-label": H("autoProbeLabel"), onClick: toggleAutoProbe })),
				optionRow(H("refreshAllLabel"), H("refreshAllDesc"),
					h("button", { className: "dsh-hub-btn dsh-hub-btn-primary", type: "button", disabled: refreshing, onClick: refreshAll },
						refreshing ? H("refreshing") : H("refreshAllBtn"))),
				h("p", { className: "dsh-hub-note" }, H("accordionNote"))
			);

			let panel;
			if (tab === "accordion") panel = accordionPanel();
			else if (tab === "overview") panel = overviewPanel();
			else {
				const conn = CONNECTORS.find((item) => item.id === tab);
				panel = conn ? connectorPanel(conn) : overviewPanel();
			}

			return h("div", { "data-dsh-hub": "" },
				h("div", { className: "dsh-hub-head" },
					h("div", null,
						h("p", { className: "dsh-hub-title" }, H("title")),
						h("p", { className: "dsh-hub-sub" }, H("sub"))
					),
					h("div", { className: "dsh-hub-actions" },
						h("button", { className: "dsh-hub-btn", type: "button", disabled: probing, onClick: runProbe }, probing ? H("probing") : H("probe")),
						h("button", { className: "dsh-hub-btn dsh-hub-btn-primary", type: "button", disabled: refreshing, onClick: refreshAll }, refreshing ? H("refreshing") : H("refreshAll"))
					)
				),
				h("div", { className: "dsh-hub-tabs", role: "tablist" }, HUB_TABS.map((item) =>
					h("button", {
						key: item.id, type: "button", role: "tab", className: "dsh-hub-tab",
						"aria-selected": tab === item.id ? "true" : "false",
						onClick: () => chooseTab(item.id)
					}, H(item.key))
				)),
				panel,
				refreshNote ? h("div", { className: "dsh-hub-detail" }, refreshNote) : null
			);
		}
		/**
		 * Register the connector hub as a settings page. It uses the same slot
		 * contract as the installed connectors (plugins.item + the two *.config
		 * keys), but deliberately does NOT gate on configForms.whileServed: the
		 * card keeps its prefs in localStorage and needs no settings form, so it
		 * can render as soon as the plugin-manager declares the slot. Every step
		 * is guarded so a failure here can never break the accordion itself.
		 * @param ctx - the client plugin context.
		 */
		function mountConnectorHub(ctx) {
			return ctx.effect(() => {
				const disposers = [];
				const keep = (fn) => { if (typeof fn === "function") disposers.push(fn); };
				/* UI copy. A duplicate namespace would throw, so guard it. */
				try { keep(ctx.locale.register(HUB_NS, { zh: HUB_MESSAGES.zh, en: HUB_MESSAGES.en })); } catch (error) {}
				const itemCard = () => ctx.slots.register({
					name: "plugins.item",
					id: "dsh-model-accordion",
					order: 25,
					label: () => hubText()("title"),
					locale: HUB_NS
				}, HubCard);
				/* Also open the hub from any row / bundle config card the host
				   may render for this package. */
				const rowCard = () => ctx.slots.register({
					name: "plugins.row.config",
					key: "dsh-model-accordion#dsh-model-accordion",
					locale: HUB_NS
				}, HubCard);
				const bundleCard = () => ctx.slots.register({
					name: "plugins.bundle.config",
					key: "dsh-model-accordion",
					locale: HUB_NS
				}, HubCard);
				const inject = (slot, register) => {
					try { keep(ctx.slots.inject(slot, register)); }
					catch (error) { try { keep(register()); } catch (error2) { /* slot not available */ } }
				};
				inject("plugins.item", itemCard);
				inject("plugins.row.config", rowCard);
				inject("plugins.bundle.config", bundleCard);
				return () => {
					for (const dispose of disposers) {
						try { dispose(); } catch (error) { /* already gone */ }
					}
				};
			}, "dsh-model-accordion: connector hub settings");
		}

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
			if (missingKeys === null) missingKeys = loadMissingKeys();

			/* ModelCatalogDirectory.load() short-circuits while its status is
			   "ready", so reopening the menu alone cannot re-fetch. Force it with
			   the service's refresh() (invalidate + load). The service name is an
			   internal implementation detail of dsh-client-ui-model-selection, so
			   resolve it lazily on every click, guard every step, and treat a
			   missing service as a soft no-op rather than an error. */
			refreshCatalog = () => {
				let service;
				try {
					service = typeof ctx.get === "function" ? ctx.get("modelDirectories") : null;
				} catch (error) {
					return false;
				}
				const catalog = service === null || service === undefined ? null : service.catalog;
				if (catalog === null || catalog === undefined || typeof catalog.refresh !== "function") return false;
				try {
					catalog.refresh();
					return true;
				} catch (error) {
					return false;
				}
			};
			/* Other connector plugins can add a refresh target without importing
			   this bundle: dispatch dsh-model-accordion:refresh-register with the
			   target in detail, or call registerRefreshTarget() directly. */
			const onRegister = (event) => {
				const target = event instanceof CustomEvent ? event.detail : null;
				if (target !== null && target !== undefined) registerRefreshTarget(target);
			};
			document.addEventListener(REFRESH_REGISTER_EVENT, onRegister);
			const sweep = () => {
				const lists = modelLists();
				for (const container of lists) {
					if (!attached.has(container)) attached.set(container, attach(container));
					decorate(container);
					/* Remember which favorites a COMPLETE pass proved gone, so the
					   root pane stops offering them: it is drawn without a
					   provider list, so it cannot check for itself. Evidence of
					   absence is required — the pass must be unfiltered, and the
					   favorite's own provider must have rendered its rows. A
					   provider that failed to load leaves no section at all, and
					   then nothing is concluded about its models. */
					if (!searching(container)) {
						const labels = new Set(sectionsOf(container).map(labelOf));
						const rendered = new Set();
						for (const row of container.querySelectorAll(ROW_SELECTOR)) {
							if (row.closest("[" + FAV_ATTR + "]") !== null) continue;
							const key = keyOf(row);
							if (key !== null) rendered.add(key);
						}
						const next = new Set(missingKeys ?? []);
						let changed = false;
						for (const key of favorites()) {
							if (rendered.has(key)) {
								if (next.delete(key)) changed = true;
								continue;
							}
							if (!labels.has(splitKey(key).provider)) continue;
							if (!next.has(key)) {
								next.add(key);
								changed = true;
							}
						}
						if (changed) {
							missingKeys = next;
							saveMissingKeys(next);
						}
					}
				}
				const panes = rootPanes();
				for (const pane of panes) {
					if (!attached.has(pane)) attached.set(pane, attachRoot(pane));
					decorateRoot(pane);
				}
				if (panes.length === 0) clearRoot();
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
			/* Wire the unified connector-hub settings card. All of it is guarded
			   internally; a missing slot/locale/form service is a soft no-op. */
			hubRescan = sweep;
			mountConnectorHub(ctx);
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
				sort: sortMode,
				refresh: refreshModels,
				refreshState: () => ({ ...refreshState }),
				registerRefreshTarget: registerRefreshTarget,
				refreshTargets: () => refreshRequests().map((entry) => entry.label),
				hub: {
					connectors: () => CONNECTORS.map((conn) => ({
						id: conn.id,
						pkg: conn.pkg,
						version: conn.version,
						providers: conn.providers,
						regions: conn.regions
					})),
					probe: probeConnector,
					openNative: openNative,
					state: () => readJSON(K_HUB, {})
				}
			};
			ctx.effect(() => () => {
				observer.disconnect();
				document.removeEventListener("keydown", onKey, true);
				document.removeEventListener("pointerdown", onPointer, true);
				document.removeEventListener("mousedown", onPointer, true);
				document.removeEventListener(REFRESH_REGISTER_EVENT, onRegister);
				if (refreshTimer !== 0) clearTimeout(refreshTimer);
				for (const container of modelLists()) {
					const off = attached.get(container);
					if (typeof off === "function") off();
				}
				delete window.__dshModelAccordion;
				document.getElementById(STYLE_ID)?.remove();
				document.getElementById(HUB_STYLE_ID)?.remove();
			}, "dsh-model-accordion: model list accordion");
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
