window.__ModuleLoader__.load({
	id: "dsh-connect-trae",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		//#region src/client/series-layout.ts
		/** 同系列的公共布局规则。两个桥接插件同步维护此文件，功能专属样式留在 styles.ts。 */
		function seriesLayoutCss(plugin) {
			const p = `.dsm-${plugin}`;
			const u = `${p}-usage`;
			const members = plugin === "trae" ? `${p}-pool-card` : `${p}-pool-members`;
			const memberHead = plugin === "trae" ? `${p}-pool-card-head` : `${p}-pool-members-head`;
			const memberTitle = plugin === "trae" ? `${p}-pool-card-title` : `${p}-pool-members-title`;
			const memberActions = plugin === "trae" ? `${p}-pool-card-tools` : `${p}-pool-members-actions`;
			const saveBar = plugin === "trae" ? `${p}-pool-save-row` : `${p}-pool-save-bar`;
			return `
${p}-page{font-family:inherit;--dsm-series-sticky-top:-28px}
${p}-page${p}-page{height:calc(100% - 16px);margin-bottom:16px;padding:28px clamp(24px,4vw,48px) 48px;gap:20px}
${u} ${p}-pool-auto-checkin-status{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#777)}
${p}-page-desc{font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary,#999)}
${u} ${p}-pool-auto-checkin{display:flex;flex-direction:column;gap:6px;margin-top:8px}
${p}-page>*{width:100%;max-width:860px;min-width:0}
${u}{gap:16px;font-size:13px;line-height:1.5;min-width:0}
${u} .dsm-btn{box-sizing:border-box;font:inherit;font-size:13px;line-height:20px;padding:5px 14px;border-radius:8px;min-height:32px}
${u} .dsm-btn-outline{background:transparent;border-color:var(--dsw-alias-border-l2,#777);color:var(--dsw-alias-label-secondary,#999)}
${u} ${p}-tabs{display:flex;gap:8px}
${u} ${p}-tab-cell{flex:1;min-width:0;padding:8px 12px;border-radius:10px}
${u} ${p}-panels{position:sticky;top:var(--dsm-series-sticky-top,0px);z-index:2;display:flex;gap:2px;margin:4px 0 0;padding:8px 0 0;border-bottom:1px solid var(--dsw-alias-border-l1,#777);background:var(--dsw-alias-bg-layer-2,#24262c)}
/* 吸顶背景覆盖卡片两侧内边距，顶部偏移抵消滚动容器的顶部内边距。 */
${p}-page-body ${u} ${p}-panels{margin-inline:0;padding:8px 0;border:0;border-bottom:1px solid var(--dsw-alias-border-l2,#777);border-radius:0;background:var(--dsw-alias-bg-layer-3,#202126)}
${p}-page[data-tabs-stuck="true"] ${p}-panels{margin-inline:-20px;padding-inline:20px;border-top:1px solid var(--dsw-alias-border-l2,#777);box-shadow:0 3px 6px rgba(0,0,0,.06)}
${u} ${p}-panel-tab{font-size:13px;font-weight:600;line-height:20px;padding:7px 11px}
${u} ${p}-panel{margin-top:0;min-width:0}
${u} ${p}-models-summary,${u} ${p}-panel-note{margin:2px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#999)}
${u} ${p}-free-quota-warn{font-weight:600}
/* 说明段落的间距由容器统一控制，避免与卡片的纵向 gap 叠加。 */
${u} ${p}-region-summary{display:flex;flex-direction:column;gap:2px}
${u} ${p}-region-summary ${p}-models-summary{margin:0}
/* 页签底边已经分隔账号区，不在账号池顶部重复画线。 */
${u} #dsm-${plugin}-panel-accounts ${p}-pool{border-top:0;padding-top:0}

${u} ${p}-pool{display:flex;flex-direction:column;gap:12px;margin:0;padding:14px 0 0;border-top:1px solid var(--dsw-alias-border-l2,#777)}
${u} ${p}-pool-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
${u} ${p}-pool-title{margin:0;font-size:13px;font-weight:600;line-height:18px}
${u} ${plugin === "trae" ? `${p}-pool-current` : `${p}-pool-current-badge`}{margin-left:auto;max-width:100%;overflow-wrap:anywhere;white-space:normal;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,#777);font-size:11px;font-weight:500;line-height:16px;background:var(--dsw-alias-bg-layer-2,#24262c);color:var(--dsw-alias-label-secondary,#999)}
${u} ${p}-pool-settings${p}-pool-modebar{padding:12px 14px;gap:8px;border:1px solid var(--dsw-alias-border-l2,#777);border-radius:12px;background:color-mix(in srgb,var(--dsw-alias-brand-primary,#cf795b) 5%,var(--dsw-alias-bg-layer-2,#24262c))}
${u} ${p}-pool-modebar-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-height:20px}
${u} ${p}-pool-modebar-label{font-size:13px;font-weight:600;line-height:20px}
${u} ${p}-pool-modebar-state{padding:1px 9px;font-size:12px;line-height:18px;border-radius:999px;color:var(--dsw-alias-label-secondary,#999);border:1px solid var(--dsw-alias-border-l2,#777);background:var(--dsw-alias-bg-layer-2,#24262c)}
${u} ${p}-pool-note,${u} ${p}-pool-modebar ${p}-pool-note{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#999)}
${u} ${members}{display:flex;flex-direction:column;gap:0;min-width:0;border:1px solid var(--dsw-alias-border-l2,#777);border-radius:12px;background:var(--dsw-alias-bg-layer-2,#24262c);overflow:hidden}
${u} ${memberHead}{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:14px 14px 12px}
${u} ${memberTitle}{margin:0;font-size:13px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-primary,#eee)}
${u} ${memberHead} ${p}-pool-note{margin-top:4px}
${u} ${memberActions}{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
${u} ${memberActions} .dsm-btn{padding:5px 14px;font-size:13px;line-height:20px}
${u} ${p}-pool-count,${u} ${memberActions} ${p}-pool-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#999)}
${u} ${members} ${p}-pool-actions{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:0 14px 12px}
${u} ${p}-pool-actions-end{margin-left:auto}
${u} ${members} ${p}-pool-action-note{margin:0;padding:0 14px 12px;font-size:12px;line-height:18px}
${u} ${members} ${p}-pool-table{border:0;border-top:1px solid var(--dsw-alias-border-l1,#777);border-radius:0}
${u} ${p}-pool-row{padding:10px 14px;align-items:start;font-size:13px;line-height:18px}
${u} ${p}-pool-row-head{padding:8px 14px;font-size:11px;line-height:16px;align-items:center}
${u} ${p}-pool-row-current{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#cf795b) 5%,var(--dsw-alias-bg-layer-2,#24262c));box-shadow:inset 3px 0 0 var(--dsw-alias-brand-primary,#cf795b)}
${u} ${p}-pool-row-actions .dsm-btn{min-height:26px;padding:2px 10px;font-size:12px;line-height:20px}
${u} ${p}-pool-settings-wrap{display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--dsw-alias-border-l2,#777);padding-top:14px}
${u} ${p}-pool-settings{border-radius:12px;gap:0}
${u} ${p}-pool-settings-wrap :is(h3,h4){margin:0;font-size:13px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-primary,#eee)}
${u} ${p}-pool-set-ctl select{box-sizing:border-box;width:240px;min-width:0;max-width:100%}
${u} ${p}-pool-set{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 14px}
${u} ${p}-pool-set-copy{flex:1;min-width:0;gap:3px}
${u} ${p}-pool-set-copy b{font-size:13px;font-weight:500;line-height:18px}
${u} ${p}-pool-set-copy span{font-size:12px;line-height:18px}
${u} ${p}-models-title{font-size:13px;line-height:18px;font-weight:600}
${u} ${p}-model-list{border-radius:12px}
${u} ${p}-model{padding:12px 14px;gap:8px}
${u} ${p}-model-name{font-size:13px;line-height:20px}
${u} ${p}-model-actions,${u} ${p}-pool-save-row{gap:12px;padding-top:12px}
/* 保存栏以整个账号池为粘附范围，避免被更多设置的短父级截住。 */
${u} ${p}-pool-settings-wrap{display:contents}
${u} ${saveBar}{position:sticky;bottom:0;z-index:2;isolation:isolate;padding-bottom:12px;background:var(--dsw-alias-bg-layer-3,#202126)}
/* 滚动容器底部的内边距也属于可见区域，负偏移让背景覆盖到视口底边。 */
${p}-page ${saveBar}{bottom:-48px}
${p}-page ${saveBar}[data-save-stuck="true"]{margin-inline:-20px;padding-inline:20px;border-top:1px solid var(--dsw-alias-border-l2,#777);border-bottom:1px solid var(--dsw-alias-border-l2,#777);border-radius:0;box-shadow:0 -3px 6px rgba(0,0,0,.06)}

${u} #dsm-${plugin}-panel-capabilities:not([hidden]){display:flex;flex-direction:column;gap:14px}
${u} ${p}-prefs{gap:14px;padding:0}
${u} ${p}-pref{font-size:13px;line-height:18px;gap:10px}
${u} ${p}-pref-hint{font-size:12px;line-height:18px}
${u} ${p}-draw-image{margin:0;gap:10px;font-size:13px;line-height:18px}
${u} ${p}-draw-image>span{display:flex;flex-direction:column;gap:3px}
${u} ${p}-draw-image-hint{font-size:12px;line-height:18px}
${u} ${p}-pool-table{container-type:inline-size}
${u} ${p}-pool-current-tag{border:1px solid var(--dsw-alias-border-l2,#777);background:var(--dsw-alias-bg-layer-2,#24262c);color:var(--dsw-alias-label-secondary,#999)}
@container(max-width:700px){
 ${u} ${p}-pool-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;padding:10px 12px}
 ${u} ${p}-pool-row-head{display:none}
 ${u} ${p}-pool-account{flex:1 1 auto;min-width:0}
 ${u} ${p}-pool-row-actions{flex:1 1 100%;justify-content:flex-start;padding-top:4px}
}
/* 自动签到、设备参数和 SDK 是功能差异；沿用公共间距，不移除控件。 */
${u} ${p}-device-mode{margin:0;padding:0 14px 12px}
${u} ${p}-pool .sw{width:36px;height:20px}
${u} ${p}-pool .sw-track::after{top:2px;left:2px;width:16px;height:16px;background:var(--dsw-alias-bg-layer-3,#fff)}
${u} ${p}-pool .sw input:checked+.sw-track::after{transform:translateX(16px)}
@media(max-width:600px){
 ${p}-page${p}-page{padding:20px 16px 32px;--dsm-series-sticky-top:-20px}
 ${p}-page ${saveBar}{bottom:-32px}
 ${u} ${memberHead}{align-items:flex-start}
 ${u} ${memberActions}{flex-wrap:wrap}
 ${u} ${p}-pool-set{flex-wrap:wrap}
 ${u} ${p}-pool-set-ctl{max-width:100%;flex-wrap:wrap}
 ${u} ${p}-pool-set-ctl select{min-width:0;max-width:100%}
}
`;
		}
		/** 根据页签与保存栏的实际吸附位置显示边界。 */
		function updateStickyTabs(page) {
			const tabs = page.querySelector("[role=\"tablist\"][class$=\"-panels\"]");
			const stuck = tabs !== null && page.scrollTop > 0 && tabs.getBoundingClientRect().top <= page.getBoundingClientRect().top + 1;
			page.dataset.tabsStuck = String(stuck);
			const viewportBottom = page.getBoundingClientRect().bottom;
			for (const bar of Array.from(page.querySelectorAll("[class$=\"-pool-save-row\"],[class$=\"-pool-save-bar\"]"))) {
				const visible = bar.getClientRects().length > 0;
				const bottom = Number.parseFloat(getComputedStyle(bar).bottom) || 0;
				bar.dataset.saveStuck = String(visible && Math.abs(bar.getBoundingClientRect().bottom + bottom - viewportBottom) <= 1);
			}
		}
		//#endregion
		//#region src/client/icon.ts
		/**
		* Plugin icon (LD brand logo, 64px) shared across the same-family plugins.
		* Same data URI used by `dsh-subagent-default-model` so the external image
		* stays consistent.
		*/
		const TRAE_PLUGIN_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAXGUlEQVR4nH1bC7BdVXn+1tr7nHPvzb3JvUloSAQp0JHWoAMttKOCFrWU8irQSbCTQYG21IahnTJUUTsM0FJhZCzCSIcKImOpDkhrhQ5YC7ROB3lUBU3EyCuBFBIIedzcx3ntvTr/a621TwIns3PO3mfvddf/+v7v/9c6DvYKoYBz1cZNYfJpVBcNBm7dcIhj3TBM15VzqAE6XAWEGggVADroOl0byDW+PtRr9E732rl9r2PxOMNsrCogVE7PA0Kge4Lcz5/TGI6v00UaK+h98u4QUA9quIDg4Pe2i2LTsknc++mzZu9cv37VHNaFAveSJICj/9aFUNzrXHXSTwdnznl/Y+X9MaEP1D0A/ToKaUdDASoAK0YVYcLad/G88S6C1aQcOkI2Nj9HylBFBRMYqPUeFp6EDXQfKcIUoud6LQQP59rwrsBEOdhy9KGDK/7j9mUPmBKcCf++Z4YbF6eKLw+6QFioKl/DoYILlXMsHE2KPCCzwlsqoNb3oUw4Kq+2a0k4G4MtXOX3J4HNyulzUkC0eqYI8ZAaQZQSAh9080Qx1m7jHStnL/3B3ctvXbcuFOwBH/p5OG12DA/29leV6wcHeI8hadE1rBldl/6ACs7WMEuz0PIcKawe0Gdzeyf36eTzcOHxVAEpTEQB0QtY0PRZPMYsX+t3tSqBxkteYeHh6qqu6yIsmVhaHHtE7/fu/8fJhzzF/OywunXQR+DJOO9pkLp2NJ64pIXhaOxb/IfmJM29PemSJ+NSzJP1s2dhwmucJ6uaoIYFzVjnkFDhLRTkb2XC03gQTKDrZNjSV1icXwzPv9y99Z5Hw6R/psQnqoniyLBQ1d65IoGiDqZuHwWwzyFzx8xl5RDBZR4uCZc9E8fS+8TdSfHZ2KxAel6VwEIYZiflxC9NKToeKcKrAcjV2d2DK3xYqOcXJ478ytf2fcL3htWGegAaSZGeBnKixWgVPXRiZpEomLq4Kcri2RCc7zN3NWuq5XlOJLwqjq9liqlHlEfzSveIdVk0Fjh5kVjdjKLneniCtcEg7N492FBWAWvrHpwLzgmYUfySi+VorcJFBE6I7jIAjFnC3DybePKE5ClxLLsPI0q3kNAsYJ4g1wjkzDuju4nQJrx6RxRe/7YHfFX3MOyHtaUHloaKcqa4rcQTDWxubHnZ0lESNoaGXad7+RmLc7GMxbS4s8Y82S3mdhMshR+Po4pk181jkx22afHc8hL3plNTjOGDjEfu7pxfWkpcyA02Ofo6xpylPsMCi3eNTROShVawM0H4+4bXaGqzcTKQzc8j6VGPkb9tFtU56bwlBdK9ZMQMKNgolMtVKepFcq6hBMAzQJAQ6srG9iwNJRfN0LtWd64z1qZjRPDieBYQkyNTqFpCsoYoKQFoFt8xhA5icZ2fXWOwY4GScsT95Tv7XoSnd0ehgLJBSPSdkdhYWbSeAk2eCSzuScDs/qQo9dpRZarVWWm5ZRuxn8YRRabYtiwhn5PVRXD9js8FzM2rowKII7MnOJSR2GSZJMVUckfzjIjKMe2p5fOsENGfPESR38AwB8AsZTUBUV025TwWVEAsubSl6gYA8rU6eUMmvE2ErjMrQEDZQGkewGI6TcqPAhlT1hHBBV0xZC/R3B09JFmdXDESrIz5GRPMlWQA6kNAoVbjf7FAyq1vsW8xrt+rImI4aEiwIuqAMjI9y/8Z5RSAS+f04P4uTcihozDLaO6kZup2gSWFIXjm3plb75sHxkugMKzAgWmQcYmsTvqrgPkuMOgHFAhY0gnolDJfOgTM0t/xMcYTJeZz9QZRgHiUd5AQIHe2fNqIY3o4xiEw3wc++A6HvzweWNbWtKmsrF853PFEwDd/LEqoVOiYQQLQ7QGXn+Zw3okOhc9i1tw8umpS7mBQ4PW9Ab/YVuHxTTV+8EyF7TsqTHQCxtsBlVWSUVBViGYHcnMDQvaUyAv03wmPDcP8ECiy2lwOKl4CFz2+AoYDx1b73rkOayaVfUXziRMu9oGTbg54cz9pNlV9FEJzi8CJv+zwwOWWoZvZfXSst3rteDPgXx4e4LZv9fDS9grLlzotkclDakmXJCCFTswAdC5eZQqphwErZgr40QInAh4XHMbsHGt6ugSmWuLZwyqwlclFhwqOrSJgZky+izydc7bj+1ZPy7P9AT2nz/MR+PuK/g6/50fg8QdDGffQFQ4b13fwyFcmccl5HczOUgVYoXTcAGEBSWBzdRY4hoLUBvGeQGFgrM84gMWglq/mwszXqcSlAahgdi57l8/Mr9gaxiqbnZwheZMU23Lw88zN0zWff5ZzCpeyAApqTNWkjBorljnceMUEbvnMEqK0qIc1A6UAnYQS5/6Md4jTNxlhGUkKRYYBHmHCiEewJxQjzmmenFdphiXsZ0aKstogvmwkEiqwYml6MmS6kQkQKcUlICsIY6hyDAEbzupgZgr448/OouyI5Y3t8YgGfq5OIaHfeiZDWXclFizWw1OmF0lRQ4A8UWevnPTEsTNFjoQ7fV0UDq3SoSyBVgmU/FmOVsuz9VmfrCUBMPIMut4f1Dj9tzv4wqcmORzIvW1qwgOcYIC5vB0gzAClQW1EGuJXkgql2MlyuTHFhg4OAlrm8vRxtHrMFUhRV4trv/hawK3fqbF/QSwoYwSUPuCwlcDJ7y3wgeMKFHAYDgN7gOmwLBwGgxobzhnH/z7Txz9/exErpz2HK1teUZ+tTSGXZYZCFGAc3eqBZsESmZs1L0e92HK5TikSKA2N2CMY8QATfuvOgLOvqrBlW0CnyOioeWVF1/v4rXd7/M2fjeGEtQWGFO+FpkzFFPKOv/7zKXz/sR5m99foUJ2rRRNhhwCfAqBOxQkbVObHKSv14UZb2KnFdBAl5CdxvMwDcnotrTsW/vW9wPnXVdi2M+DwQ4DVK4CZSWDFVDp+aRkwNR7wxE8GOOuyWdz3vT7K0jMGyN8ToKTzFTMel2yYwPxcAJe56voR/eO7tOscY0Ls2GSFkJW+Nue8QTn6agJD6gta5mhwf7mHhCdesOGGCpu3AmMthzv+qsTHf6fArj0SP5YGKXNQZpleArRcjU9ePYdHnxgwPrAStK1EXkBhvO7scRx+aIleL2SWTzFP1qdQYkCs6dx66COob/28mB61GjzACwhmc9Q2rxnt/9GfUGwY1g4XfbHG488GjLWAmzYWOOU4zwAoKG6KteYG8YSAdunQKQM+dcMc9uwLbHnRv9Baumf5dIGPnNTB4jx5gQjNgisNLuH0Gr07ygKpjpdKsFnWGiuMXtLwfaPDpoRk/dFqjcYht6Q7P3lzhQefqvn87y4usOEjkgpjYlHhyT2psjMLErOcHANe3DbAXfd1xfUZVzRH6qMf/VA7E15JkfECdX9TiB+11ughDcisQGr4+wEfDqzrtegRxAau+aca3/gvEejK8z0uOcNhsUfWtAJGviOhrWKLXRwujgImx4Fvf3cR3V7gLGBRyDnfBbxnbQurVlImqJlEmdtLSpS/I9dACpD0l+I+sTjLCNbLe3sekHlEJry5/tJxh/98usZtDwo1vfTsAp/+mMeA0hrnPssalgl0PtoEEUYn18fbDltfHmLzlgEcs0MtiZ0oY+UKjyPWlBj0lRVGy3s+J2VQreKZIGUWq7MFDMEBaW01yMyoC7iRwmikG0zaZo5BcTwE9s0FXPS7Hp+/2DO356rQquKsvy9NDWV2yuXlM4Eb0O8FbN4ieTnCheIAKWLNao9qKPm/gJdD6bfhQkHlMLE9QmouF7Mlq1geM/hpO2xU/oNciT2K2B0Wik1/cHYu4Jz3O9y80bNXCOAJfnCzRAeguUhxbF0e7eLwMyIUKeW1HRkoWS9QXzPTnmWQvoOkQMED5Q8UDnDUE0ytLVv6jtbTyae6IP8T2qczNhKbAymLWP4nwXp94IhVDv9wWcGWoBRHHD/Fr8NPn6/Q8lpFpqCKwEgCGLsjF+4umOs3nZJeS8Y8ilrSHV0kazPqq6J5BRQylsgR4z2rALXhmWWkt8CAZvES49/aYDTZXsDxRzksnaDcTqAnz5DLtkqPux8c4LuPDTjfE9rnq0ziFUpotJfH4WFdjthUSbOjMdjFSXCtWg0EyyC9DU+fWcNq6UaDMq7tExJn6fFt3J+vKmPkZog9p4wqhoc6Dwvf8vjOfw9w+RcXucNj7e+0kpPa4wZmHDg1sHK5FAVCBXRgndb8XB2boj4TmBkgW9+AsLIOr/X6m/TX1uxjiyz3AOvjNQODMcVqb1GKrtrQ83qRQoCEf+SpITbeQJsSrLcnbhOR2zVZnBU0pXc46ghRAI+phMzGf3NnjRYBLOEPK8DzOxMheqcqFF5DIF+dyRZIYkhEgpJiNmn7wGIokhlLXWzNlEeHKvyTm4f4o+sWsdgNWHuUx2RHlG2KYDfniSaGyIUMMb4Zz/k+F5pGpyKp263x6v9VaBOztNyv40RmqGsG3o30+SMQZvXBAQsdb/UaJVTRdaVHZ2sPY22HzS9WuPDaLnbuqnHWySUe+vIU/uCjbcxRIUPpylKfeQMjuLTHF+drHH9sC2tWlxxGRKJiFADY/nKFXTsqjLUpE2jsx3Qq6C8A6CQEuP2V1wCNNfpmamvG/wg6amzLOmESPh+D0P7FVwMuuHoRW7dXOP19JW79zDjaLWBqQsLGipXo9jpZa2tTuG742EQmtKZSpcU/+VEf3fmANhVDbHnJGpEa8zUnxVK+o8N4fFx/H2F/MSXl3VvrBzhqUUmIJHdNedyAcfvrARdc08WzL9U4+bgSt181jjEFP1tljiVsrOHFAzothz27a5xx6jhOfn8HVUVU12YkvUR6/c/DPXQKEi4VPkyIuDrMiqNA3pbz/tGV29j3N68QetLweWuKKEOjdjMpsMX8Sb6nt2VLgCd/VuHMK4Z44ZUK7z26wJ1Xj2N6ynGKHOvYjhR6XumrKpFkbBfAnjcrrD2mhc9dORXpb5wJhULh8dzPB9j0wwEmlxDZMM9JyC9VoGQmz7wgU0Bc089dfqRCPKApqqsutCRGrarTf8PhjT0Bu2cDdu8L2LOvxu69AbP7A3a8UeEXWyu86zCPr187jjWHNFtclvqoFUZkiRRKf6/fDdj1eoXf/PUObrtlBstnpIVH1aB5IydBB3zr6wvodym/Sy9AKG8qi1NPgOixk7XBfJ0ub2o2lJBVdY2YsK6MFiWfO9/jnSuBHz1HHuGFSmuKC5XH6uUOHz+jhdUrndQChSiBXtTEoLRHQFj1a47bibbDrxxR4twzx7Bh/QTKlvCHKLzyf+oSbX66j0f/vYtlU1K/MAFSdyceEIVXAxdxeVy5fwPtRxHd9vw0GqBqIn4zWhpw4akeF5769gmDeADFr1mOXq/urHkN8Nyzx3DGKR20yoBDVhQ4+siSFUVWr014fZCUTue9bsCXrtsfOQIxWxNamiAKiOwZojxPHmBr75a/Y2hpP988pMEHYsfT1u0TEaFTyvMCS9m9htTWpIwlMMWuw8JizV3do99Z4PNXTnHLK9UXQemz4/rBhmW84naYw99fuw/PbR5g5XTBniwIT9bWuHcS+8YraAAfGyIZBlgGyHd45fv4UsTZW+rGmB7KghoVQkqK/J1XeEiIlLRJWRQ+DzzSx8+2DHHqB9osfK9Xs9DkKZRdpAucApDcXsb2uOX6WTz0r4tYQcIPc0HT59QBSpmgsBCILa98BSfb0jKa7jMAOEhTJOmGU2C85BCoINEvyT9IwHbL49WdFW68bZ6Xu9afPcZ3m+KUPFiASQiQkkuP/ftr3PS3s3j4/i73Aql+sc4vC6+rQIL2Qs+NY6QQqG0zZEZYLC2mYowfokVN1n6dGg/NV8YPzF1iBORlFK36BLS956XuP/3sPjy7ZYDL/2QJjv3VEr2+FDK8yKrZIa0byvS//0gPt39pDttfqHiVF4NEm2PDU0tgvpZ7AdMXMUZpW1Kb+4GaqY8+twpgx96A+x4PuPjDsmB54GukX3DQl1yfXwDuf7SHm766gJdfGeIPf38c11wxxd91aO/BQV673qjw1BMDPPhvi3j6yT7GSoeZZbKIa2UyNb3yJqitBebub6tPnosj22010rsf3exEgDNRAld9o8aPX3B412rdB2xgl1Hf0CiEMseoA3r9gG3bK/xw0wAvbB1iqkMkyeOw1QW+9s0FDAeCFeIwAYNewK5dNV7ZWmHb80O8uaNmUrR0Uqo6WgITmptITlRAg1LnZMiIEODec8MwkDV4707+A4isCHJD2cNr3GDfHLi/Z3v4448Xsj38EiepEOLqTru8RaDdHeDtLrZldn6/LnHbhLlNpwQmAB3vMNFxGOPtNZrmaqvzpbYXzm/ARyWvl4YIdYbU/Rn4CFMqYGq5ly0yVqUdUMnZ6q4Bl94zM2E9xGztTxc045aavK1Of1wxxQWiqDULYJuj6G/QEje7byAl6IT1YAF0H7HsKpUmjVV4eakcra6rwlIP6DJYtkbA6Ri8P0CB1jYv5u2lvBoULsfnnJpG9vCyIEqWZHeJrjJn48adGrzzSyZgGxek2ySeZqFjz3FjNd/vo0JKw8QEVgVqt0iKH1sDlBTKy+r6TLBx6nwFuPGefpMTc79Z3RRkPXw+H21njVSPcQ9fanXbWLymb/1/29RgkKmNTRuLBVXrxx0m+lkENmVY7S/zEWtrb9BWiRxlgZGCJ+a9PLHlfEDBTP2hsTFRdpVJNWdPx21qWVPDWtP5ik+j4Zn176wFzoWN9fcyoDNhI+dXppkA0XoCTQLEPCAIdhxk5Tur+nWPsChKYzxH97h/37aqm+z2Sw7ZvGRa5x5c3IuUlBBbVBYWBlymuEx4Gyuv74X4pDTXYILWD8ja4zRKYVR49Fcdxg3invt8yUsVJCRPHshrBWNZ+R49UYLt5tYfRcR6Xy0c3Ta5dJ6/Zd/vCNjlxCcueCa2l1pgGQDGzpIVSEPMyq6w5q+wzOoNUIzu0uz0SFhkHlHTiq4InO4zr9ENSjHO841N2e5ui3PrBTZQPFlagC0Jb54Vd4pZqNiOttgPoI4AZn1ZYLPzLoQatS2CNmod3T3W7Asc+Puc5D1JKRbpRJnFYgZAI9iQub7EvY9gxc9yW1vW+HgME3KkwSkNDs0EVnXqWqARIG3X1y3XDq0xbPbTS4q7vVcCN7qwGWM73/HV3P0t7iwImoOhlMZpe0rc8q7tblaE9vxzJaTCJa3nC/iZp6QFTgNGi/0mC9TvOTukUNLUG8Y6hZte7e/2l52Iu8ar6qXalR6hrhq5P0+LI7/DaYBgrHnMve1HEhYu6RkWgq2bvKDJ3cVGOfhZLOdYkaq8xPIYX2zVV72uyPBEN01XnTDuy2WLL33w+rG7/PpT3NyvrQ4bx9tww8qT1ejHNHFPQEJ6Ke0E1LJd2FmhR90g04xpP+tfKCjmYKaWIU/ImhcpTpXi2q7UfLeH9fXVqSVsTNiMD+Rh4uraDT2mlpXu8BNaG1etcnN+3T2huPcvWg8dubS6dHJJUfD6bFVXrq5rrw3+tCaXOuGmBENzAzHpu0tvL63uNj8bykdeoCkt8QHL+SqAkRxz60wJcQ9BFh6p7CX8CYEQLtShKocTfmbpRLHs3d1LT7u+9dA99tNZ+yHxBTcNztz0mr9x74I/hnZXhD7F/PCAn6bJz+U0vrPr7K5VJUJZf5/v040NDcG02LGGJVmfOsuxdifg03U9vUZHrPz0fl7p5caGjNkiEmTFUXBooUDbjWGs5TE+Pdyy6vjqijO+MPYACb+efjwdiYsqIewMk+d8tbro1b1uXXehPrYahmn+hZmGgtefqsalNFvU1BpAhM8QXhUlCmgCmihAUnBUQixk6J2eSYqwvM9Iz5sfrApM7LDF7W651oILbef3Tky0Nk2vcfeed0dxp3Nu7h6EYr2sgOL/Aa5OuMdnE5sWAAAAAElFTkSuQmCC";
		//#endregion
		//#region src/client/plugin-icon.tsx
		const storageKey = "dsh-connect-trae.icon-style";
		const changeEvent = storageKey + ".changed";
		/**
		* Appearance is local to this browser; account and provider settings are untouched.
		*
		* THE DEFAULT IS THIS PLUGIN'S OWN ICON ('original'), not the Claude skin.
		*
		* This shipped the other way round at first — an unset preference read as
		* 'claude' — which meant every new user got a re-drawn silhouette before they
		* had asked for anything, and the plugin's own artwork was the option they had
		* to go find. A preference whose unset state is the non-default is a poor
		* default: it makes the product's identity something you have to opt back into.
		*
		* An explicit 'claude' in storage still wins, so anyone who already chose the
		* skin keeps it. Only the ABSENT case changed.
		*/
		function iconStyleSnapshot() {
			try {
				return window.localStorage.getItem(storageKey) === "claude" ? "claude" : "original";
			} catch {
				return "original";
			}
		}
		function subscribe(listener) {
			const onStorage = (event) => {
				if (event.key === storageKey || event.key === null) listener();
			};
			window.addEventListener(changeEvent, listener);
			window.addEventListener("storage", onStorage);
			return () => {
				window.removeEventListener(changeEvent, listener);
				window.removeEventListener("storage", onStorage);
			};
		}
		function setIconStyle(value) {
			window.localStorage.setItem(storageKey, value);
			window.dispatchEvent(new Event(changeEvent));
		}
		function PluginIcon(props) {
			const saved = (0, react.useSyncExternalStore)(subscribe, iconStyleSnapshot, () => "original");
			const variant = props.variant ?? saved;
			const shared = {
				className: props.className,
				width: props.size ?? 16,
				height: props.size ?? 16,
				style: {
					...props.style,
					flexShrink: 0
				},
				"aria-hidden": true
			};
			if (variant === "original") return (0, react.createElement)("img", {
				...shared,
				src: TRAE_PLUGIN_ICON,
				alt: ""
			});
			return (0, react.createElement)("svg", {
				...shared,
				viewBox: "0 0 24 24",
				fill: "currentColor",
				"data-icon-style": "claude",
				"data-plugin-icon": "trae"
			}, (0, react.createElement)("path", { d: "M4.5 5.5h3v11h3l3-3v4l-2 2h-7z" }), (0, react.createElement)("path", { d: "M10.5 5.5H15a7 7 0 0 1 0 14h-2v-3h2a4 4 0 0 0 0-8h-1.5v2l-3 3z" }));
		}
		/** Each choice previews the real icon and immediately persists its selection. */
		function IconStylePreference({ t }) {
			const selected = (0, react.useSyncExternalStore)(subscribe, iconStyleSnapshot, () => "original");
			const [error, setError] = (0, react.useState)(false);
			return (0, react.createElement)("div", { className: "dsm-icon-preference" }, (0, react.createElement)("div", { className: "dsm-icon-preference-copy" }, (0, react.createElement)("b", null, t("row.iconStyleLabel")), (0, react.createElement)("span", null, t("row.iconStyleHint"))), (0, react.createElement)("div", {
				className: "dsm-icon-choices",
				role: "radiogroup",
				"aria-label": t("row.iconStyleLabel")
			}, ...["claude", "original"].map((variant) => (0, react.createElement)("button", {
				key: variant,
				type: "button",
				role: "radio",
				"aria-checked": selected === variant,
				tabIndex: selected === variant ? 0 : -1,
				onKeyDown: (event) => {
					if (![
						"ArrowLeft",
						"ArrowRight",
						"ArrowUp",
						"ArrowDown",
						"Home",
						"End"
					].includes(event.key)) return;
					event.preventDefault();
					const next = event.key === "Home" ? "claude" : event.key === "End" ? "original" : variant === "claude" ? "original" : "claude";
					try {
						setIconStyle(next);
						setError(false);
						(event.currentTarget.parentElement?.querySelectorAll("[role=radio]")[next === "claude" ? 0 : 1])?.focus();
					} catch {
						setError(true);
					}
				},
				onClick: () => {
					try {
						setIconStyle(variant);
						setError(false);
					} catch {
						setError(true);
					}
				}
			}, (0, react.createElement)(PluginIcon, {
				variant,
				size: 20
			}), t(variant === "claude" ? "row.iconStyleClaude" : "row.iconStyleOriginal")))), error ? (0, react.createElement)("p", {
				role: "alert",
				className: "dsm-icon-save-error"
			}, t("row.iconStyleSaveFailed")) : null);
		}
		//#endregion
		//#region src/region.ts
		/** Every panel, in card tab order. */
		const TRAE_PANELS = [
			"cn",
			"enterprise",
			"ai"
		];
		/** The region whose credential/account pool a panel draws on. */
		function regionOfPanel(panel) {
			return panel === "ai" ? "ai" : "cn";
		}
		/** The provider id a panel publishes. */
		function providerOfPanel(panel) {
			if (panel === "enterprise") return "trae-enterprise";
			return panel === "ai" ? "trae-global" : "trae";
		}
		/** The panel that owns a provider id, or undefined for an unknown id. */
		function panelOfProvider(provider) {
			return TRAE_PANELS.find((panel) => providerOfPanel(panel) === provider);
		}
		//#endregion
		//#region src/status-paths.ts
		/** Plugin-owned usage endpoint consumed by its browser half. */
		const TRAE_USAGE_PATH = "/plugins/dsh-connect-trae/usage";
		/** Plugin-owned live model refresh endpoint. */
		const TRAE_MODELS_REFRESH_PATH = "/plugins/dsh-connect-trae/models/refresh";
		/**
		* Plugin-owned availability probe: POST the model ids to test, get one verdict
		* per model. Unlike every read-only sibling this route SPENDS quota — a real
		* (minimal) chat call per model — so it is user-initiated only, and the card
		* labels the button as consuming a small amount.
		*/
		const TRAE_MODELS_TEST_PATH = "/plugins/dsh-connect-trae/models/test";
		/** Plugin-owned local account rescan endpoint. */
		const TRAE_ACCOUNTS_REFRESH_PATH = "/plugins/dsh-connect-trae/accounts/refresh";
		/**
		* General balance of EVERY account in a region, for the composer panel's table.
		*
		* Separate from the usage route on purpose: the usage document backs the
		* 5-minute readout, and multiplying its upstream reads by the account count
		* would charge a healthy account for something it never looks at — the same
		* principle that keeps `creditAlternatives` firing only when a balance hits
		* zero. This one is paid when the panel is actually opened, which is the only
		* place the table is shown.
		*/
		const TRAE_ACCOUNT_CREDITS_PATH = "/plugins/dsh-connect-trae/account-credits";
		/**
		* Per-account status (check-in / credits / subscription) for the account table.
		*
		* Each row of the account table reads its OWN state through this route — a CN
		* row carries its check-in state and balance, an ai row its subscription.
		* POST with the accountId in the body: one upstream read per account, paid
		* only when the table is actually shown.
		*/
		const TRAE_ACCOUNT_STATUS_PATH = "/plugins/dsh-connect-trae/account-status";
		/**
		* Plugin-owned daily check-in claim endpoint. POST, loopback-only, and the only
		* route in this plugin that changes upstream account state. The accountId in
		* the body names WHICH account to claim for, so the button can sit in each
		* account row.
		*/
		const TRAE_CHECKIN_PATH = "/plugins/dsh-connect-trae/checkin";
		/**
		* Plugin-owned account-pool endpoint: one route for the pool's batch actions.
		*
		* 参考：`dsh-connect-workbuddy` 的 `WORKBUDDY_POOL_PATH`。本路由与该实现同形
		*   （同一 `?action=` 风格、POST、loopback-only、per-row `accountId`），这样同时
		*   装了两个插件的用户面对的是同一套交互。
		*
		* `?action=checkin` and `?action=test` run over the whole member set; `remove`
		* addresses ONE account (the body carries `accountId`) and is the only way a
		* measurement of an account the user no longer wants can leave the store — a
		* deleted member otherwise keeps its row in the file forever, and a re-added
		* member would silently inherit an old exclusion.
		*
		* POST + loopback-only because both batches SPEND something: check-in sends a
		* claim, and a test is a real chat call. A page that is not the Host's own
		* loopback must not be able to trigger either.
		*/
		const TRAE_POOL_PATH = "/plugins/dsh-connect-trae/pool";
		/** Query parameter selecting which pool batch action a request means. */
		const TRAE_POOL_ACTION_PARAM = "action";
		/** Query parameter naming ONE pool account a per-row request addresses. */
		const TRAE_POOL_ACCOUNT_PARAM = "accountId";
		/**
		* Address one panel's pool route with its action.
		*
		* Kept as its own helper (rather than a `withTraeRegion` + hand-appended
		* `&action=`) because a missing action parameter means "no action", not a
		* default one — the typo has to be impossible rather than merely unlikely.
		*/
		function withTraePoolAction(panel, action) {
			return `${TRAE_POOL_PATH}?${TRAE_REGION_PARAM}=${panel}&${TRAE_POOL_ACTION_PARAM}=${action}`;
		}
		/**
		* Address one panel's pool route for ONE account, e.g. a row's Test or Remove.
		*
		* Kept beside {@link withTraePoolAction} for the same reason that one exists: the
		* account id is a 24-char hex string, and hand-appending `&accountId=` at a call
		* site is one typo away from a request the route answers 400 to — or worse, from
		* one that addresses the wrong action. Both parameters are therefore spelled by
		* this module and nowhere else.
		*/
		function withTraePoolAccount(panel, action, accountId) {
			return `${withTraePoolAction(panel, action)}&${TRAE_POOL_ACCOUNT_PARAM}=${encodeURIComponent(accountId)}`;
		}
		/**
		* Plugin-owned account transfer endpoint: batch export and import of a region's
		* stored credentials (issue #37).
		*
		* One route with an `action` query parameter (`export` | `preview` | `import`),
		* mirroring the sibling `dsh-connect-workbuddy` plugin's transfer route so the
		* two cards behave the same way for a user who has both installed. The vault
		* document never leaves the Host: the browser receives parsed answers, and a
		* preview carries display fields only — never token material.
		*/
		const TRAE_TRANSFER_PATH = "/plugins/dsh-connect-trae/transfer";
		/** Query parameter naming the region a card request addresses. */
		const TRAE_REGION_PARAM = "region";
		/**
		* Address one region's status route. The two regions are separate provider
		* stacks; every card request carries the region whose tab the user is on.
		*/
		function withTraeRegion(path, panel) {
			return `${path}?${TRAE_REGION_PARAM}=${panel}`;
		}
		/**
		* Address one region's transfer route with its step, e.g.
		* `/plugins/dsh-connect-trae/transfer?region=cn&action=export`.
		*
		* Separate from {@link withTraeRegion} because this route carries a second
		* query parameter: a caller that appended `&action=` by hand would be one typo
		* away from a 400, which is exactly the failure the sibling workbuddy plugin
		* hit (#42) when five requests dropped that parameter.
		*/
		function withTraeTransferAction(path, panel, action) {
			return `${path}?${TRAE_REGION_PARAM}=${panel}&action=${action}`;
		}
		/** Query parameter asking for a thinner first-paint document (issue #77). */
		const TRAE_DETAIL_PARAM = "detail";
		/** The only recognised `detail` value: local state only, no upstream read. */
		const TRAE_DETAIL_FAST = "fast";
		/**
		* Address one panel's usage route asking for the FAST document, e.g.
		* `/plugins/dsh-connect-trae/usage?region=cn&detail=fast`.
		*
		* Kept beside {@link withTraeRegion} for the same reason as
		* {@link withTraeTransferAction}: the region is already a parameter, so a caller
		* appending `&detail=` by hand is one typo away from a request that silently
		* asks for the wrong document.
		*/
		function withTraeRegionFastDetail(path, panel) {
			return `${withTraeRegion(path, panel)}&${TRAE_DETAIL_PARAM}=${TRAE_DETAIL_FAST}`;
		}
		/**
		* Peel ONE `{get(): T}` live reference, the shape DSH 0.1.7 delivers a
		* volatile-marked settings field as (see {@link unwrapVolatileDeep}).
		*/
		function unwrapVolatile(value) {
			if (value !== null && typeof value === "object" && typeof value.get === "function") return value.get();
			return value;
		}
		/**
		* Deep copy of a value with every `{get(): T}` live reference replaced by the
		* value it resolves to.
		*
		* DSH 0.1.7 hands volatile-marked fields back as live references, and a live
		* reference is still `typeof === 'object'` — so it passes a naive object check
		* and every lookup on it is `undefined`. Worse, spreading one (`{ ...ref }`)
		* does NOT read the field: it produces `{ get: <function> }`. Any merge that
		* spreads a resolved field to preserve its siblings — the card's "write one
		* region, keep the other" write, or the account map's spread — would otherwise
		* DROP every sibling and leak a function into the document.
		*
		* Both halves therefore unwrap before touching a resolved field. This lives in
		* the node-free host↔client bridge because the browser half needs it too.
		*
		* Non-reference values are recursed into so a nested volatile field is caught
		* as well; arrays and objects are rebuilt rather than mutated, so the caller's
		* value is never touched.
		*/
		function unwrapVolatileDeep(value) {
			if (value === null || typeof value !== "object") return value;
			if (typeof value.get === "function") return unwrapVolatileDeep(value.get());
			if (Array.isArray(value)) return value.map((entry) => unwrapVolatileDeep(entry));
			const source = value;
			const out = {};
			for (const key of Object.keys(source)) out[key] = unwrapVolatileDeep(source[key]);
			return out;
		}
		/**
		* Read the per-region account selections out of a settings value.
		*
		* SHARED because `accounts` now has TWO writers: the card, and the composer
		* panel's account table (2.14.0). Two writers of one field must use one merge
		* rule, or they drift — and the rule is not obvious.
		*
		* Deep-unwraps first: on DSH 0.1.7 a volatile field arrives as a `{get(): T}`
		* live reference, which passes the `typeof === 'object'` check and would be
		* returned as if it were the map. Every lookup on it is then `undefined`, and
		* the merge (`{ ...configured, [region]: id }`) would spread a reference into
		* `{get: <function>}` — dropping the other region's selection and leaking a
		* function into the settings document.
		*/
		function configuredAccountsOf(configured) {
			const accounts = unwrapVolatileDeep(configured)?.accounts;
			return typeof accounts === "object" && accounts !== null ? accounts : {};
		}
		/**
		* Build the next `regions` settings value for the card's save. The write
		* targets ONLY the signed-in account's region slot; every other region's slot
		* is carried over untouched, so switching accounts never clobbers the other
		* region's picks. Tolerates any stored shape (absent, non-object) by starting
		* from an empty document.
		*/
		function nextRegionSlots(regions, panel, slot) {
			const unwrapped = unwrapVolatileDeep(regions);
			return {
				...typeof unwrapped === "object" && unwrapped !== null && !Array.isArray(unwrapped) ? unwrapped : {},
				[panel]: slot
			};
		}
		/**
		* Narrow a settings value to the `regions` map. Accepts EITHER the whole
		* settings section (`{ regions: {...}, ... }`) or the `regions` map itself, and
		* unwraps the former. This tolerance is deliberate: passing the whole section
		* where the map was expected was a real shipped bug — the lookup then read
		* `section['cn']` (absent), so the card's checkbox reported `true` forever and
		* clicking it appeared to do nothing even though the write succeeded.
		*
		* Unwraps live references first: on DSH 0.1.7 the `regions` field arrives as a
		* `{get(): T}` reference, which passes the `typeof === 'object'` check below
		* and would otherwise be returned as if it were the map — making every region
		* read back as absent (and the enabled flag read as "on" forever).
		*/
		function regionsMapOf(value) {
			const unwrapped = unwrapVolatileDeep(value);
			if (typeof unwrapped !== "object" || unwrapped === null || Array.isArray(unwrapped)) return {};
			const record = unwrapped;
			const nested = record["regions"];
			if (typeof nested !== "object" || nested === null || Array.isArray(nested)) return record;
			const panelIds = TRAE_PANELS;
			return Object.keys(record).some((key) => panelIds.includes(key)) ? record : nested;
		}
		/** One region's stored slot as a plain object; any other shape reads as empty. */
		function regionSlotOf(value, panel) {
			const slot = unwrapVolatile(regionsMapOf(value)[panel]);
			return typeof slot === "object" && slot !== null && !Array.isArray(slot) ? slot : {};
		}
		/**
		* Whether one region's provider is switched on. Opt-out semantics: only an
		* explicit `false` disables it, so a config written before this switch existed
		* (and the pre-region-split flat fields, which never carry `enabled`) keep both
		* providers running exactly as before. The Host reads the same rule through
		* `regionStateOf`, so card and Host can never disagree about a region's state.
		*
		* `value` may be the whole settings section or the `regions` map (see
		* {@link regionsMapOf}).
		*/
		function regionEnabledOf(value, panel) {
			const stored = regionSlotOf(value, panel)["enabled"];
			if (typeof stored === "boolean") return stored;
			return panel !== "enterprise";
		}
		/**
		* Build the next `regions` settings value for a provider on/off toggle. ONLY
		* the target region's `enabled` flag changes: every other field of that slot
		* (its directory, selection, image opt-ins, context budgets) and every other
		* region's slot are carried over verbatim, so switching a provider off never
		* discards the user's model picks and switching it back on restores them.
		*
		* This is deliberately separate from {@link nextRegionSlots}: that helper
		* writes a whole slot from a signed-in tab's draft, while this one must work
		* for a region that is signed OUT — which is precisely the region a user wants
		* to switch off (no international install, no international account).
		*
		* `value` may be the whole settings section or the `regions` map; the RETURN
		* value is always the `regions` map, i.e. exactly what `settingsScope.set(
		* 'regions', ...)` needs.
		*/
		function nextRegionEnabled(value, panel, enabled) {
			return nextRegionSlots(regionsMapOf(value), panel, {
				...regionSlotOf(value, panel),
				enabled
			});
		}
		/**
		* Which seat one region's readout uses, defaulting to the composer row.
		*
		* Anything other than an explicit `'stats'` reads as `'composer'`, which covers
		* the two cases that matter: a profile written BEFORE this setting existed (the
		* composer row was the only seat, so an upgrade moves nothing on screen), and a
		* hand-edited value the schema does not know. Falling back rather than
		* rendering nowhere is deliberate — an unrecognized value must not make the
		* readout disappear, which is the very defect this setting exists to fix.
		*
		* `value` may be the whole settings section or the `regions` map (see
		* {@link regionsMapOf}).
		*/
		function regionCreditPositionOf(value, panel) {
			return regionSlotOf(value, panel)["creditPosition"] === "stats" ? "stats" : "composer";
		}
		/**
		* Build the next `regions` settings value for one region's credit seat.
		*
		* Same merge rule as every sibling region write: only the target region's
		* `creditPosition` changes, so a seat change cannot drop that slot's model
		* directory, selection, budgets or enabled flag, nor touch the other region.
		*
		* `value` may be the whole settings section or the `regions` map; the RETURN
		* value is always the `regions` map, i.e. exactly what `settingsScope.set(
		* 'regions', ...)` needs.
		*/
		function nextRegionCreditPosition(value, panel, position) {
			return nextRegionSlots(regionsMapOf(value), panel, {
				...regionSlotOf(value, panel),
				creditPosition: position
			});
		}
		/**
		* The automatic-refresh cadences this plugin offers, in MINUTES.
		*
		* The list is the setting's whole value domain: the schema validates against
		* exactly these, so a hand-edited `7` is refused at write time instead of
		* silently producing a cadence nobody chose. `1` is the floor because every
		* usage read costs two upstream requests and a tighter loop would turn a
		* background refresh into traffic the user never asked for.
		*/
		const TRAE_REFRESH_INTERVAL_MINUTES = [
			1,
			5,
			10,
			30,
			60
		];
		const REFRESH_INTERVAL_SET = new Set(TRAE_REFRESH_INTERVAL_MINUTES);
		/**
		* How often the plugin refreshes on its own, in minutes.
		*
		* Anything that is not one of {@link TRAE_REFRESH_INTERVAL_MINUTES} reads as
		* the default — absent (a profile written before the setting existed), a
		* hand-edited `7`, a string `'5'`, or a live reference that resolves to none of
		* those. Falling back rather than refusing to refresh is deliberate: a readout
		* that stops updating because of an unrecognized value is the failure this
		* setting must never introduce, and the schema already refuses such a value on
		* the write path.
		*
		* `value` is the whole settings section (this field is plugin-wide, not
		* per-region — see `Config.refreshIntervalMinutes`).
		*/
		function refreshIntervalMinutesOf(value) {
			const stored = unwrapVolatileDeep(value)?.refreshIntervalMinutes;
			return typeof stored === "number" && REFRESH_INTERVAL_SET.has(stored) ? stored : 5;
		}
		/** The same cadence as a millisecond period, for `setInterval`. */
		function refreshIntervalMsOf(value) {
			return refreshIntervalMinutesOf(value) * 6e4;
		}
		/**
		* One panel's saved pool PREFERENCES, as the card's settings block edits them.
		*
		* Read from the settings document rather than from the usage answer for the same
		* reason `regionCreditPositionOf` is: the card must paint its controls correctly
		* on the FIRST frame, before any fetch lands, and a control that starts on a
		* default and jumps when data arrives is the "looks like it did nothing" defect.
		*
		* Absent reads as `{}` — every field of {@link TraePoolPreferences} is optional
		* by design, and a profile written by an older build has no `pool` slot at all.
		* The caller applies the defaults it means (OFF, automatic model, no members);
		* this function never invents them, because `targetModelId: ''` and
		* `targetModelId: undefined` mean the same thing and only the CALLER may decide
		* to collapse them.
		*
		* `value` may be the whole settings section or the `regions` map (see
		* {@link regionsMapOf}).
		*/
		function regionPoolOf(value, panel) {
			const unwrapped = unwrapVolatileDeep(regionSlotOf(value, panel)["pool"]);
			return typeof unwrapped === "object" && unwrapped !== null && !Array.isArray(unwrapped) ? unwrapped : {};
		}
		/**
		* Build the next `regions` settings value for one panel's pool preferences.
		*
		* Same merge rule as every sibling region write: only the addressed panel's
		* `pool` slot changes, so saving the pool cannot drop that slot's model
		* directory, selection, budgets, enabled flag or credit seat, and cannot touch
		* the other panels. Panels are independent even where they share credentials
		* (`cn` and `enterprise` bill the same Trae CN account): membership is a choice
		* per panel, not per credential.
		*
		* `value` may be the whole settings section or the `regions` map; the RETURN
		* value is always the `regions` map, i.e. exactly what `settingsScope.set(
		* 'regions', ...)` needs.
		*/
		function nextRegionPool(value, panel, pool) {
			return nextRegionSlots(regionsMapOf(value), panel, {
				...regionSlotOf(value, panel),
				pool
			});
		}
		/**
		* Panels whose text-to-image path this plugin has actually MEASURED, in
		* `TRAE_PANELS` tab order.
		*
		* ONE entry today. The other two are refused for the SAME reason — no evidence
		* — which is exactly the asymmetry the review of #62 held the PR on:
		*
		*  - `enterprise` bills through the tenant gateway, a second billing surface
		*    whose image behaviour has never been probed;
		*  - `ai` answers on `coresg-normal.trae.ai`, where no `tool_text_to_image`
		*    request has ever run either — every measurement behind this tool was
		*    taken against `trae-api-cn.mchost.guru`. Refusing one unverified gateway
		*    while serving another is not a rule, it is an accident.
		*
		* Adding a panel means adding its evidence in the same change (the precedent
		* for international claims is `docs/INTL_SG_EVIDENCE.md`). Order is
		* significant: the tool's resolver walks `TRAE_PANELS` order and takes the
		* FIRST consenting panel, so `cn` — the only measured one — always answers
		* first.
		*/
		const DRAW_IMAGE_PANELS = ["cn"];
		/**
		* Build the next `regions` settings value for one panel's 「允许模型自主生图」
		* switch (`drawImageEnabled`, `trae_draw_image`).
		*
		* Same merge rule as every sibling region write: only the addressed panel's
		* `drawImageEnabled` changes, so flipping the switch carries that slot's model
		* directory, selection, budgets, pool and credit seat through, and leaves the
		* other panels alone. The flag is a PANEL's consent, not the account's: cn and
		* enterprise bill the same Trae CN account but route through different gateways,
		* so consent must not cross the boundary (the tool resolver reads it per panel).
		*
		* `value` may be the whole settings section or the `regions` map; the RETURN
		* value is always the `regions` map, i.e. exactly what `settingsScope.set(
		* 'regions', ...)` needs.
		*/
		function nextRegionDrawImage(value, panel, enabled) {
			return nextRegionSlots(regionsMapOf(value), panel, {
				...regionSlotOf(value, panel),
				drawImageEnabled: enabled
			});
		}
		/**
		* Build the next `regions` settings value for one panel's MODEL DIRECTORY.
		*
		* The model-directory save REPLACES the whole region slot, so every field of
		* that slot must be carried through — the ones the save does not name are
		* silently dropped. Two were being dropped this way:
		*
		*  - `pool` (issue #44): the account-pool preferences. Enabling the pool and
		*    then saving the model list turned the pool back OFF, and the card came
		*    back showing "not saved" — the switch looked broken.
		*  - `creditPosition`: which seat this region's credit readout occupies, so
		*    saving the model list silently moved the readout back.
		*
		* Both are the user's standing choices, not the model directory's business.
		* The stored slot is therefore SPREAD and the directory fields override it, so
		* the save owns exactly the five fields it knows about and inherits the rest.
		*
		* `value` may be the whole settings section or the `regions` map; the RETURN
		* value is always the `regions` map, i.e. exactly what `settingsScope.set(
		* 'regions', ...)` needs.
		*/
		function nextRegionDirectory(value, panel, directory) {
			return nextRegionSlots(regionsMapOf(value), panel, {
				...regionSlotOf(value, panel),
				...directory
			});
		}
		/**
		* Whether Trae's plan identity says this account is on a paying plan.
		*
		* `has_package` alone is NOT that question — it reports whether a package
		* entitlement row exists, and a member can be on a plan without one (issue
		* #19: a Pro account rendered as "No active package"). Trae spells the plan in
		* `user_pay_identity_str`, so this reads that field, and only the exact word
		* `Free` counts as free: an unknown or future tier name is treated as paid,
		* because claiming "Free" for a tier we simply do not recognise is the more
		* damaging of the two errors.
		*/
		function traePlanIsPaid(payIdentityStr) {
			const tier = payIdentityStr?.trim();
			return tier !== void 0 && tier !== "" && !/^free$/i.test(tier);
		}
		//#endregion
		//#region src/context-budget.ts
		/**
		* Context-budget arithmetic shared by the HOST (which applies a saved budget to
		* the catalog DSH is told about) and the CLIENT card (which renders the radios).
		*
		* It lives in its own module because the client bundle cannot import
		* `catalog.ts` (host-only) and the two sides must agree EXACTLY on which
		* windows are selectable: a card that offers a window the host then refuses
		* would be a control that silently does nothing.
		*/
		/**
		* The one intermediate budget the card offers, in tokens: 500K.
		*
		* WHY IT EXISTS: Trae advertises a dev window (typically 200K/256K/272K) and a
		* Max window (typically 1M). Switching dev→Max is a 5× jump for a user who
		* just wants more room without paying Max-tier pricing for the whole session.
		* 500K is the half-way point, and it is only ever offered for a model whose
		* Max window is at least that wide.
		*
		* WHY A CONSTANT AND NOT A PER-MODEL VALUE: this is a LOCAL preference that
		* DSH uses to decide when to compress; it is not a Trae-advertised window. The
		* value must be sane for every model that can select it, so eligibility is
		* gated on `maxContextWindow >= 500000` rather than inventing a window per
		* model. `applyContextBudgets` additionally refuses any budget wider than what
		* the model advertises, so a stale saved value cannot overflow a shrunken Max.
		*/
		const TRAE_CONTEXT_BUDGET_MID = 5e5;
		/**
		* The selectable windows for one model, smallest first: dev, then 500K (only
		* when it is a genuine middle step), then Max. Duplicates are dropped so a
		* model whose dev window is already 500K offers it once.
		*
		* A model with no Max window yields exactly one option — its dev window — which
		* is what makes the card's radios read-only for such models.
		*/
		function contextBudgetOptions(model) {
			const dev = model.contextWindow;
			const max = model.maxContextWindow;
			const options = [];
			const push = (value) => {
				if (value === void 0 || value < 1) return;
				if (!options.includes(value)) options.push(value);
			};
			push(dev);
			if (max !== void 0 && max >= 5e5 && (dev === void 0 || 5e5 > dev)) push(TRAE_CONTEXT_BUDGET_MID);
			push(max);
			return options.sort((left, right) => left - right);
		}
		//#endregion
		//#region src/reasoning.ts
		/**
		* The DSH thinking levels this plugin can carry, in ascending order.
		*
		* `max` is the fifth level Trae's own client advertises — its bundle ships the
		* i18n keys `trae-chat-core.model.reasoning_effort.{low,medium,high,extra_high,max}`
		* and `ai.model.reasoning_effort.{low,medium,high,xhigh,max}`, and publishes the
		* per-model list from a remote config (`AI.agent.model.reasoning_effort_level_by_agent_model_v2`).
		* Leaving it out of this list meant a level the vendor could start serving was
		* filtered away at PARSE time, before anything downstream could decide (issue
		* #60). Listing it does not fabricate the level: `supported` is still built
		* only from what the upstream response actually contains, so a model that does
		* not advertise `max` never offers it.
		*
		* `minimal` is kept for the same reason in reverse — it is a DSH level, so the
		* type must be able to represent it even though no CN model has advertised it.
		*/
		const TRAE_REASONING_EFFORTS = [
			"minimal",
			"low",
			"medium",
			"high",
			"xhigh",
			"max"
		];
		//#endregion
		//#region src/default-effort.ts
		/**
		* Which thinking level a model runs at when the caller names none.
		*
		* ## Why this module exists
		*
		* Trae's directory already tells us each model's own default level
		* (`reasoning_effort_config.default_level`, parsed into `reasoning.defaultEffort`
		* by `model-metadata.ts`) — measured 2026-11-03 on a live CN credential:
		* `deepseek-v4.1-flash` says `high`, `glm-5.3` says `xhigh`. The card's meta row
		* names the tiers it accepts, so the fact is known.
		*
		* DSH's model picker nevertheless reads **Default**, because the adapter never
		* reports that level upward (`reasoning.defaultEffort` is absent from what
		* {@link toPiModel} hands the kernel). The picker therefore cannot say which
		* tier a request will run at, and the request itself carries no
		* `reasoning_effort` — the upstream falls back to the same level it already
		* published, so nothing is broken, but nothing is knowable either, and the user
		* has no way to say "always use high on this model, regardless of what Trae
		* ships as its default".
		*
		* ## The three seams that must agree (any one missing and the picker still says Default)
		*
		* 1. **The adapter** must report the level as `LlmResolvedModelInfo.reasoning.defaultEffort`.
		*    The kernel materialises that into every request that names no effort
		*    (`dsh-llm` `resolveCallWithInfo`: `const effective = requested ?? reasoning.defaultEffort`),
		*    and DSH's model picker takes its "current level" from the same metadata.
		* 2. **A per-model saved choice** must survive a settings save. The settings
		*    channel rebuilds the whole region document through its schema, so a field
		*    absent from that schema is dropped on every save — the failure that once
		*    reset `wireConfigName` (see the `modelConfig` schema).
		* 3. **The bridge** must translate the level it receives into Trae's wire name.
		*    `solo-bridge.ts` already does exactly that through the model's own
		*    `reasoningEfforts` table, and deletes the field when the model does not
		*    advertise it — so a level is never sent under a name the vendor never said.
		*
		* ## Precedence
		*
		* The user's explicit choice > the level upstream declares > this model's own
		* middle tier.
		*
		* @module dsh-connect-trae/default-effort
		*/
		/**
		* The tier to fall back to when a model publishes a tier list but names no
		* default of its own and the user has never chosen one.
		*
		* `medium` is tried first because it is the only middle tier shared by the
		* families seen so far. It is deliberately not the only fallback: a model that
		* publishes `low / high` (measured on `Doubao-Seed-2.1-Pro` and
		* `step-5-preview`) has no `medium` at all, and picking its weakest tier instead
		* would silently mean "thinking off" — that is not a fallback, that is the worst
		* possible default.
		*/
		const TRAE_FALLBACK_EFFORT = "medium";
		/**
		* The tiers a model actually declares, filtered to ones DSH can name.
		*
		* Upstream's vocabulary is not DSH's: Trae publishes `light / high / extra_high`
		* and the parser maps them to `low / high / xhigh` (`EFFORT_MAP`). Anything that
		* still fails to land in DSH's six names is dropped rather than passed through —
		* a level the kernel cannot name would be rejected with
		* `UNSUPPORTED_REASONING_EFFORT` and take the whole request with it.
		*
		* The result keeps `TRAE_REASONING_EFFORTS` order, so it reads weakest-first.
		*/
		function declaredEfforts(model) {
			const supported = model.supported ?? [];
			return TRAE_REASONING_EFFORTS.filter((level) => supported.includes(level));
		}
		/**
		* The tier this model should run at when a request names none.
		*
		* @param model - the model, with the tiers it declares and its upstream default.
		* @param saved - the user's per-model choices (model id -> tier). A missing key
		*   means the user never chose, which is different from choosing the tier that
		*   happens to equal the upstream default.
		* @returns a tier **this model declares**, or `undefined` when it declares none.
		*/
		function defaultEffortFor(model, saved = {}) {
			const declared = declaredEfforts(model);
			if (declared.length === 0) return void 0;
			const asked = saved[model.id];
			const chosen = declared.find((level) => level === asked);
			if (chosen !== void 0) return chosen;
			const upstream = declared.find((level) => level === model.defaultEffort);
			if (upstream !== void 0) return upstream;
			if (declared.includes("medium")) return TRAE_FALLBACK_EFFORT;
			return declared[Math.floor((declared.length - 1) / 2)];
		}
		//#endregion
		//#region src/model-order.ts
		/**
		* Wire name of the default SOLO chat function.
		*
		* Lives here rather than in `solo.ts` so this module stays importable from the
		* client; `solo.ts` re-exports it, so there is still exactly one definition.
		*/
		const TRAE_SOLO_FUNCTION = "solo_work_lite";
		/**
		* The chat functions of one region, in PRIORITY order.
		*
		* Two consumers read it, and both mean "priority", which is why they can share
		* one array: the wire asks these functions in order and the first to list a
		* config owns it (`solo.ts`), and the card draws the groups in the same order so
		* the row a user sees first is the one the resolver prefers.
		*/
		const TRAE_CHANNEL_PRIORITY = {
			cn: [
				"solo_work_remote",
				TRAE_SOLO_FUNCTION,
				"solo_agent_remote",
				"chat_v3",
				"solo_coder"
			],
			ai: [
				"solo_work_remote",
				TRAE_SOLO_FUNCTION,
				"solo_agent_remote",
				"chat_v3"
			]
		};
		/**
		* Rank of one channel inside the region's priority list.
		*
		* Three cases, and the order between them is deliberate:
		*
		*  - a known chat channel: its index in the priority list;
		*  - an UNKNOWN channel name (a function the region does not call through —
		*    `withChatCallableFunctions` clears those, so this is a defensive branch):
		*    after every known channel, then alphabetically among themselves;
		*  - NO channel at all (a row demoted to the default chat function): last. Such
		*    a row is the one the resolver knows least about, so it must not push a
		*    properly attributed row down the list.
		*/
		function channelRank(channel, priority) {
			if (channel === void 0 || channel === "") return priority.length + 1;
			const known = priority.indexOf(channel);
			return known === -1 ? priority.length : known;
		}
		/**
		* Compare two display names the way a person reading a model list expects:
		* case-insensitively, with embedded numbers compared as NUMBERS, so `GLM-5.10`
		* sorts after `GLM-5.9`. Plain text comparison puts `5.10` first, which reads as
		* a bug to anyone who sees the version numbers.
		*/
		function compareNames(left, right) {
			const byName = left.trim().localeCompare(right.trim(), void 0, {
				numeric: true,
				sensitivity: "base"
			});
			return byName !== 0 ? byName : left.localeCompare(right);
		}
		/**
		* The catalog in display order: channel priority first, then name.
		*
		* Total and stable — ties fall through to `id`, so two rows with the same name
		* in the same channel still get one fixed order rather than the order they
		* arrived in.
		*/
		function orderTraeModels(rows, region = "cn") {
			const priority = TRAE_CHANNEL_PRIORITY[region] ?? TRAE_CHANNEL_PRIORITY.cn;
			return [...rows].sort((left, right) => {
				const byRank = channelRank(left.wireFunction, priority) - channelRank(right.wireFunction, priority);
				if (byRank !== 0) return byRank;
				if (left.wireFunction !== right.wireFunction) return (left.wireFunction ?? "").localeCompare(right.wireFunction ?? "");
				const byName = compareNames(left.name, right.name);
				return byName !== 0 ? byName : left.id.localeCompare(right.id);
			});
		}
		/**
		* Split rows into channel groups, in display order.
		*
		* Ordering is re-applied here rather than trusted from the caller: a group list
		* built from an unsorted input would put the groups in arrival order, which is
		* the exact instability this module exists to remove.
		*/
		function groupTraeModels(rows, region = "cn") {
			const groups = [];
			const byChannel = /* @__PURE__ */ new Map();
			for (const row of orderTraeModels(rows, region)) {
				const channel = row.wireFunction === "" ? void 0 : row.wireFunction;
				const key = channel ?? "\0default";
				const existing = byChannel.get(key);
				if (existing !== void 0) {
					existing.rows.push(row);
					continue;
				}
				const group = {
					channel,
					rows: [row]
				};
				byChannel.set(key, group);
				groups.push(group);
			}
			return groups;
		}
		/**
		* Does one row match a search query?
		*
		* Matches the display name, the display id and the WIRE config name — the last
		* one because a user debugging a `4001 config_name rejected` arrives with the
		* upstream name in hand, and the two differ exactly on the rows that carry a
		* suffix (`DeepSeek-V4-Flash` vs `DeepSeek-V4-Flash-Official`).
		*/
		function traeModelMatchesQuery(model, query) {
			const needle = query.trim().toLowerCase();
			if (needle === "") return true;
			if (model.name.toLowerCase().includes(needle)) return true;
			if (model.id.toLowerCase().includes(needle)) return true;
			return (model.wireConfigName ?? "").toLowerCase().includes(needle);
		}
		/** Filter by {@link traeModelMatchesQuery}, preserving order. */
		function filterTraeModels(rows, query) {
			if (query.trim() === "") return [...rows];
			return rows.filter((row) => traeModelMatchesQuery(row, query));
		}
		/**
		* The channels a NORMAL Trae chat session actually runs on: the `solo_work_*`
		* family, i.e. the panel's own chat modes.
		*
		* Deliberately not "every channel we can call". After issue #52 P1 the catalog
		* is 34 rows and 10 of them are reachable only through a SPECIALIST channel:
		* `solo_coder` (7: `Doubao-Seed-2.0-Code`, `glm-5.1`, `glm-5v-turbo`,
		* `kimi-k2.5`, `minimax-m2.7`, `qwen-3.5`, `qwen-3.6-plus`), `chat_v3` (2:
		* `kimi-k2.8-preview`, `qwen3.8-flash`) and `solo_agent_remote` (1:
		* `Doubao-Seed-Code`). Measured 2026-10-23 on a live CN account. Those rows work
		* — that is why P1 kept them — but they are not what Trae's main chat offers,
		* and mixing them into the default view is exactly the "a code model answering a
		* solo request" shape issue #52 asked about.
		*/
		const TRAE_COMMON_FUNCTIONS = {
			cn: ["solo_work_remote", TRAE_SOLO_FUNCTION],
			ai: ["solo_work_remote", TRAE_SOLO_FUNCTION]
		};
		/**
		* The function a request for this row will NAME.
		*
		* A row with no `wireFunction` is not "unknown to the wire": the bridge sends
		* the region default (`TRAE_SOLO_FUNCTION`), so for every question about where
		* the turn goes, the default is the answer. The distinction still matters for
		* DISPLAY (`groupTraeModels` keeps these in their own group, because their
		* provenance — which directory group advertised them — really is unknown), but
		* not for scope: a `solo_work_lite` turn is a normal chat turn either way.
		*/
		function traeModelCallChannel(model) {
			const channel = model.wireFunction;
			return channel === void 0 || channel === "" ? TRAE_SOLO_FUNCTION : channel;
		}
		/**
		* Does this row belong to the view?
		*
		* Judged on {@link traeModelCallChannel}, never on `wireFunction` directly:
		* otherwise the one row without a function (`doubao_1_8`, measured 2026-10-23)
		* would fall OUT of the common view while being called through exactly the
		* common channel it belongs to.
		*/
		function traeModelInView(model, view, region = "cn") {
			if (view === "all") return true;
			return (TRAE_COMMON_FUNCTIONS[region] ?? TRAE_COMMON_FUNCTIONS.cn).includes(traeModelCallChannel(model));
		}
		/** Keep the rows a view asks for, preserving order. */
		function scopeTraeModels(rows, view, region = "cn") {
			if (view === "all") return [...rows];
			return rows.filter((row) => traeModelInView(row, view, region));
		}
		//#endregion
		//#region src/promo.ts
		/** Zone used when upstream omits `off_peak.time_zone` (CN accounts). */
		const TRAE_PROMO_DEFAULT_TIME_ZONE = "Asia/Shanghai";
		const WEEKDAY_INDEX = {
			Mon: 1,
			Tue: 2,
			Wed: 3,
			Thu: 4,
			Fri: 5,
			Sat: 6,
			Sun: 7
		};
		/** Wall clock in one named zone: ISO weekday (1–7) plus minutes since midnight. */
		function zonedClock(now, timeZone) {
			let parts;
			try {
				parts = new Intl.DateTimeFormat("en-US", {
					timeZone,
					weekday: "short",
					hour: "2-digit",
					minute: "2-digit",
					hourCycle: "h23"
				}).formatToParts(now);
			} catch {
				return;
			}
			let isoWeekday;
			let hour;
			let minute;
			for (const part of parts) if (part.type === "weekday") isoWeekday = WEEKDAY_INDEX[part.value];
			else if (part.type === "hour") hour = Number.parseInt(part.value, 10);
			else if (part.type === "minute") minute = Number.parseInt(part.value, 10);
			if (isoWeekday === void 0 || hour === void 0 || minute === void 0) return void 0;
			if (!Number.isFinite(hour) || !Number.isFinite(minute)) return void 0;
			return {
				isoWeekday,
				minutes: hour % 24 * 60 + minute
			};
		}
		function clockOf(minutes) {
			const hour = Math.floor(minutes / 60);
			const minute = minutes % 60;
			return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
		}
		function runningWindow(discount, now, defaultTimeZone) {
			const offPeak = discount.offPeak;
			if (offPeak === void 0 || offPeak.windows.length === 0) return void 0;
			const declaredZone = offPeak.timeZone ?? defaultTimeZone;
			let usedZone = declaredZone;
			let clock = zonedClock(now, declaredZone);
			if (clock === void 0 && declaredZone !== defaultTimeZone) {
				usedZone = defaultTimeZone;
				clock = zonedClock(now, defaultTimeZone);
			}
			if (clock === void 0) return void 0;
			const match = offPeak.windows.find((window) => window.weekdays.includes(clock.isoWeekday) && clock.minutes >= window.startMinute && clock.minutes < window.endMinute);
			return match === void 0 ? void 0 : {
				...match,
				timeZone: usedZone
			};
		}
		/** `subKey` is upstream's machine name; it is the only honest source for "限时". */
		function kindOf(discount) {
			const key = discount.subKey ?? "";
			if (key.includes("off_peak")) return "offPeak";
			if (key.includes("subsidy")) return "subsidy";
			if (key.includes("limited")) return "limited";
			const type = discount.current?.discountType ?? "";
			if (type.includes("off")) return "offPeak";
			if (type.includes("limited")) return "limited";
			return "subsidy";
		}
		/** Pay ratio as upstream would phrase it; falls back to the rates it published. */
		function discountOf(price) {
			if (price.discountPercent !== void 0) return price.discountPercent;
			if (price.beforeRate === void 0 || price.rate === void 0) return void 0;
			if (price.beforeRate <= 0 || price.rate >= price.beforeRate) return void 0;
			return Math.round(price.rate / price.beforeRate * 100);
		}
		/**
		* The member price, but only when it beats the rate the badge is already showing.
		*
		* Two rates on the same base are two ways to reach one price: `member` quoting
		* 0.06 beside a live 0.06 is not "another 5 折". Comparing the post-discount
		* numbers is the only honest test — a branch with no rate cannot be shown to be
		* cheaper, so it is not quoted at all.
		*/
		function cheaperMemberOf(price, discount) {
			const member = discount.member;
			if (member === void 0 || member.rate === void 0) return void 0;
			if (price.rate === void 0 || member.rate >= price.rate) return void 0;
			const discountPercent = discountOf(member);
			if (discountPercent === void 0) return void 0;
			return {
				rate: member.rate,
				discountPercent
			};
		}
		function badgeOf(kind, price, discount, window) {
			const discountPercent = discountOf(price);
			if (discountPercent === void 0) return void 0;
			const member = cheaperMemberOf(price, discount);
			return {
				kind,
				discountPercent,
				percentOff: 100 - discountPercent,
				...price.beforeRate === void 0 ? {} : { beforeRate: price.beforeRate },
				...price.rate === void 0 ? {} : { rate: price.rate },
				...member === void 0 ? {} : {
					memberDiscountPercent: member.discountPercent,
					memberRate: member.rate
				},
				...window === void 0 ? {} : {
					fromClock: clockOf(window.startMinute),
					untilClock: clockOf(window.endMinute),
					timeZone: window.timeZone
				}
			};
		}
		/**
		* Decide the one badge (if any) a model shows right now.
		*
		* `now` is injected so the verdict is testable and so the card, which re-renders
		* on its own poll, always judges against the current clock. `defaultTimeZone` is
		* the account's zone, used only when upstream omits `off_peak.time_zone`.
		*/
		function selectTraePromoBadge(discount, now, defaultTimeZone = TRAE_PROMO_DEFAULT_TIME_ZONE) {
			if (discount === void 0) return void 0;
			const current = discount.current;
			if (current !== void 0) {
				if ((current.discountType ?? "none") !== "none" && (current.beforeRate === void 0 || current.rate === void 0 || current.rate < current.beforeRate)) {
					const kind = kindOf(discount);
					const badge = badgeOf(kind, current, discount, kind === "offPeak" ? runningWindow(discount, now, defaultTimeZone) : void 0);
					if (badge !== void 0) return badge;
				}
			}
			const window = runningWindow(discount, now, defaultTimeZone);
			if (window !== void 0 && discount.offPeak !== void 0) {
				if ((discount.current?.discountType ?? "none") === "none" || discountOf(discount.offPeak) !== void 0) return badgeOf("offPeak", discount.offPeak, discount, window);
			}
		}
		//#endregion
		//#region src/client/styles.ts
		/**
		* Client styles for the Trae plugin card.
		* Copied verbatim from `dsh-subagent-default-model`'s SETTINGS_CSS so the two
		* plugins share one external-presentation language (same card shell, same
		* button primitives, same `--dsw-alias-*` token palette).
		*/
		const TRAE_CARD_CSS = `
.dsm-icon-preference{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-icon-preference-copy{display:flex;flex-direction:column;gap:4px;flex:1;min-width:180px;font-size:13px}
.dsm-icon-preference-copy>span{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#999)}
.dsm-icon-choices{display:flex;flex-wrap:wrap;gap:6px}
.dsm-icon-choices>button{appearance:none;display:inline-flex;align-items:center;gap:8px;font:inherit;font-size:12px;line-height:20px;color:inherit;background:transparent;border:1px solid var(--dsw-alias-border-l2,#777);border-radius:8px;padding:7px 10px;cursor:pointer}
.dsm-icon-choices>button[aria-checked="true"]{border-color:var(--dsw-alias-brand-primary,#cf795b);background:var(--dsw-alias-bg-layer-2,#25262b)}
.dsm-icon-choices>button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#cf795b);outline-offset:2px}
.dsm-icon-save-error{flex-basis:100%;margin:0;color:var(--dsw-alias-state-error-primary,#c33);font-size:12px}
.dsm-trae-pool-auto-checkin{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.dsm-trae-pool-auto-checkin-status{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#999)}
.dsm-plugin-card{border:1px solid var(--dsw-alias-border-l2,#36373b);background:var(--dsw-alias-bg-layer-3,#202126);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}
.dsm-plugin-card:hover{border-color:var(--dsw-alias-label-dimmed,#777)}
.dsm-plugin-card-open{background:var(--dsw-alias-bg-layer-2,#25262b);border-color:var(--dsw-alias-label-dimmed,#777)}
.dsm-plugin-card-header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:transparent;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}
.dsm-plugin-card-header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:-2px}
.dsm-plugin-card-head{flex-direction:column;flex:1;gap:6px;min-width:0;display:flex}
.dsm-plugin-card-title{color:var(--dsw-alias-label-primary,#e6e6e6);font-size:15px;font-weight:600;line-height:1.4}
.dsm-plugin-card-description{color:var(--dsw-alias-label-tertiary,#999);font-size:12.5px;line-height:1.55}
/* Pure-CSS caret: the host primitives' chevron icon names are not part of any
   stable contract across DSH releases, so no static import is used 鈥?a border
   caret in the plugin's own CSS is version-proof. */
.dsm-plugin-card-chevron{color:var(--dsw-alias-label-tertiary,#999);flex:none;width:16px;height:16px;position:relative;transition:transform .16s}
.dsm-plugin-card-chevron::before{content:"";display:block;position:absolute;left:4px;top:5px;width:7px;height:7px;border-right:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:rotate(45deg)}
.dsm-plugin-card-chevron-open{transform:rotate(180deg)}
.dsm-plugin-card-body{border-top:1px solid var(--dsw-alias-border-l2,#36373b);margin:0 16px;padding:0 0 8px}
.dsm-plugin-card-icon{width:32px;height:32px;flex:none;border-radius:7px}
.dsm-plugin-card-body .dsm-model-settings{margin:0;padding:12px 0 0;background:transparent;border:0;border-radius:0}
.dsm-btn{appearance:none;font:inherit;cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}
.dsm-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-btn:disabled{opacity:.4;cursor:default}
.dsm-btn-outline{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:transparent;font-weight:500}
.dsm-btn-outline:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed);background:rgba(255,255,255,.04)}
.dsm-btn-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
.dsm-btn-primary:hover:not(:disabled){opacity:.9}
.dsm-trae-mainui-switch{display:flex;justify-content:flex-end;padding:0 2px 8px}
.dsm-trae-mainui-switch-label{display:inline-flex;align-items:center;gap:6px;font-size:13px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0);white-space:nowrap;cursor:pointer}
.dsm-trae-mainui-switch-label input{margin:0;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-trae-mainui-switch-label:has(input:disabled){opacity:.6;cursor:default}
.dsm-trae-usage{display:flex;flex-direction:column;gap:16px;margin:0;padding:16px 0 4px}
.dsm-trae-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.dsm-trae-tab-cell{display:flex;align-items:center;gap:4px;min-width:0;padding:8px 12px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:10px;background:var(--dsw-alias-bg-layer-3,#2a2c33);transition:border-color .15s,background .15s}
.dsm-trae-tab-cell:hover{border-color:var(--dsw-alias-label-dimmed,#777)}
/* The selected tab is marked on its CHIP, not on the button inside it: an
   inset ring on an inner button, inside a bordered strip, drew two borders
   a few pixels apart and read as a rendering mistake. The chip carries the
   accent border, so the switch beside the label stays in the same unit. */
.dsm-trae-tab-cell:has(.dsm-trae-tab-active){border-color:var(--dsw-alias-brand-primary,#5686fe);background:var(--dsw-alias-bg-layer-2,#232529)}
.dsm-trae-tab{appearance:none;font:inherit;cursor:pointer;flex:1;min-width:0;border:0;border-radius:7px;padding:0;color:var(--dsw-alias-label-tertiary,#999);font-size:13px;font-weight:600;line-height:20px;background:transparent;text-align:left;transition:color .15s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsm-trae-tab:hover:not(:disabled):not(.dsm-trae-tab-active){color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-trae-tab-active{color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-tab-off{opacity:.55}
/* Same checkbox as the settings block (.dsm-trae-switch); only the padding
   differs, so it sits inside the tab cell without crowding the label. */
.dsm-trae-tab-switch{flex:none;margin-left:auto;padding-left:10px;border-left:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.24))}
.dsm-trae-tab-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:7px;vertical-align:baseline}
.dsm-trae-tab-hint{margin:0;padding:0 2px;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
/* THE TWO SETTINGS-SURFACE TWEAKS, SCOPED (learned the hard way, post-release).
 *
 * 下面两条原本是**无作用域**的：一条把供应商说明行视觉隐藏，一条把分栏条改成
 * sticky 并加一层底色。它们写的时候只想到设置面板那一列（564px、外壳自带滚动），
 * 但那两处 DOM 是**三个界面共用的**——卡片、整页、设置页画的是同一棵树。
 *
 * 结果在卡片上是两个回归（实测）：说明行在卡片里也消失了（卡片有自己的宽度、
 * 有自己的节奏，那里根本没有纵向空间压力），分栏条拿到 position:sticky 却没有
 * 滚动祖先，且底色取了 layer-2 而卡片本身是 layer-3，于是在卡片上压出一条
 * 比周围更浅的色带。
 *
 * 所以两条都挪到 .dsm-trae-section 之下——那是"只在设置面板里生效"的结构标记，
 * 也是这些改动的唯一理由所在（外壳的滚动列与 564px 的宽度）。卡片与整页保持
 * 原样：它们没有面板外壳，也就没有这些约束。 */
.dsm-trae-section .dsm-trae-tab-hint{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
/* SECTION TABS: the card's own top-level split (account / models / diagnostics).
 *
 * Deliberately NOT the boxed chips above. Those are the REGION scope — a
 * three-way choice of which PROVIDER this whole card is about, each chip
 * carrying its own on/off switch — while these are panels of ONE document, the
 * shape a reader already knows from the app's own settings window. Two rows of
 * boxes would read as one six-way choice.
 *
 * The hidden ATTRIBUTE on each panel is what does the work: an inactive panel
 * stays MOUNTED, so switching back does not refetch, a half-filled model draft
 * survives the trip, and the account pool keeps its log. It also takes the
 * inactive panel out of the accessibility tree, which is exactly what
 * role="tabpanel" wants — unlike display:none reached by a CSS class, the user
 * agent's own rule for [hidden] cannot be overridden by a later declaration. */
/* 分栏条钉在外壳的滚动列顶部（STICKY, not a second scroller）。
 *
 * 站点：本插件**不**接管滚动。设置面板的 .options 列本来就负责滚动（它自己的
 * CSS 注释写明了这一点），在里面再套一层 overflow:auto 就是两根滚动条，滚轮
 * 会在两者之间来回跳。所以这里既不写 height:100%，也不写 overflow。
 *
 * 但「不接管滚动」不等于「分栏条可以滚走」：账号池在折叠线以下，滚到那里时
 * 「模型 / 诊断」已经跟着滚出了视野，想切分栏只能先把整页滚回顶部。sticky 让它
 * 在任何滚动位置都留在顶部，代价只是 z-index 与一层不透明底色——否则滚上来的
 * 账号卡片会从字缝里透出来（外壳的 layer-2 正是这一列自己的底色）。
 *
 * top:-1px 而不是 0：分栏条自己的 border-bottom 画在盒子外侧，写成 0 会在它上方
 * 留一条 1px 的缝，滚动的行会从这条缝里露出来。 */
.dsm-trae-panels{display:flex;align-items:stretch;gap:2px;margin:4px 0 0;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.24))}
/* 分栏条只在设置面板里钉住（见上方 .dsm-trae-tab-hint 的长注释：这两条原本无
 * 作用域，在卡片上留下两个回归）。卡片与整页没有"外壳的滚动列"，那里的分栏条
 * 跟着内容正常滚走即可；sticky 在没有滚动祖先时不会生效，却会把底色带进来——
 * 而底色取 layer-2，卡片本身是 layer-3，色差在卡片上就成了一条浅色带。 */
.dsm-trae-section .dsm-trae-usage .dsm-trae-panels{position:sticky;top:-1px;z-index:2;padding:0;background:var(--dsw-alias-bg-layer-2,#24262c)}
.dsm-trae-panel-tab{appearance:none;font:inherit;cursor:pointer;border:0;background:transparent;padding:7px 11px;margin-bottom:-1px;border-bottom:2px solid transparent;color:var(--dsw-alias-label-tertiary,#999);font-size:13px;font-weight:600;line-height:20px;white-space:nowrap;transition:color .15s,border-color .15s}
.dsm-trae-panel-tab:hover:not(.dsm-trae-panel-tab-active){color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-panel-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-trae-panel-tab-active{color:var(--dsw-alias-label-primary,#e6e6e6);border-bottom-color:var(--dsw-alias-brand-primary,#5686fe)}
/* No top margin of its own: the strip above already carries a border, and the
   card's 16px stack gap would double the separation. */
.dsm-trae-panel{margin-top:0}
/* The one-line note at the top of a section that holds controls but no Save
 * button. A section with switches and no footer is the first thing a reader
 * doubts — "did that press stick?" — so the note answers it before the doubt
 * forms, and it is styled as a muted paragraph rather than a warning because
 * "takes effect immediately" is a fact, not a caveat. */
.dsm-trae-panel-note{margin:0 0 4px;padding:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
/* DIAGNOSTICS: a two-column fact table rather than prose. Each row is one thing
 * the card actually READ, so a bug report can quote a line instead of
 * paraphrasing the UI. No control lives here on purpose — a diagnostics panel
 * that can change settings is a settings panel with a worse name. */
.dsm-trae-diag{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2,#36373b);border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-2,#232529)}
.dsm-trae-diag-row{display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:8px 12px}
.dsm-trae-diag-row+.dsm-trae-diag-row{border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.24))}
.dsm-trae-diag-label{flex:none;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
.dsm-trae-diag-value{min-width:0;color:var(--dsw-alias-label-primary,#e6e6e6);font-size:12px;line-height:18px;text-align:right;overflow-wrap:anywhere}
.dsm-trae-diag-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
/* A failure line, in the same warn tone the card already uses for an expiring
   credit — NOT a hand-rolled amber. The token set the card asks DSH for is
   audited by the card-styles spec (every name must be one the host actually
   defines), so this deliberately names state-warn-primary rather than the
   sibling card's label-caution, which this suite has never verified. */
.dsm-trae-diag-bad{color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-diag-hint{margin:10px 0 0;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
.dsm-trae-credits-unavailable{margin:10px 0 0;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:10px;color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:12px;line-height:18px;background:var(--dsw-alias-bg-layer-3,#2a2c33)}
.dsm-trae-account-value-muted{color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:12px}
.dsm-trae-tab-off-notice{margin:0;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:10px;color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:12px;line-height:18px;background:var(--dsw-alias-bg-layer-3,#2a2c33)}
.dsm-trae-usage-account{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:14px;background:var(--dsw-alias-bg-layer-2,#24262c)}
.dsm-trae-usage-account-copy{display:flex;flex-direction:column;gap:3px;min-width:0}
.dsm-trae-usage-expiry{padding-left:19px;color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:12px;line-height:18px}
/* Refresh-token countdown (issue #37 follow-up). Sits under the access-token
   line and aligns with it, so the two read as one stack: "token renews" then
   "but this is when renewal itself ends". Only rendered when it is close or
   already past, so a healthy account is unchanged. */
.dsm-trae-refresh-warn{padding-left:19px;font-size:12px;line-height:18px}
.dsm-trae-refresh-warn-soon{color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-refresh-warn-lapsed{color:var(--dsw-alias-state-error-primary,#dc2626)}
.dsm-trae-account-picker{display:block}
/* The 璁剧疆 block: label + hint on the left, control on the right, one save for
   the whole block. It replaces the bare checkbox rows that used to write on
   every click 鈥?a draft needs a visible way back out, so each row carries its
   own explanation and the footer carries the buttons. */
/* The preference switches: BARE LINES, one per switch, each with its label
   wrapped around the box so the whole line is a click target.
 *
 * The 璁剧疆 block used to be a bordered box with a heading, two rows and a
 * 銆屼繚瀛樸€?銆屾斁寮冦€?footer. That is gone with the draft it existed to serve 鈥?this
 * is the sibling dsh-connect-workbuddy card's shape, where a preference is a
 * checkbox on a line that commits on the click. */
.dsm-trae-prefs{display:flex;flex-direction:column;gap:14px;padding:2px 2px 0}
.dsm-trae-pref{display:flex;align-items:flex-start;gap:10px;font-size:13px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0);cursor:pointer}
.dsm-trae-pref input{flex:none;cursor:pointer;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
/* The icon picker inside the 「能力」 list.
 *
 * It is a shared component (plugin-icon.tsx) that also renders standalone, so
 * its own rule carries a 12px block padding for that standalone use. Inside the
 * prefs column that padding doubles up with the container's 14px gap and the row
 * drifts away from its three neighbours, which are bare lines with no padding of
 * their own. Strip it here rather than in the shared rule: the standalone
 * spacing is still correct wherever else this component is mounted.
 *
 * min-width:0 on the copy because the labels here are Chinese sentences, not the
 * short English words the 180px floor was chosen for; without it a long hint
 * pushes the two icon buttons out of the 564px column instead of wrapping. */
.dsm-trae-prefs .dsm-icon-preference{padding:0;align-items:flex-start}
.dsm-trae-prefs .dsm-icon-preference-copy{min-width:0}
.dsm-trae-pref-check{inline-size:15px;block-size:15px;margin:3px 0 0}
/* The label and its explanation used to run together as one wrapped blob
   ("在输入框工具栏显示积分读数 在输入框工具栏显示可点击读数…"), which is what made
   this block read as a wall of text. They are two lines now: what the switch
   does, then what it means. */
.dsm-trae-pref-copy{display:flex;flex-direction:column;gap:3px;min-width:0}
.dsm-trae-pref-label{font-weight:500;color:var(--dsw-alias-label-primary,#e6e6e6)}
/* The select sits NEXT TO its label ("显示位置 [输入框工具栏 ▾]"), not at the far
   right of the card. Pushing it to the opposite edge split one sentence into
   two objects with half a card of empty space between them, and left the reader
   to guess which label the control belonged to. The row packs from the left;
   nothing in it stretches. */
.dsm-trae-pref-lead{display:flex;align-items:center;justify-content:flex-start;gap:10px;min-width:0}
.dsm-trae-pref-lead .dsm-trae-pref-label{flex:none}
.dsm-trae-pref input:disabled{cursor:default}
.dsm-trae-pref:has(input:disabled){opacity:.6;cursor:default}
.dsm-trae-pref b{font-weight:500;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-pref-hint{color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:12px;line-height:17px}
.dsm-trae-pref span{min-width:0}
/* The credit readout's seat picker (learned from workbuddy #62). Its OWN label
   class, deliberately not the plain .dsm-trae-pref the two checkboxes use: a
   query for "the composer-credits switch" must not be able to pick this control
   up, because the two are different widgets and a test selecting by position
   would otherwise start asserting about a <select>.
   The select keeps its own class for the same reason, and takes the checkbox
   column's width so it reads as a sibling of the box rather than a stray row. */
/* The select row has no checkbox, so it borrows the checkbox's column as
   padding — its label must start on the same left edge as the two labels
   above it (15px box + 10px gap). */
.dsm-trae-credit-position-pref{align-items:flex-start;padding-left:25px}
/* Sized by its own two options, not stretched: the control answers one short
   question and sits beside the words that ask it. */
.dsm-trae-credit-position{flex:none;max-width:none;margin-top:0;padding:3px 8px;font-size:12px;line-height:16px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:7px;background:var(--dsw-alias-bg-layer-3,#2a2c33);color:var(--dsw-alias-label-primary,#e6e6e6);cursor:pointer}
.dsm-trae-credit-position:disabled{cursor:default}
/* The automatic-refresh picker, a sibling of the seat picker above and styled
   to match it — the two answer the same kind of question ("how this readout
   behaves") and sit on consecutive lines, so a second visual idiom would read
   as an unrelated control.

   Its OWN class, deliberately NOT the seat picker's: a test that selects the
   seat picker by class must not start finding the cadence picker the moment
   this row is added, which is exactly the failure the seat picker's own comment
   records. The row borrows the checkbox column's padding for the same reason
   its sibling does. */
.dsm-trae-refresh-interval-pref{align-items:flex-start;padding-left:25px}
.dsm-trae-refresh-interval{flex:none;max-width:none;margin-top:0;padding:3px 8px;font-size:12px;line-height:16px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:7px;background:var(--dsw-alias-bg-layer-3,#2a2c33);color:var(--dsw-alias-label-primary,#e6e6e6);cursor:pointer}
.dsm-trae-refresh-interval:disabled{cursor:default}
/* The card's checkboxes are the platform's own, styled only with
   accent-color 鈥?the SAME idiom .dsm-trae-mainui-switch-label above already
   uses for the composer-line switch, and the one the sibling
   dsh-connect-workbuddy card uses for its tab and credits boxes.
 *
 * These were drawn by hand for one release: a 34x20 track with a 14px knob,
 * --dsw-alias-brand-primary when checked. That token is DSH's CONTRAST colour
 * (#0f1115 light / #f9fafb dark), not an accent, so a checked box came out as a
 * solid black pill 鈥?heavier than anything else in the card, and unrelated to
 * the native box sitting two centimetres away in the composer toolbar. The
 * platform checkbox tracks the host's own accent and dark mode for free. */
.dsm-trae-switch{display:inline-flex;align-items:center;cursor:pointer}
.dsm-trae-switch input{margin:0;cursor:pointer;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-trae-switch input:disabled{cursor:default}
.dsm-trae-switch:has(input:disabled){opacity:.6;cursor:default}
/* A pill, only where a pill is the idiom: the standalone preference rows.
   appearance:none hands the geometry to the stylesheet, so the track and the
   knob are ours. It is scoped rather than global because the tab row's switch
   sits inside a chip — a pill there reads as a second button, which is exactly
   how it looked when this was global. */
.dsm-trae-switch-pill{display:inline-flex;align-items:center}
.dsm-trae-switch-pill input{appearance:none;-webkit-appearance:none;position:relative;inline-size:36px;block-size:20px;border:0;border-radius:999px;background:var(--dsw-alias-border-l2,#c4c7cc);transition:background-color .15s ease}
.dsm-trae-switch-pill input::after{content:"";position:absolute;inset-block-start:2px;inset-inline-start:2px;inline-size:16px;block-size:16px;border-radius:50%;background:var(--dsw-alias-bg-layer-3,#fff);box-shadow:0 1px 2px rgba(0,0,0,.24);transition:transform .15s ease}
.dsm-trae-switch-pill input:checked{background:var(--dsw-alias-brand-primary,#1b1c1e)}
.dsm-trae-switch-pill input:checked::after{transform:translateX(16px)}
/* The account block is a real table: the question it answers is "which of these
   accounts, and what is the action on each one" 鈥?a dropdown can only ever show
   the one already chosen. */
.dsm-trae-accounts{display:flex;flex-direction:column;gap:10px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:14px;background:var(--dsw-alias-bg-layer-2,#24262c)}
.dsm-trae-accounts-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
/* The refresh button must not be squeezed into two lines by a long hint. */
.dsm-trae-accounts-head>button{flex:none;white-space:nowrap}
.dsm-trae-accounts-title{margin:0;font-size:13px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-accounts-hint{margin:3px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
/* The account rows: two lines each 鈥?who the account is, then what it is worth
   鈥?with the one action that applies to THAT row on the right. A four-column
   table was the wrong instrument here: every field demanded its own header, the
   columns drifted with the content (a short nickname vs a full expiry stamp), and the
   bound row repeated its "in use" badge in two different columns. */
/* The account table, shaped like the sibling WorkBuddy card's pool table: a
   bordered container, a tinted header row, and one grid row per account whose
   tracks are FRACTIONS of the container rather than sizes derived from the
   content. That is the whole point 鈥?the previous four-column table let each
   column grow with its own text, so the columns did not line up from row to row
   and the table read as noise in a narrow panel. */
.dsm-trae-account-table{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:var(--dsm-trae-pool-radius);overflow:hidden;background:var(--dsw-alias-bg-layer-2,#24262c)}
/* Four tracks where the region has a check-in column, three where it does not
   (the international region has no check-in at all: the ug/* family answers
   404 on every ai gateway, so the column is absent rather than empty and
   permanently unknown). The freed track goes to the account name. */
.dsm-trae-account-row{display:grid;grid-template-columns:1.7fr 1.1fr 1fr 1.1fr;gap:10px;align-items:center;padding:9px 12px;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18));font-size:13px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-trae-account-table:not(.dsm-trae-account-table-checkin) .dsm-trae-account-row{grid-template-columns:2.2fr 1.2fr 1.1fr}
.dsm-trae-account-row:first-child{border-top:0}
.dsm-trae-account-row-head{padding:7px 12px;background:var(--dsw-alias-bg-layer-3,#2a2c33);color:var(--dsw-alias-label-tertiary,#999);font-size:11px;font-weight:600;letter-spacing:.02em;text-transform:uppercase}
/* The serving row, findable at a glance: the accent bar is what distinguishes it
   in a long table, where the 7%-opacity wash alone reads as a zebra stripe. */
.dsm-trae-account-row-current{background:rgba(86,134,254,.07);box-shadow:inset 3px 0 0 var(--dsw-alias-brand-primary,#5686fe)}
.dsm-trae-account-who{display:flex;align-items:center;gap:8px;min-width:0}
.dsm-trae-account-who .dsm-trae-usage-dot{margin-right:0;flex:none}
.dsm-trae-account-name{display:flex;flex-direction:column;gap:1px;min-width:0}
.dsm-trae-account-name b{font-weight:500;color:var(--dsw-alias-label-primary,#e6e6e6);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-trae-account-row-current .dsm-trae-account-name b{font-weight:600}
/* Declared AFTER the blanket span rule above so it wins: the badge must not
   inherit the muted 11px tertiary treatment the edition line uses. */
.dsm-trae-account-name .dsm-trae-account-badge{align-self:flex-start;margin-top:2px;padding:1px 6px;border-radius:999px;font-size:10px;line-height:15px;font-weight:600;white-space:nowrap;color:var(--dsw-alias-brand-primary,#5686fe);background:rgba(86,134,254,.14)}
.dsm-trae-account-meta{display:flex;align-items:center;gap:5px;flex-wrap:wrap;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#9aa0a8);min-width:0}
.dsm-trae-account-meta i{font-style:normal;opacity:.4}
.dsm-trae-account-note{font-size:11px;line-height:16px;color:var(--dsw-alias-state-error-primary,#ef4444)}
/* A transient overload / timeout (issue #89) is not a failure: give it a
   readable size and a calm warning tone so it cannot be mistaken for a dead
   button the way the 11px red error line was. */
.dsm-trae-account-note-busy{font-size:12px;line-height:18px;color:var(--dsw-alias-state-warn-primary,#b45309)}
/* Its own track, in tabular figures, so digits in different rows sit on the same
   column of the grid instead of jittering with the glyph widths. */
.dsm-trae-account-worth{display:flex;flex-direction:column;gap:1px;min-width:0;font-variant-numeric:tabular-nums}
.dsm-trae-account-value{color:var(--dsw-alias-label-primary,#e6e6e6);font-weight:600}
.dsm-trae-account-value-on{color:var(--dsw-alias-state-success-primary,#22a06b)}
.dsm-trae-account-checkin-cell{display:flex;align-items:center;min-width:0}
.dsm-trae-account-actions{display:flex;align-items:center;gap:6px;justify-content:flex-end;flex:none}
/* The per-row switch is the shared outline button, only smaller: one button
   vocabulary in the card instead of a bespoke one per block. */
.dsm-trae-account-row .dsm-trae-account-switch{padding:2px 10px;font-size:12px}
@media (max-width:760px){.dsm-trae-account-row,.dsm-trae-account-table:not(.dsm-trae-account-table-checkin) .dsm-trae-account-row{grid-template-columns:1fr 1fr;row-gap:6px}.dsm-trae-account-row-head{display:none}}
/* The check-in is the only action on this card that reaches upstream account
   state, so it is the one button allowed a colour. Everything else in the row
   defers to it. */
.dsm-trae-account-checkin{appearance:none;font:inherit;cursor:pointer;white-space:nowrap;border:1px solid rgba(86,134,254,.4);border-radius:7px;padding:2px 9px;font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-brand-primary,#5686fe);background:rgba(86,134,254,.08)}
.dsm-trae-account-checkin:hover:not(:disabled){background:rgba(86,134,254,.16)}
.dsm-trae-account-checkin:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-trae-account-checkin-state{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8);white-space:nowrap}
/* A disabled check-in still STATES something ("claimed", "device used"), so it
   stays readable 鈥?clearly inactive, not invisible. */
.dsm-trae-account-checkin:disabled{opacity:.55;cursor:default;border-color:transparent;color:var(--dsw-alias-label-tertiary,#9aa0a8);background:transparent}
/* The switch is the row's LIVE control, so it is brighter than the inert
   check-in labels beside it: same shape, different weight. */
.dsm-trae-account-switch{appearance:none;font:inherit;cursor:pointer;white-space:nowrap;border:0;border-radius:7px;padding:3px 8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0);background:transparent}
.dsm-trae-account-switch:hover:not(:disabled){color:var(--dsw-alias-brand-primary,#5686fe);background:rgba(86,134,254,.12)}
.dsm-trae-account-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-trae-account-switch:disabled{opacity:.45;cursor:default}
.dsm-trae-mark{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:5px;font-size:11px;font-weight:700;color:#111;background:linear-gradient(135deg,#ffd36e,#ffb84d);margin-right:6px}
.dsm-trae-usage-list{display:flex;flex-direction:column;gap:10px}
.dsm-trae-usage-text{margin:0;font-size:14px;line-height:22px;color:var(--dsw-alias-label-secondary,#b8b8b8)}
.dsm-trae-usage-error{margin:0;font-size:14px;line-height:22px;color:var(--dsw-alias-state-error-primary,#ef4444)}
.dsm-trae-usage-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
.dsm-trae-usage-status{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:500;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-usage-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:2px}
.dsm-trae-usage-stats-two{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.dsm-trae-usage-stat{position:relative;display:flex;flex-direction:column;gap:9px;padding:16px 16px 14px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:14px;background:var(--dsw-alias-bg-layer-2,#24262c);overflow:hidden;min-width:0}
.dsm-trae-usage-stat::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;opacity:.9}
.dsm-trae-usage-stat-work::before{background:#9ca2aa}
.dsm-trae-usage-stat-general::before{background:#4d9b6d}
.dsm-trae-usage-stat-head{display:flex;align-items:center;gap:7px;min-width:0}
.dsm-trae-usage-stat-label{font-size:13px;line-height:18px;font-weight:600;color:var(--dsw-alias-label-secondary,#c6c9d0);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-trae-usage-stat-badge{margin-left:auto;flex:0 0 auto;padding:2px 8px;border-radius:999px;font-size:11px;line-height:15px;font-weight:600;letter-spacing:.2px}
.dsm-trae-usage-stat-badge-off{color:#aeb3bb;background:rgba(174,179,187,.11)}
.dsm-trae-usage-stat-badge-on{color:#3f8d60;background:rgba(63,141,96,.13)}
.dsm-trae-usage-stat-value{font-size:32px;line-height:36px;font-weight:700;letter-spacing:-.5px;white-space:nowrap;font-variant-numeric:tabular-nums}
.dsm-trae-usage-stat-value-general{color:#3f8d60}
.dsm-trae-usage-stat-value-work{color:#9298a0}
.dsm-trae-usage-stat-hint{margin:2px 0 0;font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-models{display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--dsw-alias-border-l2,#36373b);padding-top:14px}
.dsm-trae-models-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dsm-trae-models-title{margin:0;color:var(--dsw-alias-label-primary,#e6e6e6);font-size:14px;font-weight:600;line-height:20px}
.dsm-trae-models-summary{margin:2px 0 0;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
/* CATALOG SHAPE (issue #52): search + channel groups.
 *
 * The catalog is the union of every Trae mode, so a flat list reads as "a mess
 * of models" no matter how many rows it holds. The search box answers 「where is
 * X」 and the group headers answer 「why are there so many」 — the header names the
 * mode each row is actually called through, so the union is legible instead of
 * merely long. Both are presentation only: no rule here changes what is saved. */
.dsm-trae-models-search{display:flex;align-items:center;gap:10px;min-width:0}
/* SCOPE CHIPS (issue #52, P2).
 *
 * A segmented pair, not two more dsm-btn-outline buttons: those are 30px tall
 * and would compete with the section's own buttons, while this control is a
 * filter on the list directly below it. aria-pressed carries the state, so the
 * visual and the announced state cannot disagree. */
.dsm-trae-models-view{display:flex;align-items:center;gap:2px;padding:2px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,#232529);align-self:flex-start}
.dsm-trae-models-view-opt{padding:4px 10px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:12px;line-height:17px;cursor:pointer;font-variant-numeric:tabular-nums;white-space:nowrap}
.dsm-trae-models-view-opt:hover{color:var(--dsw-alias-label-secondary,#c6c9d0)}
/* The pressed chip is bg-layer-3 on a bg-layer-2 track: the verified pair that
 * reads as "this segment sits ON the control" in both themes. (bg-layer-1 was
 * the first choice and is NOT a token DSH defines — the fallback would then win
 * in both themes, the exact defect card-styles.spec.tsx exists to catch.) */
.dsm-trae-models-view-opt[aria-pressed="true"]{background:var(--dsw-alias-bg-layer-3,#2e3136);color:var(--dsw-alias-label-primary,#e6e6e6);font-weight:600}
.dsm-trae-models-view-opt:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:-2px}
/* The follow-up line under a scoped list ("N enabled are outside this view") and
 * the "show all" affordance inside it. Same 12px tertiary treatment as the hint
 * line above the list, because it is the same kind of statement: a note about
 * the list, not part of it. */
.dsm-trae-models-note{margin:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
.dsm-trae-models-widen{margin-left:2px;padding:0;border:0;background:transparent;color:var(--dsw-alias-brand-primary,#5686fe);font-size:12px;line-height:18px;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.dsm-trae-models-widen:hover{color:var(--dsw-alias-brand-primary,#5686fe);opacity:.8}
.dsm-trae-models-widen:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px;border-radius:3px}
.dsm-trae-models-search-input{flex:1 1 auto;min-width:0;padding:6px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#36373b);background:var(--dsw-alias-bg-layer-2,#232529);color:var(--dsw-alias-label-primary,#e6e6e6);font-size:13px;line-height:18px}
.dsm-trae-models-search-input::placeholder{color:var(--dsw-alias-label-tertiary,#999)}
.dsm-trae-models-search-input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:-1px}
.dsm-trae-models-search-count{flex:none;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}
.dsm-trae-models-empty{margin:0;padding:14px 12px;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
.dsm-trae-model-group{display:block}
.dsm-trae-model-group+.dsm-trae-model-group{border-top:1px solid var(--dsw-alias-border-l2,#36373b)}
/* list-style:none + a drawn marker: the native triangle cannot be styled to
   sit on the header's baseline, and Safari needs the -webkit- pseudo removed
   separately. The marker is TEXT on purpose — an icon import would tie the card
   to a host package for one glyph. */
/* The header tint is a NEUTRAL overlay, not a DSH token: it has to sit one step
   away from the row background in BOTH themes, and the only token the card may
   use there (bg-layer-2) is what the rows already paint. A 6% grey wash is the
   same "slightly recessed" relationship for a light and a dark surface. */
.dsm-trae-model-group-head{display:flex;align-items:center;gap:8px;padding:7px 12px;cursor:pointer;background:rgba(127,127,127,.12);color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:12px;line-height:17px;font-weight:600;list-style:none}
.dsm-trae-model-group-head::-webkit-details-marker{display:none}
.dsm-trae-model-group-head::before{content:'▸';flex:none;width:9px;color:var(--dsw-alias-label-tertiary,#999);font-size:10px}
.dsm-trae-model-group[open]>.dsm-trae-model-group-head::before{content:'▾'}
.dsm-trae-model-group-head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:-2px}
.dsm-trae-model-group-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-trae-model-group-count{flex:none;color:var(--dsw-alias-label-tertiary,#999);font-weight:400;font-variant-numeric:tabular-nums}
/* The header separates itself from its FIRST row; between rows the generic
   .dsm-trae-model+.dsm-trae-model hairline still applies, and between groups
   the rule above does. Without this the first row of every group looked pasted
   onto its header. */
.dsm-trae-model-group-head+.dsm-trae-model{border-top:1px solid var(--dsw-alias-border-l2,#36373b)}
/* EVERY model is on the page — no inner scroller, no max-height.
 *
 * A capped list with its own scrollbar was tried and rejected by the user: it
 * turned a settings section into a little window that has to be scrolled inside
 * a page that already scrolls, and put the models a user is looking for behind a
 * gesture that does not match the rest of the card. The section is allowed to be
 * as tall as the catalog is; the card's own page scroll is the only scroll.
 *
 * overflow:hidden is for the rounded border only (so the row hairlines cannot
 * paint outside the radius). It is deliberately NOT auto: nothing here clips
 * content vertically. */
.dsm-trae-model-list{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2,#36373b);border-radius:10px;overflow:hidden}
.dsm-trae-model{display:grid;grid-template-columns:minmax(0,1fr);gap:7px;padding:10px 12px;background:var(--dsw-alias-bg-layer-2,#232529);transition:opacity .16s}
.dsm-trae-model-disabled{opacity:.55}
.dsm-trae-model+.dsm-trae-model{border-top:1px solid var(--dsw-alias-border-l2,#36373b)}
.dsm-trae-model-head{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
.dsm-trae-model-enabled{display:flex;align-items:center;gap:8px;min-width:0;cursor:pointer}
.dsm-trae-model-enabled input{margin:0;accent-color:var(--dsw-alias-brand-primary,#5686fe);flex:none}
.dsm-trae-model-copy{display:flex;align-items:baseline;gap:8px;min-width:0}
.dsm-trae-model-name{display:inline-flex;align-items:baseline;gap:7px;color:var(--dsw-alias-label-primary,#e6e6e6);font-size:13px;font-weight:500;line-height:19px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-trae-model-name-rate{color:var(--dsw-alias-label-tertiary,#999);font-size:11px;font-weight:400;line-height:16px;flex:none}
/* The two head actions sit together; the probe one SPENDS quota, so it carries
   the hint tooltip rather than looking like its read-only sibling. */
/* The sidebar-credit switch. Two instances share this style: the card's own
   row at the top and the copy beside the model actions (2.9.3). Without it the
   checkbox rendered unstyled and read as absent 鈥?the whole reason the switch
   looked missing. */
.dsm-trae-models-actions{display:flex;align-items:center;gap:8px;flex:none}
.dsm-trae-usage-alternative{display:flex;align-items:flex-start;gap:10px;margin-top:10px;padding:10px 12px;border:1px solid var(--dsw-alias-state-warn-secondary,#fbbf24);border-radius:10px;background:var(--dsw-alias-state-warn-tertiary,#fef3c7)}
.dsm-trae-usage-alternative-text{margin:0;flex:1 1 auto;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-usage-switch-button{flex:0 0 auto;padding:5px 10px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:8px;background:var(--dsw-alias-bg-layer-3,#2c2f36);color:var(--dsw-alias-label-primary,#e6e6e6);font-size:12px;line-height:16px;cursor:pointer}
.dsm-trae-usage-switch-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}
.dsm-trae-usage-switch-button:disabled{opacity:.5;cursor:not-allowed}
.dsm-trae-usage-note{margin:8px 0 0;color:var(--dsw-alias-label-tertiary,#999);font-size:11px;line-height:16px}
/* Credit-expiry notice, card copy. Four tones by urgency, so the 24-hour case
   cannot be mistaken for the 3-day one, nor either for the 7-day one, at a
   glance. Reads as an advisory, not an error: the account works fine, the
   credit is simply about to lapse.
   The 3-day tone sits BETWEEN the other two on purpose: it carries the
   warning border (the reader must not scroll past a 3-day expiry without
   noticing) but not the warning fill (a 3-day pack is not the emergency a
   24-hour pack is). */
.dsm-trae-expiry{display:flex;flex-direction:column;gap:2px;margin-top:10px;padding:10px 12px;border:1px solid;border-radius:10px;font-size:12px;line-height:18px}
.dsm-trae-expiry-soon{border-color:var(--dsw-alias-state-warn-secondary,#fbbf24);background:var(--dsw-alias-state-warn-tertiary,#fef3c7);color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-expiry-days{border-color:var(--dsw-alias-state-warn-secondary,#fbbf24);background:transparent;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-expiry-week{border-color:var(--dsw-alias-border-l2,#3a3d45);background:var(--dsw-alias-bg-layer-3,#2c2f36);color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-expiry-lapsed{border-color:var(--dsw-alias-border-l2,#3a3d45);background:var(--dsw-alias-bg-layer-3,#2c2f36);color:var(--dsw-alias-label-tertiary,#999)}
.dsm-trae-expiry-detail{font-size:11px;line-height:16px;opacity:.8}
/* Account import / export (issue #37). A sub-block of the accounts section:
   the transfer row, plus the two dialogs it opens in place. The file input is
   hidden rather than absent — the button opens the system picker, and the input
   must stay mounted to be clicked. */
.dsm-trae-transfer{margin-top:12px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.2))}
.dsm-trae-transfer-label{margin:0 0 6px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,GrayText)}
.dsm-trae-transfer-flat{margin-top:0;padding-top:0;border-top:0}
.dsm-trae-transfer-flat .dsm-trae-transfer-actions{flex-wrap:nowrap}
.dsm-trae-transfer-actions{display:flex;flex-wrap:wrap;gap:8px}
.dsm-trae-transfer-file{display:none}
.dsm-trae-transfer-status{margin:6px 0 0;font-size:11px;line-height:16px}
.dsm-trae-transfer-ok{color:var(--dsw-alias-state-success-primary,#16a34a)}
.dsm-trae-transfer-error{color:var(--dsw-alias-state-error-primary,#dc2626)}
.dsm-trae-transfer-dialog{
  margin-top:8px;padding:10px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));
  border-radius:8px;font-size:12px;line-height:18px;
}
.dsm-trae-transfer-dialog>p{margin:0 0 6px}
.dsm-trae-transfer-list{list-style:none;margin:6px 0;padding:0;max-height:180px;overflow:auto}
.dsm-trae-transfer-list label{display:flex;align-items:center;gap:6px;padding:2px 0;cursor:pointer}
.dsm-trae-transfer-list input{flex:none}
.dsm-trae-transfer-dialog-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
/* A text-button rather than a boxed one: "select all" is a shortcut inside the
   dialog, and a third button would compete with the two that act. */
.dsm-trae-transfer-link{
  margin-top:6px;padding:0;border:0;background:none;cursor:pointer;
  color:var(--dsw-alias-brand-primary,#2563eb);font-size:11px;line-height:16px;
}
.dsm-trae-models-hint{margin:4px 0 0;color:var(--dsw-alias-label-tertiary,#999);font-size:11px;line-height:16px}
/* Bulk context-budget row (issue #42): under the model list, above the
   capability note. Wraps on narrow cards; keeps the two buttons visually a
   pair and distinct from the save footer below. */
.dsm-trae-context-bulk{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
/* Per-panel 「自主生图」 consent (trae_draw_image). Sits under the bulk-context
   row, above the capability note, because it is a per-REGION runtime choice like
   the model picks above it — not a global preference. The input stays a real
   checkbox so the card's tests can find it by its accessible name. */
.dsm-trae-draw-image{display:flex;align-items:flex-start;gap:8px;margin-top:10px;font-size:11px;line-height:16px;cursor:pointer}
.dsm-trae-draw-image input{flex:none;margin:2px 0 0}
.dsm-trae-draw-image[data-disabled="true"]{cursor:not-allowed;opacity:.6}
.dsm-trae-draw-image-hint{color:var(--dsw-alias-label-tertiary,#999)}
/* Verdict badge. Only a real refusal is coloured as a warning; an unknown
   verdict stays neutral because an inconclusive probe is not evidence against
   the model. */
.dsm-trae-model-probe{flex:none;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:500;line-height:15px;white-space:nowrap}
.dsm-trae-model-probe-available{color:var(--dsw-alias-state-success-primary,#22a06b);border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary,#22a06b) 40%,transparent)}
.dsm-trae-model-probe-gated,.dsm-trae-model-probe-unsupported{color:var(--dsw-alias-state-warn-primary,#f59e0b);border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f59e0b) 40%,transparent)}
.dsm-trae-model-probe-auth{color:var(--dsw-alias-state-error-primary,#d92d20);border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 40%,transparent)}
.dsm-trae-model-probe-rate-limited,.dsm-trae-model-probe-unknown{color:var(--dsw-alias-label-tertiary,#999);border:1px solid color-mix(in srgb,var(--dsw-alias-label-tertiary,#999) 35%,transparent)}
/* Promotion capsule (src/promo.ts). Unlike WorkBuddy's badge there is NO
   upstream colour to honour — Trae publishes a pay ratio and nothing else — so
   these three colours are the plugin's own choice, picked only so the kinds stay
   distinguishable at a glance: red = subsidy price, orange = explicitly
   "limited", blue = off-peak hours. */
.dsm-trae-model-promo{flex:none;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:500;line-height:15px;white-space:nowrap;border:1px solid transparent}
.dsm-trae-model-promo-subsidy{color:var(--dsw-alias-state-error-primary,#d92d20);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 10%,transparent)}
.dsm-trae-model-promo-limited{color:var(--dsw-alias-state-warn-primary,#f59e0b);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f59e0b) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f59e0b) 12%,transparent)}
.dsm-trae-model-promo-offPeak{color:var(--dsw-alias-brand-primary,#5686fe);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#5686fe) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#5686fe) 10%,transparent)}
.dsm-trae-model-meta{display:flex;align-items:center;gap:7px 12px;flex-wrap:wrap;color:var(--dsw-alias-label-tertiary,#999);font-size:11px;line-height:16px}
.dsm-trae-model-options{display:flex;align-items:center;justify-content:flex-end;gap:12px;flex:none}
/* The thinking-level picker, on the meta row. Deliberately shaped like the
   quiet meta text beside it (11px, secondary label) rather than like the
   options row: it edits a standing preference, and a control that shouts
   would read as a per-request input the way the image checkbox is. */
.dsm-trae-model-effort{display:inline-flex;align-items:center;min-width:0}
.dsm-trae-model-effort label{display:inline-flex;align-items:center;gap:4px;cursor:pointer}
.dsm-trae-model-effort-select{max-width:112px;padding:0 2px;border:1px solid transparent;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary,#c6c9d0);font:inherit;cursor:pointer}
.dsm-trae-model-effort-select:hover{border-color:var(--dsw-alias-border-l2,#36373b)}
.dsm-trae-model-effort-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-trae-model-effort-select:disabled{opacity:.6;cursor:not-allowed}
.dsm-trae-model-image{display:inline-flex;align-items:center;gap:4px;color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:11px;line-height:16px;cursor:pointer}
.dsm-trae-model-image input{margin:0;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
/* The context-budget control: one select per row, not a row of radios.
 *
 * The fieldset stays as the grouping element — it carries the accessible name
 * and the hint title, and a select has no group of its own. flex:none keeps
 * it from stealing width from the model name, which is the thing that has to
 * stay readable on a 564px column.
 *
 * The select width is FIXED rather than content-sized: with 2-3 options the
 * widest label dictates the width, and a per-row width made the list ragged
 * (a 3-option row's control was visibly wider than its neighbours). */
.dsm-trae-context-budget{display:flex;align-items:center;justify-content:flex-end;gap:12px;flex:none;margin:0;padding:0;border:0;color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:11px;line-height:16px}
.dsm-trae-context-budget label{display:inline-flex;align-items:center;gap:4px;cursor:pointer}
.dsm-trae-context-budget input{margin:0;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-trae-context-select{flex:none;width:96px;max-width:none;padding:2px 6px;font:inherit;font-size:11px;line-height:16px;color:var(--dsw-alias-label-primary,#e6e6e6);background:var(--dsw-alias-bg-layer-3,#2a2c33);border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:7px;cursor:pointer}
.dsm-trae-context-select:disabled{cursor:default;opacity:.6}
.dsm-trae-model-capability-note{margin:0;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
.dsm-trae-model-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--dsw-alias-border-l2,#36373b);padding-top:12px}
.dsm-trae-model-actions-buttons{display:flex;align-items:center;justify-content:flex-end;gap:8px}
.dsm-trae-usage-cheer{display:inline-flex;align-items:center;gap:4px;flex:none;text-decoration:underline;text-underline-offset:2px;color:var(--dsw-alias-label-tertiary,#999);font-size:13px;line-height:1.5;transition:color .16s}
.dsm-trae-usage-cheer-star{font-size:12px;line-height:1;display:inline-flex}
.dsm-trae-usage-cheer:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-searched{margin-top:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#999)}
.dsm-trae-searched>summary{cursor:pointer;color:var(--dsw-alias-label-secondary,#b8b8b8);user-select:none}
.dsm-trae-searched-hint{margin:6px 0 4px;color:var(--dsw-alias-label-tertiary,#999)}
.dsm-trae-searched-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px}
.dsm-trae-searched-list li{display:flex;flex-direction:column;gap:1px;min-width:0}
.dsm-trae-searched-list code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#b8b8b8);word-break:break-all}
.dsm-trae-searched-reason{color:var(--dsw-alias-label-tertiary,#999);font-size:11px}
/* The quarantine notice: a copy that was kept aside instead of being erased.
   It borrows the "probed paths" look but stands on its own class, because it
   is a different KIND of fact — and because a screen may carry both. */
.dsm-trae-quarantine{margin-top:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#999)}
.dsm-trae-quarantine>summary{cursor:pointer;color:var(--dsw-alias-label-secondary,#b8b8b8);user-select:none}
.dsm-trae-quarantine-hint{margin:6px 0 4px;color:var(--dsw-alias-label-tertiary,#999)}
.dsm-trae-quarantine-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px}
.dsm-trae-quarantine-list li{display:flex;flex-direction:column;gap:1px;min-width:0}
.dsm-trae-quarantine-list code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#b8b8b8);word-break:break-all}
.dsm-trae-quarantine-reason{color:var(--dsw-alias-label-tertiary,#999);font-size:11px}
.dsm-trae-usage-cheer:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:2px}
.dsm-trae-checkin{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:14px;background:var(--dsw-alias-bg-layer-2,#24262c)}
.dsm-trae-checkin-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
.dsm-trae-checkin-label{color:var(--dsw-alias-label-primary,#e6e6e6);font-size:13px;line-height:18px;font-weight:600}
.dsm-trae-checkin-hint{color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:12px;line-height:17px}
.dsm-trae-checkin-button{flex:none}
/* The "this machine already used today's check-in" note is INFORMATIONAL, not
   an error: it is Trae's one-per-device-per-day rule, and the day is simply
   spent. Rendering it in the error colour would read as a plugin fault. */
.dsm-trae-checkin-note{margin:8px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
/* The busy veil: one overlay for every account write whose result only lands
   after the Host re-reads its settings document. Fixed so it covers the card
   no matter which section started the operation, and translucent so the table
   stays visible underneath — the user is watching a specific row change, and
   hiding it would defeat the point.

   The mask and card surface are the HOST's own tokens, not this file's
   invention. --dsw-alias-bg-mask-1 + --dsw-mask-blur is exactly what the
   host's own overlays use, so the veil dims the way every other overlay in the
   shell does instead of laying its own black wash on top. A hardcoded flat
   black mask (e.g. a mid-transparency black) was tuned against neither theme:
   too weak next to the host's .24 mask in light mode, and it ignored the
   host's blur entirely.

   bg-layer-2 (not bg-primary, which does not exist in the host's token set at
   all and therefore always fell through to this file's near-black #1b1c20) is
   the same surface the host puts behind its panels — that near-black fallback
   is what made the veil read as a black slab with unreadable text on it. */
.dsm-trae-veil{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.32));backdrop-filter:var(--dsw-mask-blur);cursor:progress}
/* --dsw-elevation-prominent is the host's own panel shadow (a hairline stroke
   plus two soft layers); a hand-rolled drop shadow read as a heavy grey box. */
.dsm-trae-veil-card{display:flex;flex-direction:column;align-items:center;gap:8px;max-width:min(340px,80vw);padding:16px 20px;border:1px solid var(--dsw-alias-border-l2,#0000001a);border-radius:12px;background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:var(--dsw-elevation-prominent,0 8px 28px rgba(0,0,0,.35))}
.dsm-trae-veil-text{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary,#0f1115);text-align:center}
/* label-secondary, not label-tertiary: this line carries the operation's
   detail and must stay legible. tertiary is the host's dimmest tier
   (neutral-bluish-600 on light, neutral-bluish-400 on dark) and is meant for
   metadata, not for a sentence the user has to read while waiting. */
.dsm-trae-veil-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b);text-align:center}
/* The spinner proves the UI is alive when the row under it has not changed yet
   — which is precisely the confusion the veil exists to remove. It follows the
   host's own state spinner (dsh's _dsh-state-dot-spin): an SVG arc whose dash
   breathes while it turns, currentColor so it inherits the tier it sits in,
   and the same 1.5s beat. The previous 18px border-ring at .7s was roughly
   twice the host's speed and visibly out of step with every other spinner in
   the shell — that mismatch, more than the shape itself, is what made it look
   cheap.

   Reduced-motion users get the static arc rather than a frozen ring, matching
   how the host degrades its own spinner. */
.dsm-trae-veil-spinner{width:20px;height:20px;color:var(--dsw-alias-label-secondary,#61666b);animation:dsm-trae-veil-spin 1.5s linear infinite}
.dsm-trae-veil-spinner-track{opacity:.25}
.dsm-trae-veil-spinner-arc{stroke-dasharray:12 150;animation:dsm-trae-veil-dash 1.5s ease-in-out infinite}
@keyframes dsm-trae-veil-spin{to{transform:rotate(360deg)}}
@keyframes dsm-trae-veil-dash{0%{stroke-dasharray:12 150;stroke-dashoffset:0}50%{stroke-dasharray:24 150;stroke-dashoffset:-6}to{stroke-dasharray:12 150;stroke-dashoffset:0}}
@media (prefers-reduced-motion: reduce){.dsm-trae-veil-spinner{animation:none}.dsm-trae-veil-spinner-arc{animation:none;stroke-dasharray:18 150;stroke-dashoffset:-3}}

/* ------------------------------------------------------------------ *
 * The account pool (3.9.0).                                           *
 *                                                                     *
 * Five tracks, because the table answers "which accounts, and what is  *
 * each one worth right now" — a single picker could only ever show the *
 * one already chosen, and every field here is a reason to include or   *
 * exclude a row. The check-in track is CONDITIONAL (only the CN panel  *
 * grants a daily reward), so the actions cell is pinned to the LAST    *
 * track (grid-column:-2/-1) rather than to the fifth one: otherwise     *
 * a four-cell row would drop Test/Remove into the check-in slot and    *
 * leave a hole on the right.                                          *
 * ------------------------------------------------------------------ */
.dsm-trae-pool{--dsm-trae-pool-pad-x:14px;--dsm-trae-pool-pad-y:10px;--dsm-trae-pool-radius:14px;display:flex;flex-direction:column;gap:12px;border-top:1px solid var(--dsw-alias-border-l2,#36373b);padding:14px 0 0}
.dsm-trae-pool-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.dsm-trae-pool-title{margin:0;font-size:13px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-pool-region-note{margin:3px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-current{flex:none;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#c6c9d0);white-space:nowrap}
/* Two classes on the element (settings + modebar): a single-class rule here loses
   to .dsm-trae-pool-settings further down, which resets padding to 0 and repaints
   the background. Match both classes so the strip keeps its own frame. */
.dsm-trae-pool-settings.dsm-trae-pool-modebar{padding:12px 14px;gap:8px;border-color:rgba(86,134,254,.36);background:linear-gradient(180deg,rgba(86,134,254,.10),rgba(86,134,254,.02)),var(--dsw-alias-bg-layer-2,#24262c)}
.dsm-trae-pool-modebar-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dsm-trae-pool-modebar-label{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-pool-modebar-state{flex:none;padding:1px 9px;border-radius:999px;font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-brand-primary,#5686fe);background:rgba(86,134,254,.14);border:1px solid rgba(86,134,254,.3)}
.dsm-trae-pool-modebar .dsm-trae-pool-dirty{margin-left:auto}
.dsm-trae-pool-modebar .dsm-trae-pool-note{line-height:18px}
/* Modifier rules must out-specify their base class wherever the base is defined
   further down (.dsm-trae-pool-note, .dsm-trae-select): matching both classes keeps
   the warn tone and the wider select from being reset by the later base rule. */
.dsm-trae-pool-note.dsm-trae-pool-serving-note{color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-card .dsm-trae-pool-actions{padding:0 var(--dsm-trae-pool-pad-x) 12px}
.dsm-trae-pool-card .dsm-trae-pool-action-note{padding:0 var(--dsm-trae-pool-pad-x) 12px}
.dsm-trae-pool-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.dsm-trae-pool-action-checkin{flex:none;white-space:nowrap}
.dsm-trae-pool-action-test{flex:none;white-space:nowrap}
/* Reference text, folded away. Same <details>/<summary> shape as the WorkBuddy
   sibling's "how the pool picks an account": keyboard-operable and
   screen-reader-expanded natively, and nothing to keep in sync in state. The
   paragraphs inside are plain .dsm-trae-pool-note - the container only supplies
   the frame, so their own type scale stays authoritative. */
.dsm-trae-pool-more{border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18));border-radius:10px;background:var(--dsw-alias-bg-layer-2,#24262c);overflow:hidden}
.dsm-trae-pool-more-summary{padding:8px 12px;cursor:pointer;user-select:none;color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:12px;font-weight:600;line-height:18px}
.dsm-trae-pool-more-summary:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-pool-more-summary:focus-visible{outline:2px solid rgba(86,134,254,.55);outline-offset:-2px}
.dsm-trae-pool-more-body{display:flex;flex-direction:column;gap:8px;padding:10px 12px 12px;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}
/* Removing an account from the pool is destructive (it drops THIS panel's saved
   membership), so the hover state takes the error tone rather than the neutral
   one every other outline button gets. */
/* The destructive Delete is visually heavier than 移除 from the start (error
   colour idle), so the row shows two distinct actions instead of two greys. */
.dsm-trae-pool-delete{color:var(--dsw-alias-state-error-primary,#d92d20)}
.dsm-trae-pool-delete:hover:not(:disabled){background:rgba(217,45,32,.08)}
.dsm-trae-pool-delete-hint{margin:0;padding:8px var(--dsm-trae-pool-pad-x);border:1px solid var(--dsw-alias-state-error-primary,#d92d20);border-radius:10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0);background:var(--dsw-alias-bg-layer-3,#2a2c33)}
.dsm-trae-pool-busy{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-action-note{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-card{display:flex;flex-direction:column;min-width:0;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:var(--dsm-trae-pool-radius);background:var(--dsw-alias-bg-layer-2,#24262c);overflow:hidden}
.dsm-trae-pool-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px var(--dsm-trae-pool-pad-x) 12px}
.dsm-trae-pool-card-title{margin:0;font-size:13px;line-height:18px;font-weight:600;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-pool-card-tools{display:flex;align-items:center;gap:8px;flex:none}
.dsm-trae-pool-count{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-card .dsm-trae-pool-table{border:0;border-radius:0;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}
.dsm-trae-pool-members{display:flex;flex-direction:column;gap:10px}
/* Prose, not a box. Every explanation in this section is one line of muted
   text; boxing each one is what made the block look like a stack of cards. */
.dsm-trae-pool-actions-end{margin-inline-start:auto}
.dsm-trae-pool-credit-meta{display:block;margin-top:2px;font-size:11px;line-height:16px;white-space:nowrap;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-account-note{grid-column:2;grid-row:3;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-tools-dashed{border:1px dashed var(--dsw-alias-border-l2,#3a3d45);border-radius:var(--dsm-trae-pool-radius);padding:var(--dsm-trae-pool-pad-y) var(--dsm-trae-pool-pad-x)}
.dsm-trae-pool-tool-label{margin-inline-end:auto;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-trae-pool-note{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
/* A setting row: label + hint on the left, the control on the right, one
   rhythm for the switch, the target select and the manual binding. */
.dsm-trae-pool-set{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:var(--dsm-trae-pool-pad-y) var(--dsm-trae-pool-pad-x);border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}
.dsm-trae-pool-set:first-child{border-top:0}
.dsm-trae-pool-set-copy{display:flex;flex-direction:column;gap:3px;min-width:0}
.dsm-trae-pool-set-copy b{font-size:13px;line-height:18px;font-weight:500;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-pool-set-copy span{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-set-ctl{display:flex;align-items:center;gap:8px;flex:none}
.dsm-trae-pool-set-ctl select{min-width:180px}
.dsm-trae-select.dsm-trae-pool-account-select{min-width:180px;max-width:min(320px,50%)}
.dsm-trae-pool-tools{display:flex;flex-direction:column;gap:8px}
.dsm-trae-pool-tool-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dsm-trae-pool-meta{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#9aa0a8);white-space:nowrap}
.dsm-trae-pool-warn-tag{padding:0 6px;border-radius:999px;font-size:11px;line-height:16px;white-space:nowrap}
.dsm-trae-pool-warn-tag-soon{color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-warn-tag-lapsed{color:var(--dsw-alias-state-error-primary,#d92d20)}
.dsm-trae-pool-claim{padding:2px 8px;font-size:12px;line-height:16px}
.dsm-trae-pool-settings-wrap{display:flex;flex-direction:column;gap:10px}

.dsm-trae-pool-settings{display:flex;flex-direction:column;gap:0;padding:0;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:var(--dsm-trae-pool-radius);overflow:hidden;background:var(--dsw-alias-bg-layer-2,#24262c)}
.dsm-trae-pool-members-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.dsm-trae-pool-settings-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.dsm-trae-pool-subtitle{margin:0;font-size:12px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-pool-subnote{margin:2px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-select-actions{display:flex;flex:none;gap:6px}
.dsm-trae-pool-select-actions .dsm-btn,.dsm-trae-pool-row-actions .dsm-btn{padding:4px 10px;font-size:12px;line-height:1.4}
/* CONTAINMENT ROOT（learned from workbuddy 5.19.0 的同一次迁移）。
 *
 * 这张卡同时画在三处，宽度与窗口毫无关系：输入框卡片、整页版（上限 860px）、
 * 以及设置面板的内容列（1400px 屏上是 564px）。本文件里所有 @media 断点测的
 * 都是**视口**，所以在设置面板里它们永远不触发——564px 的列拿到了五列桌面表格，
 * 每个单元格都在截断（实测账号列被压到 76px，一个 9 位数字账号名只剩前 5 个字符）。
 *
 * container-type:inline-size 让下面的断点改测**这张表**的宽度，那才是行真正要
 * 塞进去的宽度。
 *
 * 特意放在表格上而不是祖先上：container-type 会让这个元素成为 position:fixed
 * 后代的包含块。忙碌遮罩 .dsm-trae-veil 与账号导入对话框都是这张表的兄弟节点
 * （挂在 .dsm-trae-pool 或 cardBody 上，不在表格里），放在表格上就让它们继续
 * 相对视口定位——全屏遮罩本来该在那里。表格内部只有表头与成员行，没有 fixed 后代。
 *
 * overflow:hidden 与 container-type 冲突：容器查询要求这个盒子能被"测量"，而
 * overflow 会改变它的块格式化上下文。这里原本就有 overflow:hidden（用来裁圆角），
 * 二者在本例中兼容——表格自身不滚动，只是裁掉子元素的直角。 */
.dsm-trae-pool-table{--dsm-trae-pool-cols:minmax(0,1.4fr) 128px minmax(0,1.2fr) 96px 128px;container-type:inline-size;display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:var(--dsm-trae-pool-radius);overflow:hidden;background:var(--dsw-alias-bg-layer-2,#24262c)}
.dsm-trae-pool-table-no-checkin{--dsm-trae-pool-cols:minmax(0,1.4fr) 128px minmax(0,1.2fr) 128px}
.dsm-trae-pool-row{display:grid;grid-template-columns:var(--dsm-trae-pool-cols);align-items:start;gap:10px;padding:var(--dsm-trae-pool-pad-y) var(--dsm-trae-pool-pad-x);border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}
.dsm-trae-pool-row:first-child{border-top:0}
/* The header carries labels for the first three tracks only: the check-in and
   action cells are self-describing ("Not checked in", "Test"), and a header word
   for an empty cell would be a promise the table does not keep. */
.dsm-trae-pool-col-account{padding-inline-start:23px}
.dsm-trae-pool-row-head{align-items:center;padding:8px var(--dsm-trae-pool-pad-x);border-top:0;background:var(--dsw-alias-bg-layer-3,#2a2c33);font-size:11px;line-height:16px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
/* The row that would bill the next request. Tinted, not bordered: a border here
   reads as a selection control, and the checkbox beside it already is one. */
.dsm-trae-pool-row-current{background:rgba(86,134,254,.07);box-shadow:inset 3px 0 0 var(--dsw-alias-brand-primary,#5686fe)}
.dsm-trae-pool-row-ghost{opacity:.7}
/* The row's buttons: RIGHT side of the row, pulled there by the auto margin
 * (learned from dsh-connect-workbuddy, which had the same complaint).
 *
 * WHY THE AUTO MARGIN AND NOT JUST justify-content. In the wide grid this cell
 * IS the last track, so justify-content:flex-end was enough. But in the
 * NARROW form the row becomes a wrapping flex line, and this cell is a sibling
 * of the account line rather than a track beside it -- so it claimed a line of
 * its own and the row spent a whole line on two small buttons.
 *
 * margin-inline-start:auto moves it to the END of whatever line has room. In
 * the narrow form that is the account line, which is the SHORTEST line in the
 * row, so the buttons land beside the account name where the eye already is
 * instead of under it.
 *
 * flex:none is load-bearing: the account name may truncate, the buttons may
 * not, and a shrunken button is unclickable. */
.dsm-trae-pool-row-actions{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;flex:none;margin-inline-start:auto}
.dsm-trae-pool-account{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:2px 8px;min-width:0}
.dsm-trae-pool-check{display:inline-flex;align-items:center;flex:none;grid-column:1;grid-row:1;cursor:pointer}
.dsm-trae-pool-check input{flex:none;margin:0;cursor:pointer;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-trae-pool-check:has(input:disabled){opacity:.6;cursor:default}
.dsm-trae-pool-account-name{display:flex;align-items:center;gap:6px;min-width:0;grid-column:2;grid-row:1;font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary,#e6e6e6);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-trae-pool-dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-label-dimmed,#777)}
.dsm-trae-pool-dot-ok{background:var(--dsw-alias-state-success-primary,#12b76a)}
.dsm-trae-pool-dot-excluded{background:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-dot-ghost{background:var(--dsw-alias-label-dimmed,#777)}
.dsm-trae-pool-account-tags{display:flex;flex-wrap:wrap;align-items:center;gap:6px;grid-column:2;grid-row:2;min-width:0}
.dsm-trae-pool-tag{padding:0 6px;border-radius:999px;font-size:10px;line-height:16px;white-space:nowrap}
.dsm-trae-pool-member{font-size:11px;line-height:16px;color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-trae-pool-not-member{font-size:11px;line-height:16px;color:var(--dsw-alias-label-dimmed,#9aa0a6)}
.dsm-trae-pool-tag-member{border:1px solid var(--dsw-alias-border-l2,#3a3d45);color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-tag-excluded{background:var(--dsw-alias-state-warn-tertiary,#fef3c7);color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-tag-ghost{border:1px dashed var(--dsw-alias-border-l2,#3a3d45);color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-credit{display:flex;flex-direction:column;gap:1px;min-width:0}
.dsm-trae-pool-credit-num{font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary,#e6e6e6);font-variant-numeric:tabular-nums}
.dsm-trae-pool-credit-label{font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-probe{min-width:0}
.dsm-trae-pool-probe-cell{display:flex;flex-direction:column;gap:1px;min-width:0}
.dsm-trae-pool-probe-outcome{display:flex;align-items:center;gap:5px;font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-trae-pool-probe-ok{color:var(--dsw-alias-state-success-primary,#12b76a)}
.dsm-trae-pool-probe-warn{color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-probe-meta{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#9aa0a8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-trae-pool-probe-detail{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary,#9aa0a8);overflow-wrap:anywhere}
.dsm-trae-pool-probe-none{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-checkin{min-width:0}
.dsm-trae-pool-checkin-state{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-checkin-ok{color:var(--dsw-alias-state-success-primary,#12b76a)}
.dsm-trae-pool-checkin-no{color:var(--dsw-alias-state-warn-primary,#b45309)}
/* "Unknown" and "device already claimed" are facts, not faults: a muted line
   says so without dressing either one up as an error. */
.dsm-trae-pool-checkin-unknown{color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-checkin-device{color:var(--dsw-alias-label-tertiary,#9aa0a8)}
/* The advisory lines share one shape (a quiet bordered box): each is a fact the
   user may need to act on, none of them is an error, and five different
   rectangles in one section would read as five different severities. */
.dsm-trae-pool-ghost-note{margin:0;padding:8px var(--dsm-trae-pool-pad-x);border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0);background:var(--dsw-alias-bg-layer-3,#2a2c33)}
.dsm-trae-pool-unsaved{margin:0;padding:8px var(--dsm-trae-pool-pad-x);border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0);background:var(--dsw-alias-bg-layer-3,#2a2c33)}
.dsm-trae-pool-off-notice{margin:0;padding:0 var(--dsm-trae-pool-pad-x) 10px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-target-none{margin:0;padding:0 12px 10px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-target-stale{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 var(--dsm-trae-pool-pad-x);padding-bottom:10px;color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-warning{display:flex;flex-direction:column;gap:2px;padding:8px var(--dsm-trae-pool-pad-x);border:1px solid var(--dsw-alias-state-warn-secondary,#fbbf24);border-radius:10px;background:var(--dsw-alias-state-warn-tertiary,#fef3c7);color:var(--dsw-alias-state-warn-primary,#b45309);font-size:12px;line-height:18px}
.dsm-trae-pool-warning-title{font-weight:600}
.dsm-trae-pool-warning-hint{opacity:.85}
/* "Empty" is an unfinished setup, not a fault: neutral tone. */
.dsm-trae-pool-warning-empty{border-color:var(--dsw-alias-border-l2,#3a3d45);background:var(--dsw-alias-bg-layer-3,#2a2c33);color:var(--dsw-alias-label-secondary,#c6c9d0)}
/* "Every member is unusable" is the one case that IS the pool's fault, so it
   keeps the warn tone the base class sets. */
.dsm-trae-pool-warning-unusable{border-color:var(--dsw-alias-state-warn-secondary,#fbbf24);background:var(--dsw-alias-state-warn-tertiary,#fef3c7);color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-save-row{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--dsw-alias-border-l2,#36373b);padding-top:12px;position:sticky;bottom:0;z-index:2;padding-bottom:8px;background:var(--dsw-alias-bg-layer-3,#2a2c33)}
.dsm-trae-pool-save-buttons{display:flex;align-items:center;justify-content:flex-end;gap:8px}
.dsm-trae-pool-save-row .dsm-btn{padding:5px 14px;font-size:13px;line-height:1.5}

/* THE TABLE'S NARROW FORM — measured against the table, not the window
 * (learned from workbuddy 5.19.0, which hit the identical bug in the identical
 * move from a plugin card to a settings.section page).
 *
 * 上面的 @media 断点测的都是视口。这张卡现在画在设置面板的内容列里（564px），
 * 视口媒体查询在那里永远不触发：五列表格被塞进 564px，固定轨道 128+96+128 加
 * 四条 10px 间隙与两倍 14px 内边距之后，留给账号名与探针两条弹性轨道的只剩
 * ~144px，实测账号名列 = 76px。
 *
 * 一个阈值，不是两个。中间再插一档「稍微窄一点就少一列」是没有价值的分支：
 * 设置面板那一列正好落在中档里，用户会拿到一个表头对不上的 2×2 网格。表格没有
 * 「稍微窄」的形态值得保留——要么放得下这些列，要么放不下。
 *
 * 放不下的时候，每行变成一张**堆叠卡片**：同样是那五个事实，宽的时候从左往右
 * 读，现在从上往下读。这是让窄行可读而不只是能塞下的关键。
 *
 * 三行，不是五行：整体 flex-direction:column 会把每个单元格推成独立一行，行高翻
 * 倍、读起来像表单而不是一个账号。账号与操作各占满一整行（最需要辨认的一端与
 * 最需要操作的一端），中间三个事实共享中间一行，只有真的放不下时才在自己之间换行。
 *
 * .dsm-trae-pool-row-head 隐藏：它的标签描述的是已经不存在的轨道。 */
@container (max-width:700px){
  /* The dsm-trae-usage hop is load-bearing: series-layout.ts appends a
     dsm-trae-usage dsm-trae-pool-row rule inside this same container query, and
     at 0,2,0 it beat the plain dsm-trae-pool-row below (0,1,0). Measured after
     the 4.14.0 merge: display came back as flex, rows grew 75 -> 111px and the
     check-in fell to line 2 again, while the grid COLUMN rules still applied —
     a half-applied layout, which is why it looked like a padding problem rather
     than a specificity one. */
  .dsm-trae-usage .dsm-trae-pool-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;padding:var(--dsm-trae-pool-pad-y) 12px}
  .dsm-trae-pool-row-head{display:none}
  /* TWO ROWS, EXPLICITLY PLACED. Not "let flex wrap and hope".
   *
   * 每一行账号只有两行：
   *
   *   第一行  [勾选 + 账号名 + 标签]            [签到状态 + 按钮]  [积分]
   *   第二行  [状态 · 测得时间 · 来源]                            [测速] [删除]
   *
   * 以前是 flex-wrap，由内容决定怎么折——结果是同一个表格里的行落在不同的
   * 位置（实测三行分别占地 4 / 4 / 3 个纵向位置），有的积分被挤到中间（x=588）。
   * 网格把每个事实钉在一个格子里：无论账号名多长，积分永远停在同一右缘，
   * 「签到」永远和名字同一行。
   *
   * 列的含义：
   *   1fr   —— 会伸缩的那一列（账号名、状态）。
   *   auto  —— 签到：宽度由文字决定（「已签到」「未签到」「本设备今日已用」）。
   *   auto  —— 积分：贴在右缘，flex:none，不许被压缩。
   *
   * 积分为什么单独成列而不是跟在名字后面：余额是这一行里唯一会被**跨行横向比对**
   * 的数字（「哪个账号还剩得多」），而跟着名字走时三行分别落在 593 / 614 / 498，
   * 眼睛没法竖着扫。等宽字形让小数点也对齐。
   *
   * 状态那一格（probe）独占第二行：它讲的是「能不能用」，与「还剩多少」不是同一个
   * 问题；按钮也放在第二行，因为第一行已经有三个事实，再塞两个按钮会把账号名压窄。 */
  .dsm-trae-usage .dsm-trae-pool-row:not(.dsm-trae-pool-row-head){
    display:grid;grid-template-columns:minmax(0,1fr) auto auto;
    align-items:center;gap:4px 10px}
  .dsm-trae-pool-account{grid-column:1;grid-row:1;display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px;min-width:0}
  .dsm-trae-pool-checkin{grid-column:2;grid-row:1;justify-self:end;flex:none}
  .dsm-trae-pool-credit{grid-column:3;grid-row:1;justify-self:end;flex:none;flex-direction:row;align-items:baseline;gap:2px 8px;text-align:right;font-variant-numeric:tabular-nums}
  .dsm-trae-pool-probe{grid-column:1;grid-row:2;min-width:0}
  /* Spans from the check-in column to the edge: the buttons sit under the figures
     they act on, flush with the credit above them. */
  .dsm-trae-pool-row-actions{grid-column:2/-1;grid-row:2;justify-self:end;justify-content:flex-end;margin-inline-start:0;padding-top:0}
  /* THE PROBE CELL'S OWN COLUMN, collapsed to one line.
   *
   * 这一条是最容易漏掉的：.dsm-trae-pool-probe 只是个 min-width:0 的外层包装，
   * 真正竖排的是它内部的 .dsm-trae-pool-probe-cell（flex-direction:column）。
   * 只改外层包装的话，状态列仍然一句一行，被挤成「正常 / 测得 3 天前 / 来自测速 /
   * upstream answered」四行——旁边只有 12px 间距，整行高度就被这一格撑到 100px
   * 以上，账号名也跟着被压窄（实测截成前几个字符「用户7」）。
   *
   * 改成横排并允许在自己内部换行：这四个事实读起来本来就是一句话
   * （「正常 · 测得 3 天前 · 来自测速 · upstream answered」），宽时从左排到右，
   * 窄时在它们自己之间折行，而不是各自独占一行。 */
  .dsm-trae-pool-probe-cell{flex-direction:row;flex-wrap:wrap;align-items:baseline;gap:2px 8px}
  /* THE ACCOUNT CELL'S OWN GRID, collapsed the same way.
   *
   * 宽的时候它是个三行网格（名字 / 标签 / 探针时间），第一列固定给勾选框。
   * 在窄列里这三行没有理由继续各占一行——它们本来就是一句话
   * （「demo-usr · 已在池中 · 测试于 11/03, 06:35」），横排后名字与这两条短事实
   * 共享一行，只有真的放不下时才折行。勾选框仍然排在最前，并保持垂直居中对齐
   * 到第一行基线（align-self:baseline 会让它沉到行底）。 */
  .dsm-trae-pool-account{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px}
  .dsm-trae-pool-account-name,.dsm-trae-pool-account-tags,.dsm-trae-pool-account-note{grid-column:auto;grid-row:auto}
  .dsm-trae-pool-check{align-self:center}
}
.dsm-trae-pool-dirty{padding:0 6px;border-radius:999px;background:var(--dsw-alias-state-warn-tertiary,#fef3c7);color:var(--dsw-alias-state-warn-primary,#b45309);font-size:10px;line-height:16px}
.dsm-trae-pool-save-error{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary,#d92d20)}
.dsm-trae-pool-target{display:flex;flex-direction:column;gap:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-trae-pool-target-label{color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-trae-select{max-width:220px;padding:2px 6px;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary,#e6e6e6);background:var(--dsw-alias-bg-layer-3,#2a2c33);border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:8px}
.dsm-trae-select:disabled{opacity:.6;cursor:default}
.dsm-trae-pool-log{display:flex;flex-direction:column;gap:6px;padding-top:2px}
.dsm-trae-pool-log-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.dsm-trae-pool-log-empty{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-log-list{display:flex;flex-direction:column;gap:3px;margin:0;padding:0;list-style:none;max-height:160px;overflow-y:auto}
.dsm-trae-pool-log-item{padding:0 0 0 8px;border-left:2px solid var(--dsw-alias-border-l2,#3a3d45);font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-trae-pool-log-info{border-left-color:var(--dsw-alias-border-l2,#3a3d45)}
.dsm-trae-pool-log-ok{border-left-color:var(--dsw-alias-state-success-primary,#12b76a)}
.dsm-trae-pool-log-warn{border-left-color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-log-error{border-left-color:var(--dsw-alias-state-error-primary,#d92d20)}
.dsm-trae-pool-log-text{overflow-wrap:anywhere}
/* THE OPTIONAL SIDEBAR PAGE (Config.sidebarPanel).
 *
 * The same card body, drawn as a full page in the centre column: no card border
 * or header, its own heading, and a scrolling column so a long pool log cannot
 * push the header off screen. Widths are capped at the host's own reading width
 * rather than the viewport, which is what keeps a wide monitor from stretching
 * the account table into unreadable rows.
 *
 * The page's back control reuses the card's own button shape but not its
 * dsm-btn class: this one is navigation, not an action. Its caret is drawn in
 * CSS, for the same reason the card's chevron is — the host primitives' icon
 * names are not a stable contract across DSH releases. */
.dsm-trae-page{box-sizing:border-box;height:100%;display:flex;flex-direction:column;align-items:center;gap:20px;padding:28px clamp(24px,4vw,48px) 48px;overflow:auto;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-page>*{width:100%;max-width:860px}
.dsm-trae-page-head{display:flex;flex-direction:column;gap:6px}
.dsm-trae-page-back{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2,#36373b);background:var(--dsw-alias-bg-layer-1,#17181b);color:var(--dsw-alias-label-secondary,#c7c7c7);border-radius:8px;padding:5px 12px;display:inline-flex;align-items:center;gap:6px;align-self:flex-start;font-size:13px;line-height:20px}
.dsm-trae-page-back:hover{color:var(--dsw-alias-label-primary,#e6e6e6);border-color:var(--dsw-alias-label-dimmed,#777)}
.dsm-trae-page-back-caret{display:inline-block;width:7px;height:7px;border-left:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:rotate(45deg);margin-right:2px}
.dsm-trae-page-icon{width:40px;height:40px;border-radius:9px;align-self:flex-start;margin-top:14px}
.dsm-trae-page-title{margin:0;font-size:20px;font-weight:600;line-height:1.4}
.dsm-trae-page-desc{margin:0;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#999)}
.dsm-trae-page-body .dsm-trae-usage{padding:20px 20px 8px;border:1px solid var(--dsw-alias-border-l2,#36373b);background:var(--dsw-alias-bg-layer-3,#202126);border-radius:12px}
/* The settings.section page. The shell already owns the panel, the nav row and
 * the scrolling .options column (which brings its own 24px side padding), so
 * this surface adds NO frame of its own: no second border, no second card, and
 * deliberately no negative margins to "reclaim" the shell's padding. It is a
 * plain column so the sections below stack the same way they do in the card. */
.dsm-trae-section{display:flex;flex-direction:column;gap:14px;color:var(--dsw-alias-label-primary,#e6e6e6)}
/* 页头两行：标题一行，简介一行（learned from workbuddy 5.19.0）。
 *
 * 原来是 18px/600 的大标题加一行 13px 说明，在 564px 的列里要占 70px。压到
 * 15px/22px 的标题加 12px/18px 的说明后是 60px，省下的 10px 直接给了账号池——
 * 而面板本身已有一层标题栏，「设置」已经写在最上面，这里再喊一遍大标题是本插件
 * 自己的第二层标题，不是外壳的。
 *
 * 用 grid 而不是两个 flex 子项：标题和说明各自成行，中间不留 flex gap，行距由
 * row-gap:2px 精确控制（flex 的 gap 会同时作用在两者之间，量出来是 6px）。 */
.dsm-trae-section-head{display:grid;grid-template-columns:minmax(0,1fr);row-gap:2px;align-items:start}
.dsm-trae-section-title{margin:0;font-size:15px;font-weight:600;line-height:22px}
.dsm-trae-section-desc{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#999)}
.dsm-trae-panel-icon{display:block;border-radius:4px;flex:none}
` + seriesLayoutCss("trae");
		/**
		* Composer-row readout styles, injected by the readout itself.
		*
		* SEPARATE from `TRAE_CARD_CSS`, and that is not tidiness: the card's CSS is
		* only injected when the settings card module loads, so putting the composer's
		* rules in it means the readout renders UNSTYLED in the composer toolbar 鈥?
		* which is exactly what shipped in 2.13.0鈥?.13.4. The trigger fell back to the
		* browser's default button box, and the panel, without `position: fixed`, had
		* its inline left/top ignored and rendered nowhere useful.
		*
		* `tests/composer-styles.spec.tsx` now asserts that every class this component
		* renders has a rule here, so a rule cannot go missing without a test failing.
		*/
		const COMPOSER_POINTS_CSS = `
/* The readout is plain composer text 鈥?no border, no fill at rest. The padding
   is only the click target, invisible until the pointer arrives. */
.dsm-trae-composer-points{display:inline-flex;align-items:center;min-width:0}
.dsm-trae-composer-points-trigger{
  appearance:none;display:inline-flex;align-items:center;align-self:stretch;
  padding:2px 6px;border:0;border-radius:6px;background:transparent;
  /* EXPLICIT, not inherit. The composer row's own font and body colour are
     noticeably larger and darker than the neighbouring controls 鈥?a credit
     readout is secondary information and must not shout. 12px matches this
     plugin's original line; label-tertiary matches the shell's own composer-row
     control (ContextMeter), which is the sibling this reads alongside. */
  font-size:12px;line-height:18px;
  color:var(--dsw-alias-label-tertiary,#999);
  white-space:nowrap;cursor:pointer;
  font-variant-numeric:tabular-nums;
}
.dsm-trae-composer-points-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}
.dsm-trae-composer-points-trigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
/* The panel is portaled to document.body and positioned from the trigger, so it
   MUST be fixed 鈥?otherwise the left/top it measures are ignored and it lands in
   document flow. All material comes from shell tokens so it follows the theme. */
/* 264px, not the 248px this started as (m02477). The header holds a title plus
   two icon+word controls now, and measured in the browser the English pair
   ("Refresh" + "Settings") needed 233px of content where 248px of panel leaves
   222 — the settings pill overflowed its own header by 11px. Widening the panel
   is the honest fix: the alternative is renaming the owner's words, and
   "Refresh"/「刷新」 are what they asked for. */
.dsm-trae-composer-panel{
  position:fixed;z-index:1100;box-sizing:border-box;
  width:min(264px,calc(100vw - 24px));padding:12px;
  border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.28));
  border-radius:var(--dsw-radius-lg,14px);
  background:var(--dsw-specific-menu,Canvas);
  box-shadow:var(--dsw-elevation-prominent,0 8px 32px rgba(0,0,0,.22));
  backdrop-filter:var(--dsw-menu-backdrop-filter,none);
  font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#444);
}
.dsm-trae-composer-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
/* nowrap: the header is a title plus an 11px control in a ~250px popover, and
   without it the TITLE broke across two lines the moment the settings control
   joined the row — measured on the live Desktop host for the sibling plugin.
   The title is the one thing that must stay on one line; what follows it is
   short by construction. */
.dsm-trae-composer-panel-title{flex:none;white-space:nowrap;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,CanvasText)}
/* The header's right-hand control: the link to this plugin's settings.
   A wrapper rather than an auto margin on the button, because the button is NOT
   always rendered (a host with no route renders none) and a wrapper that is
   always present keeps the header layout identical either way. */
.dsm-trae-composer-panel-actions{flex:none;margin-left:auto;display:flex;align-items:center;gap:6px}
/* THE POOL TEST BUTTON (m02091, restyled m02477), sitting to the settings
   pill's left.

   A GHOST control: no border, no fill, an icon plus a word — and the FILL
   appears only on hover. That shape is the owner's call (the reference shows a
   bare circular arrow and 「刷新」 beside the tinted settings pill) and it also
   reads correctly: the two controls are different kinds of thing. Settings
   navigates, so it carries the brand fill and behaves like a pill; this one
   re-runs a batch in place, so it stays quiet until the pointer arrives.

   What the earlier bordered pill got wrong: a 1px outline at rest made it look
   like the card's dsm-btn-outline (a save/cancel control), and two bordered or
   two tinted shapes in a 264px header read as one segmented control instead of
   two different actions. The icon is a circular arrow, not a gear — same family,
   different verb. */
.dsm-trae-composer-panel-test{
  appearance:none;flex:none;
  display:inline-flex;align-items:center;gap:4px;
  padding:3px 6px;
  border:1px solid transparent;border-radius:999px;background:transparent;
  color:var(--dsw-alias-label-secondary,#444);
  font:inherit;font-size:11px;line-height:16px;
  white-space:nowrap;cursor:pointer;
  transition:background-color .12s ease,border-color .12s ease,color .12s ease;
}
.dsm-trae-composer-panel-test:hover:not(:disabled){
  background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.10));
  border-color:transparent;
  color:var(--dsw-alias-label-primary,CanvasText);
}
.dsm-trae-composer-panel-test:active{background:rgba(127,127,127,.16)}
.dsm-trae-composer-panel-test:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-trae-composer-panel-test:disabled{opacity:.5;cursor:default}
/* The arrow does not shrink when the label is a longer word ("Refresh" vs
   「刷新」): a flex item defaults to shrinking, which squashes the 12px icon into
   an oval on a narrow popover — the same trap the gear beside it documents. */
.dsm-trae-composer-panel-test-icon{flex:none;display:block}
/* While the batch runs the arrow TURNS — 900ms a revolution. A disabled button
   whose icon sits still reads as broken, and this batch is serial: the slowest
   account decides when it ends, so "did my press land?" is a real question for
   as long as the panel is open. Fast enough to read as motion, slow enough not
   to look like a rendering fault. */
.dsm-trae-composer-panel-test-icon-spin{animation:dsm-trae-panel-test-spin .9s linear infinite}
@keyframes dsm-trae-panel-test-spin{to{transform:rotate(360deg)}}
/* The label never wraps. Two lines in a 16px-tall control would push the header
   taller and unstick the table below it. */
.dsm-trae-composer-panel-test-label{flex:none;white-space:nowrap}
/* Reduced motion: the colour transition is decoration, and the hover state is
   still fully visible without it. */
@media (prefers-reduced-motion:reduce){
  .dsm-trae-composer-panel-test{transition:none}
  /* The motion is dropped but the STATE SIGNAL must not be: the icon keeps a
     distinct dimmed look, and the label already switches to 「刷新中…」. Without
     this the spinning arrow would simply freeze at an arbitrary angle and read
     as a static icon — i.e. exactly the "did my press land?" silence that the
     rotation was added to fix. */
  .dsm-trae-composer-panel-test-icon-spin{animation:none;opacity:.5}
}
/* The batch's own outcome line: a NOTE (it succeeded but not everything
   answered), not an error. Sized like the footer so it reads as a report. */
.dsm-trae-composer-panel-note{
  margin:8px 0 0;font-size:11px;line-height:16px;
  color:var(--dsw-alias-label-secondary,#444);
}
/* PORTED VERBATIM IN SHAPE from the sibling dsh-connect-workbuddy
   (ComposerCredits), so the two connectors' popovers agree: a quiet tinted
   PILL, not a bordered button and not an underlined link.

   Why not the bordered button this started as: navigating away is not the
   header's primary action, and a bordered box beside a 13px title reads as a
   toolbar. Why not an underlined link: a one-word underline reads as body text
   that happens to be clickable — in a 13px header the eye does not register it
   as a control at all. The tinted fill plus the gear give it a SHAPE at rest,
   which is where the affordance is actually needed (the underline only appeared
   on hover, i.e. after the user already knew). The fill is the brand colour at
   10%, so it reads as "secondary action in this product" rather than as a fourth
   grey chip beside the title.

   Self-contained: the dsm-btn primitive lives in TRAE_CARD_CSS, which the
   composer never loads. */
.dsm-trae-composer-panel-settings{
  appearance:none;flex:none;
  display:inline-flex;align-items:center;gap:4px;
  padding:3px 8px 3px 6px;
  border:1px solid transparent;border-radius:999px;
  background:rgba(86,134,254,.10);
  color:var(--dsw-alias-brand-primary,#5686fe);
  font:inherit;font-size:11px;line-height:16px;font-weight:500;
  cursor:pointer;
  transition:background-color .12s ease,border-color .12s ease,color .12s ease;
}
.dsm-trae-composer-panel-settings:hover:not(:disabled){
  background:rgba(86,134,254,.18);
  border-color:rgba(86,134,254,.34);
  color:var(--dsw-alias-brand-primary,#5686fe);
}
.dsm-trae-composer-panel-settings:active{background:rgba(86,134,254,.26)}
.dsm-trae-composer-panel-settings:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-trae-composer-panel-settings:disabled{opacity:.5;cursor:default}
/* The gear does not shrink when the label is a longer word ("Settings" vs
   "设置"): a flex item defaults to shrinking, which would squash the icon into
   an oval on a narrow popover. */
.dsm-trae-composer-panel-settings-icon{flex:none;display:block}
/* The label never wraps. Two lines in a 16px-tall pill would push the header
   taller and unstick the table below it. */
.dsm-trae-composer-panel-settings-label{flex:none;white-space:nowrap}
/* Reduced motion: the colour transition is decoration, and the hover state is
   still fully visible without it. */
@media (prefers-reduced-motion:reduce){
  .dsm-trae-composer-panel-settings{transition:none}
}
/* The panel is a TABLE: one row per account in the region, one figure (the
   general balance) per row, and a row click switches accounts.

   Rhythm is deliberate: the header sits on a hairline, the switch button owns
   ALL horizontal padding (and pulls back by the same amount so its label lines
   up with the header), and every row is the same height. A misaligned first
   column is what makes a two-column popover read as broken. */
.dsm-trae-composer-panel-table{
  width:100%;border-collapse:collapse;
  font-size:12px;line-height:18px;
}
.dsm-trae-composer-panel-table thead th{
  padding:0 0 7px;font-weight:500;text-align:left;font-size:11px;
  color:var(--dsw-alias-label-tertiary,GrayText);
  border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.24));
}
.dsm-trae-composer-panel-num{
  text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;
}
.dsm-trae-composer-panel-table thead th.dsm-trae-composer-panel-num{padding-right:0}
.dsm-trae-composer-panel-table tbody th{
  padding:0;font-weight:400;text-align:left;vertical-align:middle;
}
.dsm-trae-composer-panel-table tbody td{
  padding:4px 0;vertical-align:middle;
  color:var(--dsw-alias-label-primary,CanvasText);
}
/* The current account reads as current without shouting: a filled dot and a
   slightly heavier weight. Disabled 鈥?pressing it would write a selection that
   has not changed. */
.dsm-trae-composer-panel-table tbody tr.dsm-trae-composer-panel-row-current td{font-weight:600}
.dsm-trae-composer-panel-switch{
  appearance:none;display:flex;align-items:center;gap:7px;
  width:100%;padding:4px 6px;margin-left:-6px;
  border:0;border-radius:6px;background:transparent;
  color:inherit;font:inherit;font-size:12px;text-align:left;cursor:pointer;
  white-space:nowrap;overflow:hidden;
}
/* The ellipsis the account NAME gets, in both branches: the switchable row and
   the read-only one. A zero min-width is what lets a flex item shrink far
   enough for the ellipsis to appear at all. */
.dsm-trae-composer-panel-switch>span:last-child,
.dsm-trae-composer-panel-account>span:last-child{overflow:hidden;text-overflow:ellipsis;min-width:0}
/* Hover belongs to the switch, not the row: the number cell is not clickable,
   so lighting it up would promise an action it cannot perform. */
.dsm-trae-composer-panel-switch:hover:not(:disabled){
  background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14));
}
.dsm-trae-composer-panel-switch:focus-visible{
  outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:-1px;
}
.dsm-trae-composer-panel-switch:disabled{cursor:default}
/* The row without a switch: the account pool is choosing the billing account,
   so the name is a READOUT and not an action. Same shape as the button, minus
   the pointer — the dot still marks the account in use. */
.dsm-trae-composer-panel-account{
  display:flex;align-items:center;gap:7px;
  width:100%;padding:4px 6px;margin-left:-6px;
  font-size:12px;text-align:left;
  white-space:nowrap;overflow:hidden;
}
.dsm-trae-composer-panel-dot{
  flex:none;width:7px;height:7px;border-radius:50%;
  background:var(--dsw-alias-label-dimmed,rgba(127,127,127,.5));
}
.dsm-trae-composer-panel-table tr.dsm-trae-composer-panel-row-current .dsm-trae-composer-panel-dot{
  background:var(--dsw-alias-state-success-primary,#22c55e);
}
.dsm-trae-composer-panel-foot{
  display:flex;justify-content:space-between;gap:8px;
  margin-top:9px;padding-top:7px;
  border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.24));
  font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,GrayText);
}
.dsm-trae-composer-panel-empty{margin:0;color:var(--dsw-alias-label-tertiary,GrayText)}
.dsm-trae-composer-panel-error{margin:8px 0 0;color:var(--dsw-alias-state-error-primary,#d92d20);font-size:11px;line-height:16px}
/* Credit-expiry notice. Three tones by urgency, so the 24-hour case cannot be
   mistaken for the 7-day one at a glance. Reads as an advisory, not an error:
   the account works fine, the credit is simply about to lapse. */
.dsm-trae-expiry{
  display:flex;flex-direction:column;gap:2px;
  margin-top:9px;padding:8px 10px;border:1px solid;border-radius:8px;
  font-size:11px;line-height:16px;
}
.dsm-trae-expiry-soon{
  border-color:var(--dsw-alias-state-warn-secondary,#fbbf24);
  background:var(--dsw-alias-state-warn-tertiary,#fef3c7);
  color:var(--dsw-alias-label-primary,#1f2329);
}
.dsm-trae-expiry-days{
  border-color:var(--dsw-alias-state-warn-secondary,#fbbf24);
  background:transparent;
  color:var(--dsw-alias-label-primary,#1f2329);
}
.dsm-trae-expiry-week{
  border-color:var(--dsw-alias-border-l2,rgba(127,127,127,.36));
  background:transparent;
  color:var(--dsw-alias-label-secondary,GrayText);
}
.dsm-trae-expiry-lapsed{
  border-color:var(--dsw-alias-border-l2,rgba(127,127,127,.36));
  background:transparent;
  color:var(--dsw-alias-label-tertiary,GrayText);
}
.dsm-trae-expiry-detail{font-size:11px;line-height:16px;opacity:.85}
`;
		//#endregion
		//#region src/client/BusyOverlay.tsx
		/**
		* The shared busy veil's spinner: an arc that breathes while it turns.
		*
		* Deliberately the host's own state-spinner shape (dsh's `_dsh-state-dot-spin`)
		* rather than a border-ring: a two-tone CSS ring at .7s read as a loading
		* indicator from another decade and was out of step with every spinner in the
		* shell. The motion lives in CSS (`dsm-trae-veil-spin` / `-dash`), so this
		* element only describes the geometry; `currentColor` lets it inherit whatever
		* tier it sits in.
		*
		* `aria-hidden` because the veil's `role="status"` already announces the
		* message — a second announcement from a decorative arc is noise.
		*/
		function VeilSpinner() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: "dsm-trae-veil-spinner",
				viewBox: "0 0 20 20",
				"aria-hidden": "true",
				focusable: "false",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					className: "dsm-trae-veil-spinner-track",
					cx: "10",
					cy: "10",
					r: "8",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "2"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					className: "dsm-trae-veil-spinner-arc",
					cx: "10",
					cy: "10",
					r: "8",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "2",
					strokeLinecap: "round"
				})]
			});
		}
		/**
		* The veil. Deliberately NOT a modal dialog: it carries no focusable control
		* and no dismissal — there is nothing for the user to decide, only a step to
		* wait through. `aria-busy` plus a polite live region state that to screen
		* readers, which is the whole accessibility contract a wait screen needs.
		*/
		function BusyOverlay({ message, hint, visible }) {
			if (!visible) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsm-trae-veil",
				role: "status",
				"aria-busy": "true",
				"aria-live": "polite",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsm-trae-veil-card",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(VeilSpinner, {}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-veil-text",
							children: message
						}),
						hint === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-veil-hint",
							children: hint
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/pool-test.ts
		/**
		* How long one `test` request may take before the caller gives up.
		*
		* A probe has its own upstream deadline, but a stalled connection (a restarting
		* Host, a dropped keep-alive) has none: without this the run button stays
		* disabled until the page is reloaded, which reads as "测速卡住了". Sized for a
		* full batch — a serial run with a gap between accounts — rather than for one
		* account, because aborting a healthy batch half way through would report the
		* members it never reached as failures.
		*/
		const POOL_TEST_TIMEOUT_MS = 18e4;
		/**
		* Handle ONE NDJSON line of a `test` answer. A non-JSON line is skipped; a
		* `{reason:'pool-failed'}` line reports the failure and counts as "saw
		* something". Returns whether the line was usable, so the caller can tell "the
		* route answered nothing parseable" (a bug to surface) from "not finished yet".
		*/
		function applyTestLine(line, t, onRow, onFailure) {
			if (line.trim() === "") return false;
			let parsed;
			try {
				parsed = JSON.parse(line);
			} catch {
				return false;
			}
			if (parsed.row !== void 0) {
				onRow(parsed.row);
				return true;
			}
			if (parsed.rows !== void 0) {
				for (const r of parsed.rows) onRow(r);
				return true;
			}
			if (parsed.reason === "pool-failed") {
				onFailure(parsed.error ?? t("row.poolLogGeneric"));
				return true;
			}
			return false;
		}
		/**
		* Read the answer line by line AS IT ARRIVES.
		*
		* The Host streams one line per account, but `response.text()` waits for the
		* whole body: with a slow probe the surface sat on "逐个处理账号中…" and looked
		* frozen (a single member could take half a minute). Reading the body stream
		* makes each finished account appear immediately, and an empty/failed stream
		* still ends the loop instead of hanging the busy state forever.
		*/
		async function* testLinesOf(response) {
			const body = response.body;
			if (body === null) {
				for (const line of (await response.text()).split(/\r?\n/)) yield line;
				return;
			}
			const reader = body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				let cut = buffer.indexOf("\n");
				while (cut >= 0) {
					yield buffer.slice(0, cut);
					buffer = buffer.slice(cut + 1);
					cut = buffer.indexOf("\n");
				}
			}
			buffer += decoder.decode();
			if (buffer.trim() !== "") yield buffer;
		}
		/** A human label for every value of {@link TraeWebPoolOutcome}. */
		function outcomeLabel(outcome, t) {
			switch (outcome) {
				case "ok": return t("row.poolProbeOk");
				case "rate-limited": return t("row.poolProbeRateLimited");
				case "model-busy": return t("row.poolProbeModelBusy");
				case "out-of-credit": return t("row.poolProbeOutOfCredit");
				case "credential-rejected": return t("row.poolProbeCredentialRejected");
				case "policy-rejected": return t("row.poolProbePolicyRejected");
				case "plan-gated": return t("row.poolProbePlanGated");
				case "unavailable": return t("row.poolProbeUnavailable");
				case "not-found": return t("row.poolProbeNotFound");
				case "failed": return t("row.poolProbeFailed");
			}
		}
		//#endregion
		//#region src/client/AccountPool.tsx
		/**
		* The account-pool card UI for Trae, ported from the WorkBuddy sibling.
		*
		* Mounted by {@link TraeUsageCard} inside the signed-in branch, below the
		* account table, rendered only when the usage document carries `pool` (the Host
		* omits it when the panel is unconfigured).
		*
		* This half of the feature is deliberately dumb about rules: every verdict an
		* account needs — credits, exclusion, the in-pool flag, the serving row — comes
		* pre-derived by the Host (`TraeWebPoolAccount`), so the card never re-ranks on
		* its own idea of "which account should bill". It drafts the saved preferences
		* (`TraePoolPreferences`) and writes them back through the card's verified
		* regions-write helper.
		*/
		/**
		* A finite number or the fallback.
		*
		* The usage document is served by a Host that may be OLDER than this bundle (the
		* card ships in the client bundle and updates on refresh, the Host only on
		* restart), so a field the Host does not send yet must degrade to a usable default
		* instead of rendering `undefined` into a select.
		*/
		function numberOr(value, fallback) {
			return typeof value === "number" && Number.isFinite(value) ? value : fallback;
		}
		/**
		* Probe sizes the card offers, in tokens. `0` is the minimal one-word probe.
		*
		* Deliberately a short, coarse list: the number is a spend decision (a probe at
		* 50k tokens costs real credit on every account in the batch), and offering a
		* free-text field invites values the upstream rounds away anyway.
		*/
		const PROBE_INPUT_TOKEN_CHOICES = [
			0,
			1e4,
			2e4,
			3e4,
			5e4,
			1e5
		];
		/** Compare two arrays of ids order-insensitively. */
		function sameIds(a, b) {
			const lhs = [...a ?? []].sort();
			const rhs = [...b ?? []].sort();
			return lhs.length === rhs.length && lhs.every((v, i) => v === rhs[i]);
		}
		function formatNumber$1(value) {
			return new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 }).format(value);
		}
		/** `MM/DD, HH:mm` — the absolute stamp a row shows under its age. */
		function shortWhen(atMs) {
			const at = new Date(atMs);
			const pad = (value) => value < 10 ? `0${value}` : String(value);
			return `${pad(at.getMonth() + 1)}/${pad(at.getDate())}, ${pad(at.getHours())}:${pad(at.getMinutes())}`;
		}
		/** `MM/DD`, for a line that has room for a date but not a clock time. */
		function shortDate(atMs) {
			const at = new Date(atMs);
			const pad = (value) => value < 10 ? `0${value}` : String(value);
			return `${pad(at.getMonth() + 1)}/${pad(at.getDate())}`;
		}
		function relativeAt(atMs, now, t) {
			const mins = Math.max(0, Math.round((now - atMs) / 6e4));
			if (mins < 1) return t("row.poolAgoNow");
			if (mins < 60) return t("row.poolAgoMin", { n: mins });
			const hours = Math.round(mins / 60);
			if (hours < 24) return t("row.poolAgoHour", { n: hours });
			return t("row.poolAgoDay", { n: Math.round(hours / 24) });
		}
		/** A human label for every value of {@link TraeWebPoolExclusion}. */
		function exclusionLabel(exclusion, t) {
			switch (exclusion) {
				case "unusable": return t("row.poolExcludedUnusable");
				case "rate-limited": return t("row.poolExcludedRateLimited");
				case "model-busy": return t("row.poolExcludedModelBusy");
				case "out-of-credit": return t("row.poolExcludedOutOfCredit");
				case "credential-rejected": return t("row.poolExcludedCredentialRejected");
				case "policy-rejected": return t("row.poolExcludedPolicyRejected");
				case "plan-gated": return t("row.poolExcludedPlanGated");
				case "not-found": return t("row.poolExcludedNotFound");
				case "unavailable": return t("row.poolExcludedUnavailable");
				case "failed": return t("row.poolExcludedFailed");
			}
		}
		function probeSourceLabel(source, t) {
			switch (source) {
				case "test-batch": return t("row.poolProbeSourceTest");
				case "live-request": return t("row.poolProbeSourceLive");
				case void 0: return t("row.poolProbeSourceUnknown");
			}
		}
		/** The tone to log a test row result under. */
		function outcomeTone(outcome) {
			return outcome === "ok" ? "ok" : "warn";
		}
		/** The serving account (Host's answer), for the header badge. */
		function servingAccount(pool) {
			return pool.accounts.find((account) => account.current === true);
		}
		/**
		* Render a route refusal into a card-safe string. The error statuses the Host
		* can answer with are listed in the card doc; every one here must render as
		* TEXT (never crash). `origin-not-trusted`/`pool-unavailable` carry no body, so
		* they get a dedicated copy line keyed off the status.
		*/
		function renderRouteError(t, status, body) {
			if (status === 403 && body?.reason === "origin-not-trusted") return t("row.poolErrOrigin");
			if (status === 503) return t("row.poolErrUnavailable");
			if (status === 405) return t("row.poolErrMethod");
			if (status === 400) return t("row.poolErrBadRequest");
			if (status === 409) switch (body?.reason) {
				case "no-members": return t("row.poolErrNoMembers");
				case "no-live-members": return t("row.poolErrNoLiveMembers");
				case "target-model-stale": return t("row.poolErrTargetStale");
				case "no-free-model": return t("row.poolErrNoFreeModel");
				default: return t("row.poolErrConflict");
			}
			return t("row.poolErrGeneric", { status: String(status) });
		}
		/** Whether one row is a saved member (dictates the in-pool tag / ghost badge). */
		function AccountPool({ panel, pool, models, t, settingsScope, onChanged, onRefresh, tools, topActions, details, claims, onClaim, deviceClaimed = false, onBind, bindingBusy }) {
			const [settingsTick, setSettingsTick] = (0, react.useState)(0);
			const saved = (0, react.useMemo)(() => {
				const base = regionPoolOf(settingsScope?.getSnapshot().value, panel);
				return {
					enabled: base.enabled === true,
					autoCheckin: base.autoCheckin === true,
					targetModelId: base.targetModelId ?? pool.targetModelId ?? pool.staleTargetModelId ?? "",
					memberAccountIds: [...base.memberAccountIds ?? []],
					probeInputTokens: numberOr(base.probeInputTokens, numberOr(pool.probeInputTokens, 0))
				};
			}, [
				settingsTick,
				settingsScope,
				panel,
				pool.targetModelId,
				pool.staleTargetModelId,
				pool.probeInputTokens
			]);
			/**
			* Whether the running Host knows the probe-size preference at all.
			*
			* The card bundle and the Host update on different clocks (a page refresh vs a
			* restart), so an older Host serves a pool document without this field. Writing
			* a key that Host's schema does not declare would be dropped on the way in and
			* then fail the read-back check — a save that reports an error and changes
			* nothing. Hiding the row is the honest state: this Host cannot do it yet.
			*/
			const probeSupported = typeof pool.probeInputTokens === "number";
			const [enabled, setEnabled] = (0, react.useState)(saved.enabled);
			const [autoCheckin, setAutoCheckin] = (0, react.useState)(saved.autoCheckin);
			const [targetModelId, setTargetModelId] = (0, react.useState)(saved.targetModelId ?? "");
			const [probeInputTokens, setProbeInputTokens] = (0, react.useState)(saved.probeInputTokens);
			const [selected, setSelected] = (0, react.useState)(() => new Set(saved.memberAccountIds ?? []));
			const [busy, setBusy] = (0, react.useState)(void 0);
			const [saveError, setSaveError] = (0, react.useState)(void 0);
			const [moreRulesOpen, setMoreRulesOpen] = (0, react.useState)(false);
			const [testing, setTesting] = (0, react.useState)(void 0);
			const [rows, setRows] = (0, react.useState)({});
			const [deletingIds, setDeletingIds] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const [deleteHint, setDeleteHint] = (0, react.useState)(void 0);
			const [log, setLog] = (0, react.useState)([]);
			const [now, setNow] = (0, react.useState)(Date.now());
			const logId = (0, react.useRef)(0);
			const mountRef = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				mountRef.current = true;
				return () => {
					mountRef.current = false;
				};
			}, []);
			(0, react.useEffect)(() => settingsScope?.subscribe(() => {
				setSettingsTick((tick) => tick + 1);
			}), [settingsScope]);
			const pushLog = (tone, text) => {
				if (!mountRef.current) return;
				logId.current += 1;
				const id = logId.current;
				setLog((prev) => [...prev.slice(-49), {
					id,
					tone,
					text
				}]);
			};
			const knownIds = (0, react.useMemo)(() => new Set(pool.accounts.map((account) => account.accountId)), [pool]);
			const ghosts = (0, react.useMemo)(() => {
				const names = pool.memberNames ?? {};
				const result = [];
				for (const id of saved.memberAccountIds ?? []) {
					if (knownIds.has(id)) continue;
					const name = names[id];
					result.push({
						accountId: id,
						accountName: name === void 0 || name === "" ? id : name
					});
				}
				return result;
			}, [
				saved,
				pool,
				knownIds
			]);
			const dirty = enabled !== saved.enabled || autoCheckin !== saved.autoCheckin || (targetModelId ?? "") !== (saved.targetModelId ?? "") || probeSupported && probeInputTokens !== saved.probeInputTokens || !sameIds([...selected], saved.memberAccountIds);
			const writable = settingsScope?.getSnapshot().writable === true;
			(0, react.useEffect)(() => {
				setAutoCheckin(saved.autoCheckin);
			}, [panel, saved.autoCheckin]);
			const savedMemberKey = (0, react.useMemo)(() => [...saved.memberAccountIds ?? []].sort().join("\0"), [saved]);
			(0, react.useEffect)(() => {
				setEnabled(saved.enabled);
			}, [panel, saved.enabled]);
			(0, react.useEffect)(() => {
				setTargetModelId(saved.targetModelId ?? "");
			}, [panel, saved.targetModelId]);
			(0, react.useEffect)(() => {
				setProbeInputTokens(saved.probeInputTokens);
			}, [panel, saved.probeInputTokens]);
			(0, react.useEffect)(() => {
				setSelected(new Set(saved.memberAccountIds ?? []));
			}, [panel, savedMemberKey]);
			const savedKey = (0, react.useMemo)(() => `${panel}:${saved.enabled}:${saved.targetModelId ?? ""}:${saved.probeInputTokens}:${savedMemberKey}`, [
				panel,
				saved.enabled,
				saved.targetModelId,
				saved.probeInputTokens,
				savedMemberKey
			]);
			(0, react.useEffect)(() => {
				setSaveError(void 0);
			}, [savedKey]);
			const toggleMember = (accountId) => {
				setSelected((prev) => {
					const next = new Set(prev);
					if (next.has(accountId)) next.delete(accountId);
					else next.add(accountId);
					return next;
				});
			};
			const selectAll = () => {
				setSelected(/* @__PURE__ */ new Set([...pool.accounts.map((a) => a.accountId), ...saved.memberAccountIds ?? []]));
			};
			const selectNone = () => setSelected(/* @__PURE__ */ new Set());
			const discard = () => {
				setEnabled(saved.enabled);
				setAutoCheckin(saved.autoCheckin);
				setTargetModelId(saved.targetModelId ?? "");
				setProbeInputTokens(saved.probeInputTokens);
				setSelected(new Set(saved.memberAccountIds ?? []));
				setSaveError(void 0);
				pushLog("info", t("row.poolLogDiscarded"));
				setNow(Date.now());
			};
			const save = async () => {
				if (!writable || busy !== void 0) return;
				setBusy("save");
				setSaveError(void 0);
				try {
					const next = {
						enabled,
						autoCheckin,
						...targetModelId === "" ? {} : { targetModelId },
						memberAccountIds: [...selected],
						...probeSupported ? { probeInputTokens } : {}
					};
					await writeSettingsField(settingsScope, "regions", nextRegionPool(settingsScope.getSnapshot().value, panel, next), (readBack) => {
						const readPool = regionPoolOf(readBack, panel);
						return readPool.autoCheckin === next.autoCheckin && readPool.enabled === (next.enabled ?? false) && sameIds(readPool.memberAccountIds, next.memberAccountIds) && (readPool.targetModelId ?? "") === (next.targetModelId ?? "") && (!probeSupported || (readPool.probeInputTokens ?? 0) === probeInputTokens);
					});
					pushLog("ok", t("row.poolLogSaved"));
					onChanged?.();
					onRefresh?.();
					setNow(Date.now());
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					setSaveError(t("row.poolSaveFailed", { message }));
					pushLog("error", t("row.poolLogSaveFailed"));
				} finally {
					if (mountRef.current) setBusy(void 0);
				}
			};
			const runTest = async () => {
				if (busy !== void 0) return;
				const members = [...selected];
				if (members.length === 0) {
					pushLog("warn", t("row.poolLogNoMembers"));
					return;
				}
				setBusy("test");
				setRows({});
				setTesting({ done: 0 });
				setNow(Date.now());
				const targetLabel = targetModelId === "" ? t("row.poolTargetAutoOption") : models.find((m) => m.id === targetModelId)?.name ?? targetModelId;
				pushLog("info", t("row.poolLogTestStart", {
					count: members.length,
					model: targetLabel
				}));
				const controller = new AbortController();
				const timer = setTimeout(() => {
					controller.abort();
				}, POOL_TEST_TIMEOUT_MS);
				try {
					const response = await fetch(withTraePoolAction(panel, "test"), {
						method: "POST",
						signal: controller.signal
					});
					const seen = /* @__PURE__ */ new Set();
					let sawAny = false;
					for await (const line of testLinesOf(response)) if (applyTestLine(line, t, (r) => {
						const fresh = !seen.has(r.accountId);
						setRows((prev) => ({
							...prev,
							[r.accountId]: r
						}));
						if (!fresh) return;
						seen.add(r.accountId);
						if (mountRef.current) setTesting({ done: seen.size });
						pushLog(outcomeTone(r.outcome), t("row.poolLogTestRow", {
							accountName: r.accountName,
							outcome: outcomeLabel(r.outcome, t)
						}));
					}, (errorText) => {
						pushLog("error", t("row.poolLogBatchFailed", { message: errorText }));
					})) sawAny = true;
					if (!sawAny) throw new Error(t("row.poolLogGeneric"));
					pushLog("ok", t("row.poolLogTestDone"));
					onRefresh?.();
					setNow(Date.now());
				} catch (error) {
					pushLog("error", t(controller.signal.aborted ? "row.poolLogTimeout" : "row.poolLogBatchFailed", { message: error instanceof Error ? error.message : String(error) }));
				} finally {
					clearTimeout(timer);
					if (mountRef.current) {
						setBusy(void 0);
						setTesting(void 0);
					}
				}
			};
			const runSingleTest = async (account) => {
				if (busy !== void 0) return;
				setBusy("test");
				setNow(Date.now());
				const targetLabel = targetModelId === "" ? t("row.poolTargetAutoOption") : models.find((m) => m.id === targetModelId)?.name ?? targetModelId;
				pushLog("info", t("row.poolLogRowTesting", { accountName: account.accountName }));
				const controller = new AbortController();
				const timer = setTimeout(() => {
					controller.abort();
				}, POOL_TEST_TIMEOUT_MS);
				try {
					const response = await fetch(withTraePoolAccount(panel, "test", account.accountId), {
						method: "POST",
						signal: controller.signal
					});
					let sawAny = false;
					const logged = /* @__PURE__ */ new Set();
					for await (const line of testLinesOf(response)) if (applyTestLine(line, t, (r) => {
						setRows((prev) => ({
							...prev,
							[r.accountId]: r
						}));
						if (logged.has(r.accountId)) return;
						logged.add(r.accountId);
						pushLog(outcomeTone(r.outcome), t("row.poolLogTestRow", {
							accountName: r.accountName,
							outcome: outcomeLabel(r.outcome, t),
							model: targetLabel
						}));
					}, (errorText) => {
						pushLog("error", t("row.poolLogBatchFailed", { message: errorText }));
					})) sawAny = true;
					if (!sawAny) throw new Error(t("row.poolLogGeneric"));
					onRefresh?.();
					setNow(Date.now());
				} catch (error) {
					pushLog("error", t(controller.signal.aborted ? "row.poolLogTimeout" : "row.poolLogBatchFailed", { message: error instanceof Error ? error.message : String(error) }));
				} finally {
					clearTimeout(timer);
					if (mountRef.current) setBusy(void 0);
				}
			};
			/**
			* Persist the removal of ONE account out of this panel's membership.
			*
			* The slot written is the SAVED slot with ONLY `memberAccountIds` replaced —
			* never the draft's switch or target model, because the card's own hint
			* promises only the in-row actions take effect immediately
			* (「开关与目标模型是偏好，改完要保存」), and never the DOCUMENT's effective
			* target model either: that falls back to the free model when the user left
			* the choice automatic, so writing it back would pin a model they never chose.
			* The membership written is the DRAFT minus the removed id, so a checkbox the
			* user already toggled on another row is not silently discarded by the
			* settings re-read this write triggers.
			*/
			const persistRemoval = async (accountId) => {
				const scope = settingsScope;
				if (scope === void 0) throw new Error(t("row.poolLogSaveFailed"));
				const base = regionPoolOf(scope.getSnapshot().value, panel);
				const next = {
					...base,
					memberAccountIds: [...selected].filter((id) => id !== accountId)
				};
				await writeSettingsField(scope, "regions", nextRegionPool(scope.getSnapshot().value, panel, next), (readBack) => {
					const readPool = regionPoolOf(readBack, panel);
					return !readPool.memberAccountIds?.includes(accountId) && sameIds(readPool.memberAccountIds, next.memberAccountIds) && (readPool.enabled ?? false) === (base.enabled ?? false) && (readPool.targetModelId ?? "") === (base.targetModelId ?? "") && (readPool.probeInputTokens ?? 0) === (base.probeInputTokens ?? 0);
				});
			};
			/** Product names for the desktop apps a delete touched or was blocked by. */
			const appLabels = (editions) => editions.map((edition) => t(`row.edition${edition === "cn" ? "Cn" : edition === "sg" ? "Sg" : edition === "solo" ? "Solo" : "SoloSg"}`)).join("、");
			/**
			* Delete an account from this machine: drop the plugin's own credential copy,
			* then erase the account's login from Trae's `storage.json`, then clear every
			* account-holder this card holds (pool probe, settings membership, draft
			* selection, the serving binding it may have held).
			*
			* The app half is what makes the row actually disappear. It has one failure
			* mode worth its own message: a RUNNING Trae flushes its in-memory state back
			* over the file, so the Host refuses and names the app, and the card says to
			* quit it instead of reporting a generic failure the user cannot act on.
			*/
			const deleteAccount = async (account) => {
				if (busy !== void 0 || deletingIds.has(account.accountId)) return;
				setBusy("delete");
				setDeletingIds((prev) => new Set(prev).add(account.accountId));
				setDeleteHint(void 0);
				try {
					const response = await fetch(withTraePoolAccount(panel, "delete", account.accountId), { method: "POST" });
					const body = await response.json();
					if (!response.ok) throw new Error(renderRouteError(t, response.status, body));
					const blocked = body?.blockedApps ?? [];
					if (blocked.length > 0 && body?.deleted !== true) {
						setDeleteHint({
							kind: "app-running",
							accountId: account.accountId,
							accountName: account.accountName,
							apps: blocked
						});
						pushLog("warn", t("row.poolRowDeleteAppRunning", {
							accountName: account.accountName,
							apps: appLabels(blocked)
						}));
						setNow(Date.now());
						return;
					}
					if (body?.deleted !== true) throw new Error(t("row.poolRowDeleteFailed"));
					const wasMember = (saved.memberAccountIds ?? []).includes(account.accountId);
					let saveFailed = false;
					if (wasMember) {
						if (!writable) {
							saveFailed = true;
							setSaveError(t("row.poolSaveFailed", { message: t("row.poolLogSaveFailed") }));
							pushLog("error", t("row.poolLogSaveFailed"));
						} else try {
							await persistRemoval(account.accountId);
						} catch (error) {
							saveFailed = true;
							const message = error instanceof Error ? error.message : String(error);
							setSaveError(t("row.poolSaveFailed", { message }));
							pushLog("error", t("row.poolLogSaveFailed"));
						}
					}
					setSelected((prev) => {
						const next = new Set(prev);
						next.delete(account.accountId);
						return next;
					});
					if (!saveFailed) {
						if (body.stillSignedIn === true) {
							const hadCopy = body.hadCopy !== false;
							setDeleteHint({
								kind: "still-signed-in",
								accountId: account.accountId,
								accountName: account.accountName,
								hadCopy
							});
							pushLog("warn", t(hadCopy ? "row.poolRowDeleteStillSigned" : "row.poolRowDeleteNoCopy", { accountName: account.accountName }));
						} else {
							const signedOut = body.signedOutApps ?? [];
							pushLog("ok", signedOut.length === 0 ? t("row.poolRowDeleted", { accountName: account.accountName }) : t("row.poolRowDeletedSignedOut", {
								accountName: account.accountName,
								apps: appLabels(signedOut)
							}));
						}
					}
					setNow(Date.now());
					if (!saveFailed) await onRefresh?.();
				} catch (error) {
					pushLog("error", t("row.poolRowDeleteError", {
						accountName: account.accountName,
						message: error instanceof Error ? error.message : String(error)
					}));
				} finally {
					if (mountRef.current) {
						setBusy(void 0);
						setDeletingIds((prev) => {
							const next = new Set(prev);
							next.delete(account.accountId);
							return next;
						});
					}
				}
			};
			const noCandidate = pool.noCandidate;
			const showNoCandidate = pool.enabled && noCandidate !== void 0;
			const serving = servingAccount(pool);
			/**
			* The batch buttons are disabled for reasons the user cannot see (they are not
			* under the pointer, so a `title` only helps after a hover). Name them here.
			*/
			const actionNotes = [];
			if (selected.size === 0) actionNotes.push(t("row.poolActionNoteNoMembers"));
			if (pool.targetModelSource === "none") actionNotes.push(t("row.poolActionNoteTestNone"));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dsm-trae-pool",
				"aria-label": t("row.poolTitle"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-pool-head",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: "dsm-trae-pool-title",
							children: t("row.poolTitle")
						}), pool.enabled !== true && onBind !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							className: "dsm-trae-select dsm-trae-pool-account-select",
							"aria-label": t("row.poolManualAccountLabel"),
							value: serving?.accountId ?? "",
							disabled: bindingBusy === true || !writable,
							onChange: (event) => {
								const next = event.target.value;
								if (next !== "") onBind(next);
							},
							children: [serving === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "",
								disabled: true,
								children: t("row.poolManualAccountNone")
							}) : null, pool.accounts.filter((account) => account.reachable !== false).map((account) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: account.accountId,
								children: account.accountName
							}, account.accountId))]
						}) : serving === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-pool-current",
							children: t("row.poolCurrentHeader", { account: serving.accountName })
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-pool-settings dsm-trae-pool-modebar",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-trae-pool-modebar-row",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										className: "dsm-trae-switch dsm-trae-switch-pill",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: enabled,
											disabled: busy !== void 0 || !writable,
											"aria-label": t("row.poolEnabled"),
											onChange: (e) => {
												setEnabled(e.target.checked);
											}
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
										className: "dsm-trae-pool-modebar-label",
										children: t("row.poolEnabled")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-pool-modebar-state",
										children: pool.enabled === true ? t("row.poolModeAuto") : t("row.poolModeManual")
									}),
									dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-pool-dirty",
										role: "status",
										children: t("row.poolDirty")
									}) : null
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: "dsm-trae-pool-note",
								children: [
									t("row.poolEnabledHint"),
									" ",
									t("row.poolFailoverHint")
								]
							}),
							panel === "cn" && pool.checkinSupported && typeof pool.autoCheckin === "boolean" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-trae-pool-auto-checkin",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsm-trae-pool-modebar-row",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
											className: "dsm-trae-switch dsm-trae-switch-pill",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: autoCheckin,
												disabled: busy !== void 0 || !writable,
												"aria-label": t("row.poolAutoCheckin"),
												onChange: (event) => {
													setAutoCheckin(event.target.checked);
												}
											})
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
											className: "dsm-trae-pool-modebar-label",
											children: t("row.poolAutoCheckin")
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsm-trae-pool-note",
										children: t("row.poolAutoCheckinHint")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsm-trae-pool-note",
										children: t("row.poolAutoCheckinDeviceHint")
									}),
									pool.autoCheckin === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsm-trae-pool-auto-checkin-status",
										role: "status",
										children: pool.autoCheckinState?.deviceBlocked === true ? t("row.poolAutoCheckinDeviceDone") : pool.autoCheckinState !== void 0 ? t(pool.autoCheckinState.failures > 0 ? "row.poolAutoCheckinRetry" : "row.poolAutoCheckinProgress", { count: pool.autoCheckinState.done }) : t("row.poolAutoCheckinWaiting")
									}) : null
								]
							}) : null
						]
					}),
					pool.enabled === true && serving !== void 0 && serving.member !== true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-trae-pool-note dsm-trae-pool-serving-note",
						role: "status",
						children: t("row.poolServingOutside", { account: serving.accountName })
					}) : null,
					saved.enabled === true && enabled === false ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-trae-pool-off-notice",
						role: "status",
						children: t("row.poolOffNotice")
					}) : null,
					showNoCandidate ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NoCandidateNotice, {
						noCandidate,
						t
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-pool-card",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-trae-pool-card-head",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									className: "dsm-trae-pool-card-title",
									children: t("row.poolMembersTitle")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-pool-card-tools",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsm-trae-pool-count",
											children: t("row.poolSelectedCount", {
												count: selected.size,
												total: pool.accounts.length + ghosts.length
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsm-btn dsm-btn-outline",
											disabled: busy !== void 0,
											onClick: selectAll,
											children: t("row.poolSelectAll")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsm-btn dsm-btn-outline",
											disabled: busy !== void 0,
											onClick: selectNone,
											children: t("row.poolSelectNone")
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-trae-pool-actions",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsm-btn dsm-btn-outline dsm-trae-pool-action-test",
										disabled: busy !== void 0 || selected.size === 0 || pool.targetModelSource === "none",
										title: pool.targetModelSource === "none" ? t("row.poolTargetNoneHint") : void 0,
										onClick: () => {
											runTest();
										},
										children: busy === "test" ? t("row.poolTesting") : t("row.poolTestAll")
									}),
									busy === "test" || testing !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-pool-busy",
										role: "status",
										children: t("row.poolBusyHint")
									}) : null,
									topActions === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-pool-actions-end",
										children: topActions
									})
								]
							}),
							actionNotes.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-trae-pool-action-note",
								children: actionNotes.join(" · ")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: pool.checkinSupported ? "dsm-trae-pool-table" : "dsm-trae-pool-table dsm-trae-pool-table-no-checkin",
								role: "table",
								"aria-label": t("row.poolMembersTitle"),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MemberRowHeader, {
										t,
										checkinSupported: pool.checkinSupported
									}),
									pool.accounts.map((account) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MemberRow, {
										account,
										showCheckin: pool.checkinSupported,
										deviceClaimed,
										models,
										rows,
										checked: selected.has(account.accountId),
										poolEnabled: pool.enabled === true,
										poolModelId: pool.targetModelId ?? "",
										detail: details?.[account.accountId],
										claim: claims?.[account.accountId],
										onClaim,
										onToggle: () => {
											toggleMember(account.accountId);
										},
										onTest: () => {
											runSingleTest(account);
										},
										t,
										disabled: busy !== void 0 || !writable,
										deleting: deletingIds.has(account.accountId),
										onDelete: () => {
											deleteAccount(account);
										},
										canDelete: pool.deleteSupported === true,
										formatNumber: formatNumber$1,
										relativeAt
									}, account.accountId)),
									ghosts.map((ghost) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MemberGhostRow, {
										ghost,
										showCheckin: pool.checkinSupported,
										checked: selected.has(ghost.accountId),
										onToggle: () => {
											toggleMember(ghost.accountId);
										},
										t,
										disabled: busy !== void 0 || !writable,
										deleting: deletingIds.has(ghost.accountId),
										onDelete: () => {
											deleteAccount(ghost);
										},
										canDelete: pool.deleteSupported === true
									}, `ghost:${ghost.accountId}`))
								]
							}),
							ghosts.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-trae-pool-ghost-note",
								role: "status",
								children: t("row.poolGhostMembers", {
									count: ghosts.length,
									names: ghosts.map((g) => g.accountName).join("、")
								})
							}) : null,
							deleteHint?.kind === "still-signed-in" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-trae-pool-delete-hint",
								role: "status",
								children: t(deleteHint.hadCopy ? "row.poolDeleteStillSigned" : "row.poolDeleteNoCopy", { accountName: deleteHint.accountName })
							}) : null,
							deleteHint?.kind === "app-running" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-trae-pool-delete-hint dsm-trae-pool-delete-hint-action",
								role: "status",
								children: t("row.poolDeleteAppRunning", {
									accountName: deleteHint.accountName,
									apps: appLabels(deleteHint.apps)
								})
							}) : null,
							dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-trae-pool-unsaved",
								role: "status",
								children: t("row.poolUnsavedMembers")
							}) : null
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-pool-settings-wrap",
						children: [
							tools === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsm-trae-pool-tools dsm-trae-pool-tools-dashed",
								children: tools
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsm-trae-pool-head",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									className: "dsm-trae-pool-title",
									children: t("row.poolSettingsTitle")
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
								className: "dsm-trae-pool-more",
								open: moreRulesOpen,
								onToggle: (event) => setMoreRulesOpen(event.currentTarget.open),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", {
									className: "dsm-trae-pool-more-summary",
									children: t("row.poolMoreRulesTitle")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-pool-more-body",
									children: [
										pool.copies === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dsm-trae-pool-note",
											role: "note",
											children: t("row.poolCopyFile", {
												path: pool.copies.path,
												count: pool.copies.count
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dsm-trae-pool-note",
											children: t("row.poolSettingsNote")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dsm-trae-pool-note",
											children: t("row.poolDeleteHint")
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-trae-pool-settings",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsm-trae-pool-set",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dsm-trae-pool-set-copy",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: t("row.poolTargetLabel") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.poolTargetHint") })]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsm-trae-pool-set-ctl",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
												className: "dsm-trae-select",
												"aria-label": t("row.poolTargetLabel"),
												value: targetModelId,
												disabled: busy !== void 0 || !writable,
												onChange: (e) => {
													setTargetModelId(e.target.value);
												},
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: "",
														children: t("row.poolTargetAutoOption")
													}),
													models.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: model.id,
														children: model.name
													}, model.id)),
													pool.targetModelSource === "stale" && pool.staleTargetModelId !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: pool.staleTargetModelId,
														children: t("row.poolTargetStaleOption", { model: pool.staleTargetModelId })
													}) : null
												]
											})
										})]
									}),
									pool.targetModelSource === "stale" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsm-trae-pool-target-stale",
										role: "status",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.poolTargetStale", { model: pool.staleTargetModelId ?? "" }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsm-btn dsm-btn-outline",
											disabled: busy !== void 0,
											onClick: () => {
												setTargetModelId("");
												pushLog("info", t("row.poolLogTargetCleared"));
											},
											children: t("row.poolTargetStaleClear")
										})]
									}) : null,
									pool.targetModelSource === "none" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
										className: "dsm-trae-pool-target-none",
										role: "status",
										children: [
											t("row.poolTargetNone"),
											" — ",
											t("row.poolTargetNoneHint")
										]
									}) : null,
									probeSupported ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsm-trae-pool-set",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dsm-trae-pool-set-copy",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: t("row.poolProbeSizeLabel") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.poolProbeSizeHint") })]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsm-trae-pool-set-ctl",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
												className: "dsm-trae-select",
												"aria-label": t("row.poolProbeSizeLabel"),
												value: String(probeInputTokens),
												disabled: busy !== void 0 || !writable,
												onChange: (e) => {
													setProbeInputTokens(Number(e.target.value));
												},
												children: PROBE_INPUT_TOKEN_CHOICES.map((choice) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: String(choice),
													children: choice === 0 ? t("row.poolProbeSizeDefault") : t("row.poolProbeSizeOption", { wan: choice / 1e4 })
												}, choice))
											})
										})]
									}) : null,
									saveError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsm-trae-pool-save-error",
										role: "alert",
										children: saveError
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-trae-pool-save-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
									className: "dsm-trae-usage-cheer",
									href: "https://github.com/dingminhua/dsh-connect-trae",
									target: "_blank",
									rel: "noreferrer noopener",
									children: [t("row.cheer"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-usage-cheer-star",
										"aria-hidden": "true",
										children: "★"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-pool-save-buttons",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsm-btn dsm-btn-outline",
										disabled: !dirty || busy !== void 0,
										onClick: discard,
										children: t("row.poolDiscard")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsm-btn dsm-btn-primary",
										disabled: !dirty || busy !== void 0,
										onClick: () => {
											save();
										},
										children: busy === "save" ? t("row.poolSaving") : t("row.poolSaved")
									})]
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActivityLog, {
						log,
						t,
						now,
						relativeAt,
						onClear: () => setLog([])
					})
				]
			});
		}
		function NoCandidateNotice({ noCandidate, t }) {
			if (noCandidate === "empty") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-trae-pool-warning dsm-trae-pool-warning-empty",
				role: "status",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsm-trae-pool-warning-title",
					children: t("row.poolNoCandidateEmpty")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsm-trae-pool-warning-hint",
					children: t("row.poolNoCandidateEmptyHint")
				})]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-trae-pool-warning dsm-trae-pool-warning-unusable",
				role: "status",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsm-trae-pool-warning-title",
					children: t("row.poolNoCandidateUnusable")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "dsm-trae-pool-warning-hint",
					children: [
						t("row.poolNoCandidateHint"),
						" ",
						exclusionLabel(noCandidate, t)
					]
				})]
			});
		}
		function MemberRowHeader({ t, checkinSupported }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-trae-pool-row dsm-trae-pool-row-head",
				role: "row",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsm-trae-pool-col-account",
						children: t("row.poolColumnAccount")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.poolColumnCredits") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.poolColumnProbe") }),
					checkinSupported ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.poolColumnCheckin") }) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {})
				]
			});
		}
		function MemberRow({ account, models, rows, checked, onToggle, onTest, t, disabled, deleting, onDelete, canDelete, formatNumber, relativeAt, detail, claim, onClaim, showCheckin, deviceClaimed, poolEnabled, poolModelId }) {
			/**
			* Whether this row is the one billing the next request — and, with the pool on,
			* whether that claim is the pool's own.
			*
			* `account.current` alone is not enough: with an empty (or fully excluded) pool
			* the Host deliberately falls back to the saved selection, so a removed account
			* stays `current` and the pill would keep announcing it as the pool's pick.
			* A row can only be the rotation's answer while it is a member.
			*/
			const isCurrent = account.current === true && (poolEnabled !== true || account.member === true);
			const hasCopy = account.reachable;
			const credit = account.generalAvailable;
			const excluded = account.excludedBy;
			const checkin = account.checkedInToday;
			const device = account.deviceCheckedIn;
			const testRow = rows[account.accountId];
			/**
			* Whether the probe column already explains WHY this row is excluded.
			*
			* The exclusion tag and the probe cell are derived from the same verdict, so a
			* row that shows both says 「登录凭据被拒」 twice, six centimetres apart. Keep
			* the tag only for the case the cell cannot cover: no probe to show at all
			* (e.g. a stored member whose last test predates this session).
			*/
			const probeOnScreen = testRow !== void 0 || account.probe !== void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `dsm-trae-pool-row${isCurrent ? " dsm-trae-pool-row-current" : ""}`,
				role: "row",
				"data-account-id": account.accountId,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-pool-account",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								className: "dsm-trae-pool-check",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked,
									disabled,
									onChange: onToggle,
									"aria-label": t("row.poolSelectAria", { accountName: account.accountName })
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-trae-pool-account-name",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: `dsm-trae-pool-dot dsm-trae-pool-dot-${account.reachable === false ? "ghost" : excluded ? "excluded" : "ok"}`,
										"aria-hidden": "true"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: account.accountName !== "" ? account.accountName : account.accountId }),
									detail?.meta === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-pool-meta",
										children: detail.meta
									}),
									detail?.warn === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: `dsm-trae-pool-warn-tag dsm-trae-pool-warn-tag-${detail.warnTone ?? "soon"}`,
										role: "status",
										children: detail.warn
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-trae-pool-account-tags",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: checked ? "dsm-trae-pool-member" : "dsm-trae-pool-not-member",
										children: checked ? t("row.poolMember") : t("row.poolNotMember")
									}),
									account.reachable === false ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-pool-tag dsm-trae-pool-tag-ghost",
										role: "status",
										children: t("row.poolNoCopyTag")
									}) : null,
									excluded && !probeOnScreen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-pool-tag dsm-trae-pool-tag-excluded",
										children: exclusionLabel(excluded, t)
									}) : null,
									account.tokenExpired === true && excluded !== "credential-rejected" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-pool-warn-tag dsm-trae-pool-warn-tag-lapsed",
										children: t("row.poolTokenExpired")
									}) : null
								]
							}),
							account.probe?.atMs === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-trae-pool-account-note",
								children: t("row.poolProbeAt", { when: shortWhen(account.probe.atMs) })
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-pool-credit",
						title: t("row.poolWorkHint"),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-pool-credit-num",
							children: credit === void 0 ? t("row.poolCreditNone") : formatNumber(credit)
						}), credit === void 0 || account.nearestExpiryMs === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-pool-credit-meta",
							children: t("row.poolCreditExpiry", { when: shortDate(account.nearestExpiryMs) })
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-trae-pool-probe",
						children: testRow !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProbeResult, {
							outcome: testRow.outcome,
							modelId: testRow.modelId,
							atMs: void 0,
							source: void 0,
							t,
							relativeAt,
							now: Date.now(),
							detail: testRow.detail,
							poolModelId
						}) : account.probe !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProbeResult, {
							outcome: account.probe.outcome,
							modelId: account.probe.modelId,
							atMs: account.probe.atMs,
							source: account.probe.source,
							t,
							relativeAt,
							now: Date.now(),
							detail: account.probe.message,
							poolModelId
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-pool-probe-none",
							children: t("row.poolNeverTested")
						})
					}),
					showCheckin ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-pool-checkin",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `dsm-trae-pool-checkin-state dsm-trae-pool-checkin-${checkin === void 0 ? "unknown" : checkin ? "ok" : device === true || deviceClaimed ? "device" : "no"}`,
							children: checkin === void 0 ? t("row.poolCheckinUnknown") : checkin ? t("row.poolCheckedIn") : device === true || deviceClaimed ? t("row.poolDeviceUsed") : t("row.poolNotCheckedIn")
						}), claim === void 0 || onClaim === void 0 || claim.claimable === false ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline dsm-trae-pool-claim",
							disabled: claim.disabled || disabled,
							title: claim.title,
							onClick: () => {
								onClaim(account.accountId);
							},
							children: claim.label
						})]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-pool-row-actions",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline",
							disabled: disabled || hasCopy === false,
							title: hasCopy === false ? t("row.poolNoCopyTestHint") : void 0,
							onClick: onTest,
							children: t("row.poolRowTest")
						}), canDelete ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline-danger dsm-trae-pool-delete",
							disabled: disabled || deleting,
							"aria-label": t("row.poolRowDeleteAria", { accountName: account.accountName }),
							onClick: onDelete,
							children: deleting ? t("row.poolRowDeleting") : t("row.poolRowDelete")
						}) : null]
					})
				]
			});
		}
		function MemberGhostRow({ ghost, checked, onToggle, t, disabled, deleting, onDelete, canDelete, showCheckin }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-trae-pool-row dsm-trae-pool-row-ghost",
				role: "row",
				"data-account-id": ghost.accountId,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-pool-account",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								className: "dsm-trae-pool-check",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked,
									disabled,
									onChange: onToggle,
									"aria-label": t("row.poolSelectAria", { accountName: ghost.accountName })
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-trae-pool-account-name",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-trae-pool-dot dsm-trae-pool-dot-ghost",
									"aria-hidden": "true"
								}), ghost.accountName]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-trae-pool-account-tags",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: checked ? "dsm-trae-pool-member" : "dsm-trae-pool-not-member",
									children: checked ? t("row.poolMember") : t("row.poolNotMember")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-trae-pool-tag dsm-trae-pool-tag-ghost",
									children: t("row.poolExcludedUnusable")
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-trae-pool-credit",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-pool-credit-num",
							children: t("row.poolCreditNone")
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-trae-pool-probe",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-pool-probe-none",
							children: t("row.poolNeverTested")
						})
					}),
					showCheckin ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-trae-pool-checkin",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-pool-checkin-state dsm-trae-pool-checkin-unknown",
							children: t("row.poolCheckinUnknown")
						})
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-trae-pool-row-actions",
						children: canDelete ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline-danger dsm-trae-pool-delete",
							disabled: disabled || deleting,
							"aria-label": t("row.poolGhostDeleteAria", { accountName: ghost.accountName }),
							onClick: onDelete,
							children: deleting ? t("row.poolRowDeleting") : t("row.poolRowDelete")
						}) : null
					})
				]
			});
		}
		function ProbeResult({ outcome, modelId, atMs, source, detail, poolModelId, t, relativeAt, now }) {
			const tone = outcome === "ok" ? "ok" : "warn";
			const modelDiffers = modelId !== void 0 && modelId !== poolModelId;
			const sourceLabel = source === void 0 ? "" : probeSourceLabel(source, t);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-trae-pool-probe-cell",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: `dsm-trae-pool-probe-outcome dsm-trae-pool-probe-${tone}`,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-pool-dot dsm-trae-pool-dot-ok",
							"aria-hidden": "true"
						}), outcomeLabel(outcome, t)]
					}),
					atMs === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsm-trae-pool-probe-meta",
						children: t("row.poolProbeMeasured", { when: relativeAt(atMs, now, t) })
					}),
					modelDiffers ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dsm-trae-pool-probe-meta",
						children: [t("row.poolProbeModel", { model: modelId }), sourceLabel === "" ? "" : ` · ${sourceLabel}`]
					}) : sourceLabel === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsm-trae-pool-probe-meta",
						children: sourceLabel
					}),
					detail !== void 0 && detail !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsm-trae-pool-probe-detail",
						children: detail
					}) : null
				]
			});
		}
		function ActivityLog({ log, t, now, relativeAt, onClear }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-trae-pool-log",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsm-trae-pool-log-head",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
						className: "dsm-trae-pool-subtitle",
						children: t("row.poolLogTitle")
					}), log.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dsm-btn dsm-btn-outline",
						onClick: onClear,
						children: t("row.poolLogClear")
					}) : null]
				}), log.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dsm-trae-pool-log-empty",
					children: t("row.poolLogEmpty")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
					className: "dsm-trae-pool-log-list",
					children: log.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
						className: `dsm-trae-pool-log-item dsm-trae-pool-log-${entry.tone}`,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-pool-log-text",
							children: entry.text
						})
					}, entry.id))
				})]
			});
		}
		//#endregion
		//#region src/client/AccountTransfer.tsx
		/**
		* The card's account-transfer section: batch export and import of a region's
		* stored credentials, in the file format shared with sibling credential
		* managers for the same upstream (the `dsh-connect-workbuddy` family).
		*
		* Modelled on that plugin's `AccountTransfer`, deliberately: the two plugins
		* share one external-presentation language, and a user who has imported
		* accounts in one should recognise the flow in the other. The shape is a single
		* section owning all of its state (busy / result line / error), with the export
		* dialog (pick accounts → download JSON) and the import dialog (pick file →
		* desensitised preview → tick → import) split the same way.
		*
		* Two properties are load-bearing and must not be relaxed:
		*  - The preview carries display fields and a `hasToken` boolean only. Tokens
		*    never enter the browser at all until the user explicitly exports a chosen
		*    account, and the Host re-parses the file on import rather than trusting
		*    anything this component says about it.
		*  - Import is offered even when the region has NO account: a machine that has
		*    never signed in is exactly where importing someone else's export matters
		*    most. Only EXPORT needs an existing account to select.
		*
		* The download uses `<a download>` on a Blob because the card runs inside the
		* settings iframe and has no host save dialog; a same-origin anchor download is
		* the reliable path there.
		*
		* @module dsh-connect-trae/client/AccountTransfer
		*/
		/** How long the veil may wait for the card's re-read before it comes down. */
		const REFRESH_SETTLE_TIMEOUT_MS = 5e3;
		/** Build the default export file name: trae-accounts-YYYY-MM-DD.json. */
		function exportFileName() {
			const pad = (value) => String(value).padStart(2, "0");
			const now = /* @__PURE__ */ new Date();
			return `trae-accounts-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
		}
		/** Download a JSON value as a local file (no host save dialog inside the iframe). */
		function downloadJson(fileName, data) {
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = fileName;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
		}
		/** Resolve once `value` settles, or after `timeoutMs` — whichever comes first. */
		async function settlesWithin(value, timeoutMs) {
			await Promise.race([Promise.resolve(value).catch(() => void 0), new Promise((resolve) => {
				setTimeout(resolve, timeoutMs);
			})]);
		}
		function AccountTransfer({ t, region, accounts, onChanged, hideLabel = false }) {
			const [phase, setPhase] = (0, react.useState)({ kind: "idle" });
			const [dialog, setDialog] = (0, react.useState)(void 0);
			const [selected, setSelected] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [preview, setPreview] = (0, react.useState)(void 0);
			const [importSelected, setImportSelected] = (0, react.useState)(/* @__PURE__ */ new Set());
			const fileInput = (0, react.useRef)(null);
			/**
			* The text of the file the user just picked, held here rather than re-read
			* from the input at import time: the picker is a bare system dialog that
			* closes immediately, so between preview and confirm no dialog holds the
			* File. Re-reading `fileInput.current.files` would also break the moment
			* anything clears the input — and it must be cleared after every pick, or
			* choosing the SAME file twice fires no change event.
			*/
			const importText = (0, react.useRef)("");
			const mounted = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			const closeDialog = () => {
				setDialog(void 0);
				setSelected(/* @__PURE__ */ new Set());
				setPreview(void 0);
				setImportSelected(/* @__PURE__ */ new Set());
			};
			const runExport = async () => {
				if (selected.size === 0) return;
				setPhase({ kind: "exporting" });
				try {
					const response = await fetch(withTraeTransferAction(TRAE_TRANSFER_PATH, region, "export"), {
						method: "POST",
						headers: {
							"content-type": "application/json",
							accept: "application/json"
						},
						credentials: "same-origin",
						body: JSON.stringify({ accountIds: [...selected] })
					});
					const body = await response.json();
					if (!mounted.current) return;
					if (!response.ok || !Array.isArray(body.accounts)) {
						setPhase({
							kind: "error",
							message: body.error ?? `HTTP ${response.status}`
						});
						return;
					}
					const fileName = exportFileName();
					downloadJson(fileName, body.accounts);
					closeDialog();
					setPhase({
						kind: "done",
						message: t("row.transferExported", {
							count: body.accounts.length,
							fileName
						})
					});
				} catch (error) {
					if (mounted.current) setPhase({
						kind: "error",
						message: error instanceof Error ? error.message : String(error)
					});
				}
			};
			const readImportFile = async (file) => {
				setPhase({ kind: "importing" });
				try {
					const text = await file.text();
					importText.current = text;
					const response = await fetch(withTraeTransferAction(TRAE_TRANSFER_PATH, region, "preview"), {
						method: "POST",
						headers: {
							"content-type": "application/json",
							accept: "application/json"
						},
						credentials: "same-origin",
						body: JSON.stringify({ text })
					});
					const body = await response.json();
					if (!mounted.current) return;
					if (!response.ok || !Array.isArray(body.accounts)) {
						setPhase({
							kind: "error",
							message: body.error ?? `HTTP ${response.status}`
						});
						return;
					}
					setPreview(body);
					setImportSelected(new Set(body.accounts.filter((entry) => entry.hasToken).map((entry) => entry.index)));
					setPhase({ kind: "idle" });
				} catch (error) {
					if (mounted.current) setPhase({
						kind: "error",
						message: error instanceof Error ? error.message : String(error)
					});
				}
			};
			const runImport = async () => {
				if (preview === void 0 || importSelected.size === 0 || importText.current === "") return;
				setPhase({ kind: "importing" });
				try {
					const response = await fetch(withTraeTransferAction(TRAE_TRANSFER_PATH, region, "import"), {
						method: "POST",
						headers: {
							"content-type": "application/json",
							accept: "application/json"
						},
						credentials: "same-origin",
						body: JSON.stringify({
							text: importText.current,
							indexes: [...importSelected]
						})
					});
					const body = await response.json();
					if (!mounted.current) return;
					if (!response.ok || typeof body.imported !== "number") {
						setPhase({
							kind: "error",
							message: body.error ?? `HTTP ${response.status}`
						});
						return;
					}
					closeDialog();
					const message = t("row.transferImported", {
						imported: body.imported,
						skipped: body.skipped ?? 0
					});
					setPhase({
						kind: "refreshing",
						message
					});
					await settlesWithin(onChanged?.(), REFRESH_SETTLE_TIMEOUT_MS);
					if (!mounted.current) return;
					setPhase({
						kind: "done",
						message
					});
				} catch (error) {
					if (mounted.current) setPhase({
						kind: "error",
						message: error instanceof Error ? error.message : String(error)
					});
				}
			};
			const busy = phase.kind === "exporting" || phase.kind === "importing" || phase.kind === "refreshing";
			const veilMessage = phase.kind === "exporting" ? t("row.transferExporting") : phase.kind === "importing" || phase.kind === "refreshing" ? t("row.transferImporting") : "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: hideLabel ? "dsm-trae-transfer dsm-trae-transfer-flat" : "dsm-trae-transfer",
				"aria-label": t("row.transferTitle"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BusyOverlay, {
						visible: busy,
						message: veilMessage,
						...busy ? { hint: t("row.transferVeilHint") } : {}
					}),
					hideLabel ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-trae-transfer-label",
						children: t("row.transferTitle")
					}),
					phase.kind === "done" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-trae-transfer-status dsm-trae-transfer-ok",
						children: phase.message
					}) : phase.kind === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-trae-transfer-status dsm-trae-transfer-error",
						children: t("row.transferError", { message: phase.message })
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-transfer-actions",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline",
							disabled: busy || accounts.length === 0,
							onClick: () => {
								setSelected(/* @__PURE__ */ new Set());
								setDialog("export");
							},
							children: t("row.transferExport")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline",
							disabled: busy,
							onClick: () => {
								fileInput.current?.click();
							},
							children: t("row.transferImport")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						ref: fileInput,
						type: "file",
						accept: "application/json,.json",
						className: "dsm-trae-transfer-file",
						onChange: (event) => {
							const file = event.target.files?.[0];
							event.target.value = "";
							if (file !== void 0) {
								setPreview(void 0);
								setImportSelected(/* @__PURE__ */ new Set());
								setDialog("import");
								readImportFile(file);
							}
						}
					}),
					dialog === "export" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-transfer-dialog",
						role: "dialog",
						"aria-label": t("row.transferExport"),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.transferExportPick", { total: accounts.length }) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-trae-hint",
								children: t("row.transferHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: "dsm-trae-transfer-list",
								children: accounts.map((account) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: selected.has(account.id),
									onChange: (event) => {
										const next = new Set(selected);
										if (event.target.checked) next.add(account.id);
										else next.delete(account.id);
										setSelected(next);
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: account.accountName })] }) }, account.id))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-trae-transfer-dialog-actions",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn",
									disabled: selected.size === 0,
									onClick: () => {
										runExport();
									},
									children: t("row.transferExportConfirm", { count: selected.size })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn dsm-btn-outline",
									onClick: closeDialog,
									children: t("row.transferCancel")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsm-trae-transfer-link",
								onClick: () => setSelected(new Set(accounts.map((account) => account.id))),
								children: t("row.transferSelectAll")
							})
						]
					}) : null,
					dialog === "import" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-trae-transfer-dialog",
						role: "dialog",
						"aria-label": t("row.transferImport"),
						children: preview === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.transferReading") }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.transferImportPick", { total: preview.total }) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: "dsm-trae-transfer-list",
								children: preview.accounts.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: importSelected.has(entry.index),
									disabled: !entry.hasToken,
									onChange: (event) => {
										const next = new Set(importSelected);
										if (event.target.checked) next.add(entry.index);
										else next.delete(entry.index);
										setImportSelected(next);
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
									entry.nickname || entry.uid || t("row.transferUnnamed"),
									entry.email === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dsm-trae-hint",
										children: [" · ", entry.email]
									}),
									entry.hasToken ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dsm-trae-hint",
										children: [" · ", t("row.transferNoToken")]
									})
								] })] }) }, entry.index))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-trae-transfer-dialog-actions",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn",
									disabled: importSelected.size === 0,
									onClick: () => {
										runImport();
									},
									children: t("row.transferImportConfirm", { count: importSelected.size })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn dsm-btn-outline",
									onClick: closeDialog,
									children: t("row.transferCancel")
								})]
							})
						] })
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/display.ts
		/** A group-separated integer, in the reader's own locale. */
		function formatNumber(value) {
			return new Intl.NumberFormat(void 0, {
				minimumFractionDigits: 0,
				maximumFractionDigits: 0
			}).format(value);
		}
		/** A date and time, in the reader's own locale. */
		function formatDateTime(value) {
			return new Intl.DateTimeFormat(void 0, {
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit"
			}).format(new Date(value));
		}
		/**
		* The colour of a status dot, as an inline style.
		*
		* Inline rather than a class because the colour IS the value (signed-in / error
		* / signed-out); a class per state would be three names that say the same thing.
		*/
		function dotStyle(status) {
			return { background: status === "signed-in" ? "var(--dsw-alias-state-success-primary, #22a06b)" : status === "error" ? "var(--dsw-alias-state-error-primary, #d92d20)" : "var(--dsw-alias-label-dimmed, #9aa0a6)" };
		}
		/** How close a refresh token must be to lapsing before the card warns, in days. */
		const REFRESH_WARN_DAYS = 30;
		/**
		* The refresh-token warning for one account, or undefined when there is nothing
		* worth saying.
		*
		* The access token renews itself every few minutes, so its own expiry answers
		* "when does this need attention" with "never, until the refresh token lapses".
		* The refresh token is therefore the only honest countdown on this card, and it
		* has to be shown BEFORE it runs out: once it lapses the plugin cannot renew at
		* all and the only recovery is signing in to Trae again, which a user who has
		* been reading "auto-renewal" for months has no reason to expect.
		*
		* Three tones, matching the credit-expiry notice: `lapsed` (renewal already
		* dead), `soon` (inside the warning window), and nothing otherwise — a healthy
		* token must not add a line to every account row forever.
		*/
		function refreshTokenWarning(expiresAtMs, nowMs, t, formatTime) {
			if (expiresAtMs === void 0) return void 0;
			const text = formatTime(expiresAtMs);
			if (expiresAtMs <= nowMs) return {
				tone: "lapsed",
				text: t("row.refreshTokenLapsed", { expiresAt: text })
			};
			const days = Math.ceil((expiresAtMs - nowMs) / 864e5);
			if (days > REFRESH_WARN_DAYS) return void 0;
			return {
				tone: "soon",
				text: t("row.refreshTokenExpiring", {
					expiresAt: text,
					days
				})
			};
		}
		//#endregion
		//#region src/client/expiry-ladder.ts
		/**
		* Choose the notice's tier and its figures.
		*
		* Escalation order matters: a live expiry the user can still act on outranks
		* a lapsed one they cannot, even when the lapsed amount is larger.
		*
		* The 3-day tier exists because the 7-day bucket covers it. Without it, credit
		* expiring in two days was reported as "within 7 days" — true, but three times
		* too coarse to plan around, in the one sentence whose job is "how long do I
		* have left".
		*/
		function expiryNotice(expiry) {
			if (expiry.within24h.packs > 0) return {
				tier: "soon",
				total: expiry.within24h.total,
				packs: expiry.within24h.packs,
				...expiry.within24h.earliestExpiresAtMs === void 0 ? {} : { soonestExpiresAtMs: expiry.within24h.earliestExpiresAtMs }
			};
			if (expiry.within3d.packs > 0) return {
				tier: "days",
				total: expiry.within3d.total,
				packs: expiry.within3d.packs,
				...expiry.within3d.earliestExpiresAtMs === void 0 ? {} : { soonestExpiresAtMs: expiry.within3d.earliestExpiresAtMs }
			};
			if (expiry.within7d.packs > 0) return {
				tier: "week",
				total: expiry.within7d.total,
				packs: expiry.within7d.packs,
				...expiry.within7d.earliestExpiresAtMs === void 0 ? {} : { soonestExpiresAtMs: expiry.within7d.earliestExpiresAtMs }
			};
			if (expiry.expired.packs > 0) return {
				tier: "lapsed",
				total: expiry.expired.total,
				packs: expiry.expired.packs
			};
		}
		/**
		* The locale key that states this tier's headline.
		*
		* Kept beside the tier choice so a new tier cannot be added without its copy.
		*/
		function expiryHeadlineKey(tier) {
			switch (tier) {
				case "soon": return "row.expiryWarningSoon";
				case "days": return "row.expiryWarningDays";
				case "week": return "row.expiryWarningWeek";
				case "lapsed": return "row.expiryWarningLapsed";
			}
		}
		/**
		* The CSS class that gives this tier its urgency tone.
		*
		* Four tones so the 24-hour case cannot be mistaken for the 3-day one, nor
		* either for the 7-day one, at a glance. The 3-day tone sits BETWEEN the other
		* two: it carries the warning border (a 3-day expiry must not be scrolled past
		* unnoticed) but not the warning fill (a 3-day pack is not the emergency a
		* 24-hour pack is).
		*/
		function expiryToneClass(tier) {
			switch (tier) {
				case "soon": return "dsm-trae-expiry-soon";
				case "days": return "dsm-trae-expiry-days";
				case "week": return "dsm-trae-expiry-week";
				case "lapsed": return "dsm-trae-expiry-lapsed";
			}
		}
		//#endregion
		//#region src/client/TraeAccountPanel.tsx
		/**
		* A warning that credit is about to lapse.
		*
		* The balance alone cannot express this: a pack lapsing in an hour and one
		* lapsing next month both render as "150", so a user watching only the total
		* loses the first one silently. The notice names the amount, the pack count and
		* the soonest expiry, and escalates 7d → 24h → already-lapsed.
		*
		* Renders nothing when the upstream reported no end times at all — absence of
		* expiry data is not evidence that nothing lapses, so the component stays silent
		* rather than reassuring.
		*/
		function ExpiryNotice({ expiry, t }) {
			const notice = expiryNotice(expiry);
			if (notice === void 0) return null;
			const message = t(expiryHeadlineKey(notice.tier), {
				total: formatNumber(notice.total),
				packs: String(notice.packs)
			});
			const tone = expiryToneClass(notice.tier);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `dsm-trae-expiry ${tone}`,
				role: "status",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: message }), notice.soonestExpiresAtMs === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsm-trae-expiry-detail",
					children: t("row.expiryEarliest", { time: formatDateTime(notice.soonestExpiresAtMs) })
				})]
			});
		}
		/** The CN check-in cell for one row: an outcome once there is nothing left to do. */
		function ClaimCell({ claim, onClaim, t }) {
			if (!claim.claimable) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dsm-trae-account-checkin-state",
				children: claim.settled === "claimed" ? t("row.poolCheckedIn") : t("row.poolDeviceUsed")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "dsm-trae-account-checkin",
				disabled: claim.disabled,
				title: claim.title,
				onClick: onClaim,
				children: claim.label
			});
		}
		/**
		* The account section: preferences, the roster, the pool, and every notice about
		* the credential.
		*
		* Everything here commits ON THE CLICK (the preference boxes write themselves,
		* the check-in claims immediately, the pool saves through its own footer). That
		* is precisely why this section has no 「保存」 of its own — the model catalog,
		* which does, lives in its own section.
		*/
		function TraeAccountPanel({ t, settingsScope, panel, status, statusLabel, credentialRegionIsAi, regionOn, showPointsInMainUi, onToggleShowPoints, creditPosition, onCreditPositionChange, refreshIntervalMinutes, onRefreshIntervalChange, sidebarPanelOn, sidebarPanelBusy, onToggleSidebarPanel, savingPreferences, creditsLabelId, creditsHintId, rows, busy, rescanNote, onRescan, switchingAccount, onSwitchAccount, onClaim, onTransferChanged, poolDetails, poolClaims, models = [], deviceClaimed = false, onPoolChanged = () => {}, onPoolRefresh = () => {}, creditsUnavailable, creditsExpiry, alternatives, onSwitchToAlternative, section = "all" }) {
			const writable = settingsScope?.getSnapshot().writable === true;
			const signedIn = status.status === "signed-in";
			const accounts = signedIn ? status.accounts : [];
			const pool = signedIn ? status.pool : void 0;
			if (section === "prefs") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-trae-prefs",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "dsm-trae-pref",
						title: t(credentialRegionIsAi ? "row.showPointsInMainUiHintAi" : "row.showPointsInMainUiHint"),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							className: "dsm-trae-pref-check",
							checked: showPointsInMainUi,
							disabled: !writable || savingPreferences,
							"aria-describedby": creditsHintId,
							onChange: (event) => {
								onToggleShowPoints(event.currentTarget.checked);
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dsm-trae-pref-copy",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-trae-pref-label",
								id: creditsLabelId,
								children: t("row.showPointsInMainUi")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-trae-pref-hint",
								id: creditsHintId,
								children: t(credentialRegionIsAi ? "row.showPointsInMainUiHintAi" : "row.showPointsInMainUiHint")
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
						className: "dsm-trae-pref dsm-trae-credit-position-pref",
						title: t("row.creditPositionHint"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dsm-trae-pref-copy",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-trae-pref-lead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-trae-pref-label",
									children: t("row.creditPositionLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: "dsm-trae-credit-position",
									value: regionOn ? creditPosition : "composer",
									disabled: !regionOn || !writable || savingPreferences,
									"aria-label": t("row.creditPositionAria", { region: panel === "cn" ? t("row.tabCn") : panel === "enterprise" ? t("row.tabEnterprise") : t("row.tabAi") }),
									onChange: (event) => {
										onCreditPositionChange(event.currentTarget.value === "stats" ? "stats" : "composer");
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "composer",
										children: t("row.creditPositionComposer")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "stats",
										children: t("row.creditPositionStats")
									})]
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-trae-pref-hint",
								children: t("row.creditPositionHint")
							})]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
						className: "dsm-trae-pref dsm-trae-refresh-interval-pref",
						title: t("row.refreshIntervalHint"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dsm-trae-pref-copy",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-trae-pref-lead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-trae-pref-label",
									children: t("row.refreshIntervalLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
									className: "dsm-trae-refresh-interval",
									value: String(refreshIntervalMinutes),
									disabled: !writable || savingPreferences,
									"aria-label": t("row.refreshIntervalAria"),
									onChange: (event) => {
										const picked = Number(event.currentTarget.value);
										const match = TRAE_REFRESH_INTERVAL_MINUTES.find((each) => each === picked);
										if (match !== void 0) onRefreshIntervalChange(match);
									},
									children: TRAE_REFRESH_INTERVAL_MINUTES.map((minutes) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: String(minutes),
										children: t("row.refreshIntervalOption", { minutes: String(minutes) })
									}, minutes))
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-trae-pref-hint",
								children: t("row.refreshIntervalHint")
							})]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "dsm-trae-pref",
						title: t("row.sidebarPanelHint"),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							className: "dsm-trae-pref-check",
							checked: sidebarPanelOn,
							disabled: sidebarPanelBusy || savingPreferences,
							onChange: (event) => {
								onToggleSidebarPanel(event.currentTarget.checked);
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dsm-trae-pref-copy",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-trae-pref-label",
								children: t("row.sidebarPanelLabel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-trae-pref-hint",
								children: t("row.sidebarPanelHint")
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconStylePreference, { t })
				]
			}) });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				pool !== void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: "dsm-trae-accounts",
					"aria-label": t("row.accountsTitle"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-trae-accounts-head",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "dsm-trae-accounts-title",
								children: t("row.accountsTitle")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-trae-accounts-hint",
								children: t("row.accountsHint")
							})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsm-btn dsm-btn-outline",
								disabled: busy,
								onClick: onRescan,
								children: busy ? t("row.accountsScanning") : t("row.refreshTokens")
							})]
						}),
						!signedIn || accounts.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsm-trae-usage-account",
							role: "status",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-trae-usage-account-copy",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-usage-status",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										"aria-hidden": "true",
										className: "dsm-trae-usage-dot",
										style: dotStyle(status.status)
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: statusLabel })]
								}), signedIn ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-trae-usage-expiry",
									children: t("row.tokenExpiry", { expiresAt: formatDateTime(status.tokenExpiresAtMs) })
								}) : null]
							})
						}) : null,
						status.status !== "error" && rows.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `dsm-trae-account-table${credentialRegionIsAi ? "" : " dsm-trae-account-table-checkin"}`,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-trae-account-row dsm-trae-account-row-head",
								role: "row",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.accountColumnAccount") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.accountColumnValue") }),
									credentialRegionIsAi ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.accountColumnCheckin") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {})
								]
							}), rows.map((row) => {
								const warning = refreshTokenWarning(row.refreshExpiresAtMs, Date.now(), t, formatDateTime);
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: `dsm-trae-account-row${row.current ? " dsm-trae-account-row-current" : ""}`,
									role: "row",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dsm-trae-account-who",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												"aria-hidden": "true",
												className: "dsm-trae-usage-dot",
												style: dotStyle(row.selected ? "signed-in" : "signed-out")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "dsm-trae-account-name",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: row.accountName }),
													row.current ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsm-trae-account-badge",
														children: t("row.accountCurrentBadge")
													}) : null,
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsm-trae-account-meta",
														children: row.meta
													}),
													warning === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: `dsm-trae-refresh-warn dsm-trae-refresh-warn-${warning.tone}`,
														role: "status",
														children: warning.text
													}),
													row.error === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: row.errorTone === "busy" ? "dsm-trae-account-note dsm-trae-account-note-busy" : "dsm-trae-account-note",
														role: "status",
														children: row.error
													})
												]
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsm-trae-account-worth",
											children: row.value
										}),
										credentialRegionIsAi ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsm-trae-account-checkin-cell",
											children: row.claim === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ClaimCell, {
												claim: row.claim,
												t,
												onClaim: () => {
													onClaim(row.id);
												}
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsm-trae-account-actions",
											children: row.current ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "dsm-btn dsm-btn-outline dsm-trae-account-switch",
												disabled: switchingAccount || !writable,
												onClick: () => {
													onSwitchAccount(row.id);
												},
												children: switchingAccount ? t("row.accountSwitching") : t("row.accountSwitch")
											})
										})
									]
								}, row.id);
							})]
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccountTransfer, {
							t,
							region: panel === "ai" ? "ai" : "cn",
							accounts: accounts.map((account) => ({
								id: account.id,
								accountName: account.accountName
							})),
							onChanged: onTransferChanged
						})
					]
				}),
				signedIn && creditsUnavailable === "enterprise" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dsm-trae-credits-unavailable",
					role: "note",
					children: t("row.enterpriseCreditsNotice")
				}) : null,
				signedIn && alternatives !== void 0 && alternatives.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsm-trae-usage-alternative",
					role: "status",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: "dsm-trae-usage-alternative-text",
						children: [
							t("row.creditsExhausted", { account: status.accountName }),
							" ",
							t("row.creditsAlternative", { accounts: alternatives.map((alt) => `${alt.accountName}（${t(`row.edition${alt.edition === "cn" ? "Cn" : alt.edition === "sg" ? "Sg" : alt.edition === "solo" ? "Solo" : "SoloSg"}`)}：${formatNumber(alt.workAvailable + alt.generalAvailable)}）`).join("、") })
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dsm-trae-usage-switch-button",
						disabled: switchingAccount || !writable,
						onClick: () => {
							const [target] = alternatives;
							if (target !== void 0) onSwitchToAlternative(target.id);
						},
						children: t("row.creditsAlternativeSwitch")
					})]
				}) : null,
				signedIn && creditsExpiry !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ExpiryNotice, {
					expiry: creditsExpiry,
					t
				}) : null,
				rescanNote === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dsm-trae-usage-note",
					role: "status",
					children: rescanNote
				}),
				signedIn ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					pool !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccountPool, {
						panel,
						pool,
						models,
						t,
						settingsScope,
						topActions: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline",
							disabled: busy,
							onClick: onRescan,
							children: busy ? t("row.accountsScanning") : t("row.poolRescan")
						}),
						tools: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-trae-pool-tool-row",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-trae-pool-tool-label",
								children: t("row.poolToolsLabel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccountTransfer, {
								t,
								hideLabel: true,
								region: panel === "ai" ? "ai" : "cn",
								accounts: accounts.map((account) => ({
									id: account.id,
									accountName: account.accountName
								})),
								onChanged: onTransferChanged
							})]
						}),
						details: poolDetails,
						claims: pool.checkinSupported === true ? poolClaims : void 0,
						onClaim,
						deviceClaimed,
						onBind: onSwitchAccount,
						bindingBusy: switchingAccount,
						onChanged: onPoolChanged,
						onRefresh: onPoolRefresh
					}) : null,
					status.checkin !== void 0 && !status.checkin.enabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-trae-usage-error",
						children: t("row.checkinDisabled")
					}) : null,
					status.checkinError === void 0 || status.checkin?.checkedIn === true || status.checkin?.didCheckedIn === true || status.pool?.autoCheckinState?.deviceBlocked === true ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-trae-usage-error",
						children: t("row.checkinStatusError", { message: status.checkinError })
					})
				] }) : null
			] });
		}
		//#endregion
		//#region src/client/plan-text.ts
		/**
		* The international region's "what plan is this account on" text.
		*
		* WHY THIS IS ITS OWN MODULE: three surfaces now answer that one question — the
		* card's subscription box, the card's per-account rows, and the composer
		* readout. Each previously carried its own copy of the verdict, which is how the
		* card's box and its roster row were able to disagree about one account's tier
		* (the box read the usage document's top-level `payStatus`, which the ai document
		* does not always carry, while the row read the per-account state). A second
		* implementation of the same rule is free to drift; there is now exactly one.
		*
		* @module dsh-connect-trae/client/plan-text
		*/
		/**
		* Decide whether an international account is on a paid plan, and name the plan.
		*
		* Two independent things can entitle it: a package row (`has_package`) and a
		* plan identity (`user_pay_identity_str`). Reading only the first is what
		* rendered a Pro member as "No active package" in issue #19, so either one
		* counts. The tier string rides separately so a caller can name the plan instead
		* of only asserting a boolean.
		*/
		function planVerdict(payStatus) {
			const tier = payStatus.payIdentityStr?.trim();
			const paid = payStatus.hasPackage || traePlanIsPaid(payStatus.payIdentityStr);
			return {
				paid,
				...tier === void 0 || tier === "" ? {} : { tier },
				label: paid ? "row.subscribed" : "row.noPackage"
			};
		}
		/**
		* The verdict as ONE short string, for a surface that has a single slot.
		*
		* The composer readout is that surface: it is a few characters wide in the tool
		* row, so it gets the tier name alone (`Pro`, `Free`) rather than the card's
		* two-line label-plus-tier. When the upstream named no tier the label stands in,
		* which is still strictly more than the dash the readout used to show for the
		* whole international region.
		*/
		function planText(payStatus, t) {
			const verdict = planVerdict(payStatus);
			return verdict.tier === void 0 ? t(verdict.label) : verdict.tier;
		}
		//#endregion
		//#region src/client/panel-switch.ts
		/**
		* Whether the OPTIONAL sidebar panel is switched on, as the browser half sees
		* it, plus the tiny subscription the registration controller needs.
		*
		* Ported from the sibling `dsh-connect-workbuddy` plugin (its PR #188, off by
		* default since), because the same two facts decide the shape here:
		*
		* ## Why this is a module-level store and not component state
		*
		* The `sidebar.panellist` row is built from ENTRY METADATA, not from the
		* component: the host's sidebar maps the slot's entries into a row button whose
		* label comes from `options.label` and whose glyph is `renderSlot(...)`. A
		* component that returns `null` therefore does not hide the row — it renders a
		* BLANK, still-clickable nav button. That is why the panel cannot use the
		* `ComposerPointsGate` trick the credit readout uses (that seat renders a list
		* of components, so `null` means absent). The row has to be registered only
		* while the switch is on, and unregistered when it goes off.
		*
		* Registering conditionally in turn means something must OWN the re-register on
		* a settings change, and that something lives in the entry (`apply`), not in a
		* component. This module is the seam between the two: the card publishes a
		* value here after it has verified a write landed, and the entry subscribes to
		* register or dispose.
		*
		* ## Why the Host is the seed
		*
		* The value is DELIVERED by the Host on the status document
		* (`sidebarPanelEnabled`), for the reason every other switch in this plugin is
		* Host-carried: this namespace's browser mirror is documented as stale on the
		* affected 0.1.7 deployments. Reading only the settings scope at startup would
		* let a stale `false` hide a row the Host believes it is serving — with nothing
		* to re-evaluate it afterwards, the panel would then be gone for the session.
		*
		* Turning the panel OFF while the page is open needs no special handling here:
		* the host's layout service drops an `activePanelId` whose `main` key no longer
		* exists, so the centre column returns to the conversation by itself.
		*/
		/** Listeners waiting for a change to the opt-in state. */
		const listeners = /* @__PURE__ */ new Set();
		/**
		* The current answer, defaulting to OFF.
		*
		* OFF is the whole point of this switch: an absent or unreadable value must
		* never turn the row on. See `Config.sidebarPanel` in `src/index.ts`.
		*/
		let wanted = false;
		/** Whether the sidebar panel should currently be registered. */
		function sidebarPanelWanted() {
			return wanted;
		}
		/**
		* Set the opt-in state and notify the registration controller.
		*
		* Idempotent: the controller re-registers on every call, and a settings
		* subscription can legitimately report the same value twice. Callers that
		* cannot tell whether the value changed need not check first.
		*
		* @param next - the desired state.
		*/
		function setSidebarPanelWanted(next) {
			if (wanted === next) return;
			wanted = next;
			for (const listener of [...listeners]) try {
				listener();
			} catch {}
		}
		/**
		* Observe changes to the opt-in state.
		*
		* @param listener - invoked after each change.
		* @returns the disposer removing this listener.
		*/
		function subscribeSidebarPanelWanted(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
		/**
		* Read the opt-in switch out of a settings snapshot.
		*
		* Only an explicit `true` is ON, matching the schema's `default(false)` and
		* every other switch this plugin owns: the row claims a GLOBAL sidebar seat
		* shared by every installed bundle, so an absent or malformed value must read
		* as "did not ask for this", never as consent.
		*
		* The value is deep-unwrapped because DSH 0.1.7 hands volatile-marked fields
		* back as `{get(): T}` live references, which are truthy non-booleans.
		*
		* @param configured - the whole settings snapshot (or any object carrying the
		*   field).
		* @returns whether the panel row should exist.
		*/
		function sidebarPanelEnabledOf(configured) {
			const value = configured?.["sidebarPanel"];
			return (value !== null && typeof value === "object" && typeof value.get === "function" ? value.get() : value) === true;
		}
		function checkinTimeoutMs() {
			return 3e4;
		}
		/** A temporary server-side overload — not a bad request and not a plugin bug. */
		function busyNotice(code) {
			return code === 9074 ? {
				key: "row.checkinBusy",
				tone: "busy"
			} : void 0;
		}
		/** The claim route never answered within the bound. */
		function timeoutNotice() {
			return {
				key: "row.checkinTimeout",
				tone: "busy"
			};
		}
		/** A genuine refusal or transport failure, reported verbatim. */
		function errorNotice(message) {
			return {
				key: "row.checkinError",
				params: { message },
				tone: "error"
			};
		}
		//#endregion
		//#region src/client/TraeUsageCard.tsx
		/**
		* Trae usage card contributed to Harness Plugin configuration.
		*
		* Structure, CSS classes, and button primitives mirror `dsh-subagent-default-model`'s
		* `SubagentModelCard` so the two plugins share one external-presentation language.
		*/
		/**
		* Failure text of a route: the server's own message when it sent one, else the
		* bare status.
		*
		* Issue #66: the card used to throw `HTTP ${status}` and drop the body, so the
		* Host's explanation ("SOLO remote models returned HTTP 401", or the US-region
		* verdict) never reached the user. A 401 from the wrong gateway and a plugin
		* crash therefore read identically.
		*/
		function routeErrorText(body, status) {
			if (typeof body === "object" && body !== null) {
				const error = body.error;
				if (typeof error === "string" && error.trim() !== "") return error;
			}
			return `HTTP ${status}`;
		}
		/**
		* The card's own poll period is NOT a constant: the cadence is the user's
		* (`Config.refreshIntervalMinutes`, default 5 minutes), read through
		* {@link refreshIntervalMsOf} so the card and the composer readout cannot drift
		* apart. It used to be a fixed 60_000 here while the composer readout polled
		* every five minutes — two cadences for the same two upstream routes, decided
		* by which surface you happened to be looking at. The floor of the offered
		* values is one minute; every read is two read-only upstream calls, which is
		* why the setting does not go below that.
		*/
		const TRAE_GITHUB_URL = "https://github.com/dingminhua/dsh-connect-trae";
		/**
		* Write one settings field and confirm the value actually landed.
		*
		* `configForms.set()` resolving is NOT proof that anything was stored: a write
		* can be accepted by the transport and still not materialize — a rejected
		* write reloads Host state and merely RETURNS, so the caller's `await`
		* succeeds while the document is unchanged. The form answers with an explicit
		* boolean for exactly this reason.
		*
		* Either way the caller must not report success on an unpersisted write: the
		* user would see the control flip and then silently revert.
		*
		* @throws {TraeSettingsWriteError} when the write was refused or did not land.
		*/
		var TraeSettingsWriteError = class extends Error {
			constructor(field, detail) {
				super(detail === void 0 || detail === "" ? `trae: settings field "${field}" was not persisted by the settings write` : `trae: settings field "${field}" was not persisted by the settings write (${detail})`);
				this.name = "TraeSettingsWriteError";
			}
		};
		async function writeSettingsField(scope, field, value, landed) {
			if (await scope.set(field, value) === false) throw new TraeSettingsWriteError(field, "the Host refused the write");
			if (!landed(unwrapVolatileDeep(scope.getSnapshot().value))) throw new TraeSettingsWriteError(field);
		}
		/** Read one region's stored `regions` slot out of an unwrapped settings value. */
		function regionSlotsOf(value) {
			const regions = value?.regions;
			return typeof regions === "object" && regions !== null ? regions : {};
		}
		/** Inject the shared card CSS once. */
		if (typeof document !== "undefined") {
			const cssId = "dsh-connect-trae/client.css";
			if (!document.querySelector(`style[data-plugin-css="${cssId}"]`)) {
				const styleTag = document.createElement("style");
				styleTag.dataset.plugin = "dsh-connect-trae";
				styleTag.dataset.pluginCss = cssId;
				styleTag.textContent = TRAE_CARD_CSS;
				document.head.appendChild(styleTag);
			}
		}
		function formatCapacity(value, unknown) {
			if (value === void 0) return unknown;
			if (value >= 1e6 && value % 1e6 === 0) return `${value / 1e6}M`;
			if (value >= 1e3 && value % 1e3 === 0) return `${value / 1e3}K`;
			return formatNumber(value);
		}
		/**
		* Human name for one wire channel (issue #52, P0).
		*
		* The group header answers 「why is this list so long」 — because it is the union
		* of several Trae modes — so it must name the mode, not print `solo_work_remote`.
		* An unknown function falls through to its raw name on purpose: a channel this
		* build does not know about is a fact worth showing rather than hiding behind
		* 「其他」, and it is exactly what a bug report should quote.
		*/
		function modelChannelLabel(channel, t) {
			if (channel === void 0) return t("row.modelsChannelDefault");
			const key = {
				solo_work_remote: "row.modelsChannelWorkRemote",
				solo_work_lite: "row.modelsChannelWorkLite",
				solo_agent_remote: "row.modelsChannelAgentRemote",
				chat_v3: "row.modelsChannelChatV3",
				solo_coder: "row.modelsChannelCoder"
			}[channel];
			return key === void 0 ? channel : t(key);
		}
		/**
		* The verdict badge for one model, or null when it has not been tested.
		*
		* `unknown` renders as inconclusive, never as a failure: a throttle or a dropped
		* connection says nothing about the model, and painting it the same red as a
		* real refusal is what makes users delete working models.
		*/
		const PROBE_LABELS = {
			available: "row.probeAvailable",
			gated: "row.probeGated",
			unsupported: "row.probeUnsupported",
			rate_limited: "row.probeRateLimited",
			auth: "row.probeAuth",
			unknown: "row.probeUnknown"
		};
		function probeBadge(probe, t) {
			if (probe === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `dsm-trae-model-probe dsm-trae-model-probe-${probe.verdict}`,
				title: probe.detail,
				children: t(PROBE_LABELS[probe.verdict])
			});
		}
		/**
		* How each promotion kind is phrased.
		*
		* The wording is PLUGIN copy, not upstream's: Trae publishes a rule — a pay
		* ratio plus optional cheap-hours windows — and never a label (contrast
		* WorkBuddy's `badge.label`, see docs/PROMO_BADGE.md §3). Two things
		* follow, and both are deliberate:
		*
		*  - only `limited_discount` says 限时 / "limited"; upstream gives no end time
		*    for the other kinds, so claiming one would be inventing urgency;
		*  - the number shown is upstream's own pay ratio (`discount: 50` ⇒ 五折 /
		*    "50% off"), never a re-derived price.
		*/
		const PROMO_LABELS$1 = {
			limited: "row.promoLimited",
			subsidy: "row.promoSubsidy",
			offPeak: "row.promoOffPeak"
		};
		/** Pay ratio as the "折" figure a Chinese price tag uses: 50 → "5", 25 → "2.5". */
		function promoZhe$1(discountPercent) {
			const zhe = Math.round(discountPercent * 10) / 100;
			return Number.isInteger(zhe) ? String(zhe) : zhe.toFixed(1);
		}
		/**
		* The model row's promotion capsule, or nothing.
		*
		* Judged HERE, at paint time, not when the directory was parsed: the rule's
		* windows are wall clocks in an upstream-named zone (00:00–09:00 on weekdays,
		* …), so a verdict frozen into a saved catalog would still be shouting about
		* last night's discount tomorrow afternoon. The card re-renders on its poll, so
		* the capsule appears and disappears with the window.
		*
		* One capsule at most, and it sits BESIDE the name rather than inside it: the
		* name is ellipsis-truncated, so a badge placed inside would be clipped away
		* exactly on the long model names.
		*/
		function promoBadge(model, t, now) {
			const badge = selectTraePromoBadge(model.activityDiscount, now);
			if (badge === void 0) return null;
			const zhe = promoZhe$1(badge.discountPercent);
			const hints = [];
			if (badge.beforeRate !== void 0 && badge.rate !== void 0) hints.push(t("row.promoHintRate", {
				before: String(badge.beforeRate),
				rate: String(badge.rate)
			}));
			if (badge.fromClock !== void 0 && badge.untilClock !== void 0 && badge.timeZone !== void 0) hints.push(t("row.promoHintWindow", {
				from: badge.fromClock,
				until: badge.untilClock,
				zone: badge.timeZone
			}));
			if (badge.memberDiscountPercent !== void 0 && badge.memberRate !== void 0) hints.push(t("row.promoHintMember", {
				rate: String(badge.memberRate),
				zhe: promoZhe$1(badge.memberDiscountPercent),
				percent: String(100 - badge.memberDiscountPercent)
			}));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `dsm-trae-model-promo dsm-trae-model-promo-${badge.kind}`,
				title: hints.length === 0 ? t(PROMO_LABELS$1[badge.kind], {
					zhe,
					percent: String(badge.percentOff)
				}) : hints.join(" · "),
				children: t(PROMO_LABELS$1[badge.kind], {
					zhe,
					percent: String(badge.percentOff)
				})
			});
		}
		/** Render Trae sign-in state and the total usage summary as one expandable card. */
		function TraeUsageCard({ t, settingsScope, view, surface, backToConversation }) {
			if (t === void 0) throw new Error("Trae usage card requires its translation function");
			/**
			* The two FULL-BODY surfaces (the sidebar row's `main` panel and the
			* `settings.section` page) have no card chrome to collapse: they are always
			* expanded, and the collapse button is not rendered, so `setOpen` is simply
			* unused there. Keeping ONE `open` value lets every polling effect below stay
			* untouched.
			*/
			const pageSurface = surface === "page";
			const sectionSurface = surface === "section";
			const fullSurface = pageSurface || sectionSurface;
			const [cardOpen, setCardOpen] = (0, react.useState)(view === "page");
			const open = fullSurface || cardOpen;
			/** The region whose tab is on screen; each tab is its own provider stack. */
			const [activeRegion, setActiveRegion] = (0, react.useState)("cn");
			/**
			* Which of the card's three sections is on screen (learned from the sibling
			* `dsh-connect-workbuddy` card, whose settings page split for the same
			* reason).
			*
			* The card had grown into one long column mixing two unrelated jobs —
			* operating an account (who serves, how much is left, the check-in, the pool)
			* and editing the catalog (which models, image input, context budget) — and
			* the two do not even commit the same way: an account change lands on the
			* click, a catalog change is a draft until 「保存」. One column therefore put
			* the save button screens away from what it saves.
			*
			* The region row above stays the SCOPE (which provider this whole card is
			* about); these tabs are the sections of that one scope. Only the ACTIVE
			* section is visible, and the others stay MOUNTED through the `hidden`
			* attribute, so switching back never refetches, a half-filled model draft
			* survives the trip, and the pool keeps its log. `hidden` also takes the
			* inactive panel out of the accessibility tree, which is exactly what
			* `role="tabpanel"` wants.
			*/
			const [panel, setPanel] = (0, react.useState)("accounts");
			/**
			* Last-known usage per region, so tab dots survive tab switches.
			*
			* A region is ABSENT until something has been read for it (issue #77). It used
			* to be seeded with a signed-out document, which meant the whole wait for the
			* first paint rendered as "not signed in — sign in again / scan for accounts"
			* to a user who was perfectly signed in. The difference between "nothing known
			* yet" and "known to be signed out" is the difference between a loading line
			* and a wrong instruction, so the map starts empty and the render below says
			* which one it is.
			*/
			const [statusByRegion, setStatusByRegion] = (0, react.useState)({});
			const [busy, setBusy] = (0, react.useState)(false);
			/**
			* Availability verdicts from the one-click test, per region, keyed by model
			* id. Session-only on purpose: a verdict is one moment on one account, and a
			* persisted "not served" would keep claiming that long after upstream changed
			* its mind.
			*/
			const [probeByRegion, setProbeByRegion] = (0, react.useState)({
				cn: {},
				enterprise: {},
				ai: {}
			});
			const [testing, setTesting] = (0, react.useState)(void 0);
			const [testError, setTestError] = (0, react.useState)(void 0);
			const [testSummary, setTestSummary] = (0, react.useState)(void 0);
			const [settingsRevision, setSettingsRevision] = (0, react.useState)(0);
			/** Per-region unsaved model edits; a draft on one tab is never dropped by
			* switching to the other tab, only by that tab's discard/save. */
			const [drafts, setDrafts] = (0, react.useState)({});
			/**
			* Search text over the model catalog (issue #52, P0).
			*
			* Kept in COMPONENT state, not in the draft: filtering what you look at is not
			* an edit, so it must survive a save and must never make the card look dirty.
			*/
			const [modelQuery, setModelQuery] = (0, react.useState)("");
			/**
			* How much of the catalog the list shows (issue #52, P2).
			*
			* `common` is the DEFAULT because it answers the question the issue was filed
			* with: 24 of the 34 rows are reachable from a normal `solo_work_*` chat turn,
			* and the other 10 exist only on a specialist channel (`solo_coder` 7,
			* `chat_v3` 2, `solo_agent_remote` 1 — measured 2026-10-23). The vendor's own
			* picker shows 14–24 per mode, so 24 is the first list since P0 that looks
			* like the client the reporter compared against.
			*
			* Nothing is REMOVED by this: the view is presentation only. Every action
			* (「test all」, bulk context, the save) still ranges over the full catalog, and
			* an enabled model that the view hides is called out below the list rather
			* than silently dropped from the screen.
			*/
			const [modelView, setModelView] = (0, react.useState)("common");
			/**
			* Channel groups the user folded shut, keyed `panel|channel`.
			*
			* Stored as the EXCEPTION rather than the state of every group so the default
			* stays 「open」: the catalog is short enough to read once grouped, and a
			* default of "collapsed" would hide a model the user came to enable.
			*/
			const [closedModelGroups, setClosedModelGroups] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [saving, setSaving] = (0, react.useState)(false);
			const [switchingAccount, setSwitchingAccount] = (0, react.useState)(false);
			/** Region whose on/off checkbox write is in flight, so its box can't race. */
			const [togglingRegion, setTogglingRegion] = (0, react.useState)(void 0);
			/**
			* Outcome of the last "refresh accounts" press (issue #25).
			*
			* The rescan answers 200 with a fresh account list whether or not anything
			* changed, and the selection is PERSISTED, so a rescan of a machine whose
			* bound account is still the one it was yesterday looks identical to a
			* failure. Reporting the outcome is the difference between "it did nothing"
			* and "it found the same 2 accounts, still on X".
			*/
			const [rescanNote, setRescanNote] = (0, react.useState)(void 0);
			/**
			* A preference the user just flipped, held only until its write lands.
			*
			* The 设置 block used to stage both switches in a draft written by 「保存」.
			* That is GONE: the sibling dsh-connect-workbuddy card commits its preference
			* checkboxes on the click, and a Save button for two booleans asks the user to
			* remember something that has no reason to need remembering.
			*
			* What remains is the smallest thing that keeps a click honest: the box reads
			* this optimistic value until the write settles, then falls back to the
			* committed one. So a flip shows immediately, and a write that FAILS snaps the
			* box back to the Host's value instead of leaving it claiming one that never
			* landed.
			*/
			const optimisticSettings = (0, react.useRef)({});
			/** True while a preference is crossing the wire; serializes both writers. */
			const [savingSettings, setSavingSettings] = (0, react.useState)(false);
			/** The in-flight flip of the per-panel 「自主生图」 switch (undefined = read the document). */
			const [drawImageDraft, setDrawImageDraft] = (0, react.useState)(void 0);
			/**
			* Per-account status (check-in / balances / subscription) shown in each row of
			* the account table, keyed by region then account id. Loaded per account via
			* `TRAE_ACCOUNT_STATUS_PATH` once the table is shown; a row that failed to
			* load (or that has not been read yet) simply renders without its figure,
			* exactly as the composer table treats a missing balance.
			*/
			const [accountStatusByRegion, setAccountStatusByRegion] = (0, react.useState)({
				cn: {},
				enterprise: {},
				ai: {}
			});
			/** Which account row is claiming right now, so only its button spins. */
			const [claimingFor, setClaimingFor] = (0, react.useState)(void 0);
			/**
			* Per-account claim refusals, keyed by region then account id. A refusal is
			* shown next to the row that caused it rather than in one global error line,
			* because the check-in button now lives per account.
			*/
			const [claimNoticeByRegion, setClaimNoticeByRegion] = (0, react.useState)({
				cn: {},
				enterprise: {},
				ai: {}
			});
			/**
			* Whether this MACHINE has spent today's check-in for a given account — the
			* "device is spent but this account was never rewarded" state, per account so
			* it appears next to the row that owns it. Kept separate from the claim error
			* because it is not a failure: it is the upstream's one-per-device-per-day
			* rule, and rendering it through the "签到失败：…" line would present a normal
			* rule as a plugin fault.
			*/
			const [deviceSpentByRegion, setDeviceSpentByRegion] = (0, react.useState)({
				cn: {},
				enterprise: {},
				ai: {}
			});
			/**
			* A refused or unpersisted settings write, surfaced instead of silently
			* reverting. On 0.1.7 a rejected write resolves normally, so without this
			* the control would flip and then quietly snap back on the next snapshot.
			*/
			const [writeError, setWriteError] = (0, react.useState)(void 0);
			/**
			* The optional sidebar row's switch (see `Config.sidebarPanel`).
			*
			* `undefined` means "no local flip in flight": the box then renders the
			* committed value from the settings document, or — when that namespace is not
			* served yet — the Host's own answer on the usage document. Both are read here
			* rather than echoed from local state for the reason every other switch in
			* this card reads them: a write made elsewhere (the DSH settings form, another
			* window) must show up instead of being shadowed by a stale copy.
			*/
			const [sidebarPanelEdit, setSidebarPanelEdit] = (0, react.useState)(void 0);
			const [sidebarPanelBusy, setSidebarPanelBusy] = (0, react.useState)(false);
			const mounted = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			/**
			* The 设置 block: its committed values, its draft, and the ONE write path.
			*
			* The block commits on 「保存」 rather than on every click, so 「放弃」 has a
			* meaning and a half-finished edit cannot land in the settings document. Both
			* fields are written through `writeSettingsField`, which read-back checks the
			* document — `set()` resolving has never been proof a value landed on this
			* Host, so a saved-looking switch that silently reverted is exactly the
			* failure that guard exists for.
			*
			* Committed values are read from the settings document, never echoed from
			* local state: a write made elsewhere (the DSH settings form, another window)
			* then shows up here instead of being shadowed by a stale copy.
			*/
			const committedSettings = {
				showPointsInMainUi: unwrapVolatileDeep(settingsScope?.getSnapshot().value)?.showPointsInMainUi === true,
				/**
				* The automatic-refresh cadence (`Config.refreshIntervalMinutes`).
				*
				* Read through the SHARED reader rather than off the document here: the
				* composer readout reads the same field through the same function, and the
				* two surfaces disagreeing about the cadence is exactly what a second
				* interpretation would produce. It also owns the fallback for a document
				* that never went through the schema (a hand-edited file), so the card
				* cannot end up on a cadence the write path would have refused.
				*/
				refreshIntervalMinutes: refreshIntervalMinutesOf(settingsScope?.getSnapshot().value)
			};
			/**
			* Ids for the block's label/hint wiring. `useId`, not constants: DSH can mount
			* this card twice at once (the settings ROW and the expanded PAGE), and two
			* copies sharing an id would leave the second switch labelled by the first
			* card's element.
			*/
			/**
			* What the two boxes render: the committed value, with any in-flight flip laid
			* over it. Reading BOTH sources here is what lets the write above stay simple —
			* it never has to write into component state that a Host refresh would fight.
			*/
			const settingsEdits = {
				showPointsInMainUi: optimisticSettings.current.showPointsInMainUi ?? committedSettings.showPointsInMainUi,
				refreshIntervalMinutes: optimisticSettings.current.refreshIntervalMinutes ?? committedSettings.refreshIntervalMinutes
			};
			const settingsIds = (0, react.useId)();
			const creditsLabelId = `${settingsIds}-credits`;
			const creditsHintId = `${settingsIds}-credits-hint`;
			/**
			* The poll period, in milliseconds, as the CARD uses it.
			*
			* Derived from the committed-plus-optimistic value above rather than from the
			* document directly, so a pick shows its effect immediately: the timer is
			* rebuilt from this on the next render (see the poll effect's dependency
			* list). Reading it here also keeps the number and the picker in one place —
			* a picker on one cadence and a timer on another is precisely the class of
			* bug this setting replaced.
			*/
			const refreshIntervalMs = settingsEdits.refreshIntervalMinutes * 6e4;
			/**
			* Write ONE preference switch, on the click that flipped it.
			*
			* This replaced a draft + 「保存」/「放弃」 pair, which is what the sibling
			* dsh-connect-workbuddy card does NOT have: its switches are plain checkboxes
			* on a bare line that commit immediately, and a card that needs a Save button
			* for two booleans is asking the user to remember something for no reason.
			*
			* The two writers are SERIALIZED by `savingSettings`, because they write the
			* same settings document. The pattern is the tab bar's `toggleRegion`: flip
			* optimistically so the box responds, then re-read the Host so a failed write
			* snaps it back instead of leaving the box claiming a value that never landed.
			*/
			const writePreference = async (field, value) => {
				if (settingsScope === void 0 || settingsScope.getSnapshot().writable !== true) return;
				setSavingSettings(true);
				setWriteError(void 0);
				optimisticSettings.current = {
					...optimisticSettings.current,
					[field]: value
				};
				setSettingsRevision((revision) => revision + 1);
				try {
					await writeSettingsField(settingsScope, field, value, (readBack) => unwrapVolatileDeep(readBack)?.showPointsInMainUi === value);
				} catch (error) {
					if (mounted.current) setWriteError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) {
						optimisticSettings.current = {
							...optimisticSettings.current,
							[field]: void 0
						};
						setSettingsRevision((revision) => revision + 1);
					}
					if (mounted.current) setSavingSettings(false);
				}
			};
			/**
			* Change how often the plugin refreshes on its own
			* (`Config.refreshIntervalMinutes`).
			*
			* Same shape as {@link writePreference}, and for the same reason: this is a
			* standing preference, so it commits on the pick and is read-back verified —
			* a picker that merely LOOKS changed while the timer keeps its old period is
			* the failure mode worth guarding against here. The read-back compares
			* through `refreshIntervalMinutesOf`, so the value has to land as one of the
			* offered cadences rather than merely being present.
			*
			* The write alone changes nothing on screen until the settings snapshot
			* notifies, which the poll effect below is keyed on: the interval is rebuilt
			* from the new value on the next render, so the old timer is cleared and a
			* fresh one started. That is deliberate — a cadence change must take effect
			* without a reload, and it must not leave the previous interval running.
			*/
			const writeRefreshInterval = async (value) => {
				if (settingsScope === void 0 || settingsScope.getSnapshot().writable !== true) return;
				setSavingSettings(true);
				setWriteError(void 0);
				optimisticSettings.current = {
					...optimisticSettings.current,
					refreshIntervalMinutes: value
				};
				setSettingsRevision((revision) => revision + 1);
				try {
					await writeSettingsField(settingsScope, "refreshIntervalMinutes", value, (readBack) => refreshIntervalMinutesOf(readBack) === value);
				} catch (error) {
					if (mounted.current) setWriteError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) {
						optimisticSettings.current = {
							...optimisticSettings.current,
							refreshIntervalMinutes: void 0
						};
						setSettingsRevision((revision) => revision + 1);
					}
					if (mounted.current) setSavingSettings(false);
				}
			};
			/**
			* Flip the OPTIONAL sidebar row on or off (`Config.sidebarPanel`).
			*
			* Two things happen on a verified write, and BOTH are required:
			*
			*  1. the settings document is updated through `writeSettingsField`, which
			*     read-back checks — a switch that only *looks* on while the Host
			*     disagrees would leave a nav row that vanishes on the next reload;
			*  2. {@link setSidebarPanelWanted} publishes the value, which is what makes
			*     the registration appear or disappear WITHOUT a reload. The row is built
			*     from slot ENTRY METADATA, so it cannot be hidden from inside the
			*     component — the entry has to register or dispose, and it subscribes to
			*     that store.
			*
			* Serialized by its own `sidebarPanelBusy` rather than `savingSettings`: this
			* write touches one scalar, and making it share the credit switch's veil would
			* grey the whole card out for a nav-row toggle.
			*
			* A NOT-writable scope still flips the store. That is deliberate: the row is a
			* client-side registration, and a read-only host (no settings form bound yet)
			* would otherwise leave the user no way to open the page at all. The box reads
			* committed-or-Host value, so the next snapshot is what the user sees.
			*/
			const writeSidebarPanel = async (value) => {
				if (sidebarPanelBusy) return;
				setSidebarPanelBusy(true);
				setWriteError(void 0);
				setSidebarPanelEdit(value);
				try {
					if (settingsScope !== void 0 && settingsScope.getSnapshot().writable === true) await writeSettingsField(settingsScope, "sidebarPanel", value, (readBack) => sidebarPanelEnabledOf(readBack) === value);
					setSidebarPanelWanted(value);
				} catch (error) {
					if (mounted.current) setWriteError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) {
						setSidebarPanelEdit(void 0);
						setSidebarPanelBusy(false);
					}
				}
			};
			/**
			* Flip ONE panel's 「允许模型自主生图」 switch (`drawImageEnabled`).
			*
			* Not a top-level preference like the two above: the flag lives INSIDE
			* `regions.<panel>`, because it is per-panel consent and the Host's tool
			* resolver reads it per panel. `nextRegionDrawImage` carries the rest of that
			* slot through, so flipping this cannot drop the model directory, budgets,
			* pool or credit seat — the failure #44 fixed for the pool.
			*
			* Serialized by `savingSettings` with the sibling writers: they all write the
			* same settings document. The read-back re-reads the document, so a write that
			* silently reverted cannot leave the box claiming a grant the Host never got —
			* the one failure that matters here, because a box that lies about consent
			* makes the tool's absence look like a bug.
			*/
			const writeDrawImage = async (value) => {
				if (settingsScope === void 0 || settingsScope.getSnapshot().writable !== true) return;
				setSavingSettings(true);
				setWriteError(void 0);
				setDrawImageDraft(value);
				try {
					await writeSettingsField(settingsScope, "regions", nextRegionDrawImage(settingsScope.getSnapshot().value, activeRegion, value), (readBack) => regionSlotsOf(readBack)[activeRegion]?.drawImageEnabled === value);
				} catch (error) {
					if (mounted.current) setWriteError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) {
						setDrawImageDraft(void 0);
						setSavingSettings(false);
					}
				}
			};
			(0, react.useEffect)(() => settingsScope?.subscribe(() => {
				setSettingsRevision((value) => value + 1);
			}), [settingsScope]);
			/**
			* WHERE the active tab's credit readout sits (learned from workbuddy #62).
			*
			* Read from the committed SETTINGS document, through the same
			* `regionCreditPositionOf` helper the Host uses — so the control reads
			* instantly and can never disagree with the readout's own gate, which reads
			* the same scope. This mirrors how the show/hide box beside it works
			* (`committedSettings`), rather than how the sibling workbuddy card does it:
			* that card reads the Host's usage answer because a measured defect on its
			* 0.1.7 deployments left the browser settings mirror for its namespace STALE.
			* No such staleness is reproducible here, and reading the mirror eagerly is
			* what keeps this control correct on first paint — a picker fed only by the
			* usage document would sit on the default until a fetch landed, which is the
			* "looks like it did nothing" failure this control must not have.
			*
			* `settingsRevision` is read through the setter above, and the whole block
			* re-renders when the scope notifies, so a write made elsewhere (another
			* window, the DSH settings form) converges here.
			*/
			const creditPositionOn = (item) => regionCreditPositionOf(settingsScope?.getSnapshot().value, item);
			/**
			* Move one region's credit readout between its two seats.
			*
			* Same shape as every other region write on this card: the whole target slot
			* goes in (so a seat change cannot drop that region's model picks, budgets or
			* enabled flag, nor touch the sibling region), the write is read-back
			* verified, and the Host is re-read afterwards. The re-read is load-bearing
			* here — the control renders the Host's answer, so without it the picker
			* keeps showing the seat it had and the change looks like it did nothing.
			*/
			const changeCreditPosition = async (item, position) => {
				if (settingsScope === void 0 || settingsScope.getSnapshot().writable !== true) return;
				setSavingSettings(true);
				setWriteError(void 0);
				try {
					await writeSettingsField(settingsScope, "regions", nextRegionCreditPosition(settingsScope.getSnapshot().value, item, position), (readBack) => regionCreditPositionOf(readBack, item) === position);
					await refreshUsage(item);
				} catch (error) {
					if (mounted.current) setWriteError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) setSavingSettings(false);
				}
			};
			/**
			* Whether one region's provider is switched on, read off the SAME committed
			* settings document the Host reads (`regionEnabledOf` mirrors the Host's
			* `regionStateOf` opt-out rule: only an explicit `false` disables). Reading
			* the stored value rather than echoing local state means a rejected write,
			* another window's change, or a restart all converge on the truth.
			*
			* The whole settings section is passed deliberately: `regionEnabledOf`
			* accepts either it or the bare `regions` map, because passing the section
			* where the map was expected was a shipped bug (the lookup read
			* `section['cn']`, found nothing, and reported `true` forever — the checkbox
			* stayed checked and clicking it appeared dead while the write succeeded).
			*/
			const regionOn = (item) => regionEnabledOf(settingsScope?.getSnapshot().value, item);
			const activeRegionOn = regionOn(activeRegion);
			/**
			* Credential region of the ACTIVE PANEL.
			*
			* The enterprise panel is a second CN pool, so anything that asks "is this the
			* international side?" — pay status vs. credit packs, check-in column, the
			* credit-readout switch — must answer by CREDENTIAL REGION, not by tab
			* identity. `isCnPool` is the common case (cn + enterprise).
			*/
			const credentialRegionIsAi = regionOfPanel(activeRegion) === "ai";
			const isCnPool = !credentialRegionIsAi;
			const refreshUsage = (0, react.useCallback)(async (region, signal) => {
				try {
					const response = await fetch(withTraeRegion(TRAE_USAGE_PATH, region), {
						headers: { accept: "application/json" },
						credentials: "same-origin",
						...signal === void 0 ? {} : { signal }
					});
					const value = await response.json().catch(() => void 0);
					if (!response.ok) throw new Error(routeErrorText(value, response.status));
					const usage = value;
					if (mounted.current && signal?.aborted !== true) setStatusByRegion((prev) => ({
						...prev,
						[region]: usage
					}));
					return usage;
				} catch (error) {
					if (mounted.current && signal?.aborted !== true) setStatusByRegion((prev) => ({
						...prev,
						[region]: {
							status: "error",
							message: error instanceof Error ? error.message : t("row.requestFailed")
						}
					}));
					return;
				}
			}, [t]);
			/**
			* Paint the fast document (issue #77).
			*
			* The full document above cannot answer before the Host has read every member's
			* balance — one upstream round-trip per account, and this panel's pool assembly
			* happens to walk the membership more than once. That is the wait the issue
			* reports: tens of seconds in which the card used to show nothing at all.
			*
			* The fast document is built from local state only (no upstream read at all), so
			* it answers in milliseconds and carries everything needed to DRAW: the bound
			* account, its expiry, the model list and the pool rows. The live figures it
			* omits (credits, check-in column) are exactly the values that need the round
			* trip, and the card already renders their absence as `—` / unknown.
			*
			* Deliberately separate from {@link refreshUsage} rather than a parameter of it:
			* a first paint never writes an error state (a slow upstream is not the user's
			* problem until the full document says so), and it must never downgrade a region
			* that has already been painted in full.
			*/
			const refreshUsageFast = (0, react.useCallback)(async (region, signal) => {
				try {
					const response = await fetch(withTraeRegionFastDetail(TRAE_USAGE_PATH, region), {
						headers: { accept: "application/json" },
						credentials: "same-origin",
						...signal === void 0 ? {} : { signal }
					});
					if (!response.ok) return;
					const usage = await response.json().catch(() => void 0);
					if (usage === void 0) return;
					if (!mounted.current || signal?.aborted === true) return;
					setStatusByRegion((prev) => {
						const previous = prev[region];
						if (previous !== void 0 && previous.status === "signed-in") return prev;
						return {
							...prev,
							[region]: usage
						};
					});
				} catch {}
			}, []);
			(0, react.useEffect)(() => {
				if (!open || !activeRegionOn) return;
				const controller = new AbortController();
				(async () => {
					await refreshUsageFast(activeRegion, controller.signal);
					if (controller.signal.aborted) return;
					refreshUsage(activeRegion, controller.signal);
				})();
				return () => {
					controller.abort();
				};
			}, [
				open,
				activeRegion,
				activeRegionOn,
				refreshUsage,
				refreshUsageFast
			]);
			/**
			* The document actually on screen for this region, and whether one has arrived.
			*
			* `loaded === undefined` is the only state that may render the loading line: a
			* signed-out document is a real answer (the user must sign in), never a stand-in
			* for "still fetching".
			*/
			const loaded = statusByRegion[activeRegion];
			const loading = loaded === void 0;
			const status = loaded ?? {
				status: "signed-out",
				accounts: []
			};
			/**
			* Whether the ACTIVE panel has a usable sign-in.
			*
			* The section tabs render only here: a signed-out card is one screen of
			* instructions ("sign in once in the Trae app" plus the probed paths), and
			* splitting that into panels would hide the only thing it has to say behind a
			* tab the user cannot see the point of. The sibling WorkBuddy card made the
			* same call for the same reason.
			*/
			const signedIn = status.status === "signed-in";
			/**
			* Clear in-flight claim state when the tab changes. `activeRegion` is a single
			* value across both tabs, so a switch must not leave one row's claim spinning
			* under the other tab.
			*/
			(0, react.useEffect)(() => {
				setClaimingFor(void 0);
			}, [activeRegion]);
			(0, react.useEffect)(() => {
				if (!open || !activeRegionOn || status.status !== "signed-in") return;
				const controller = new AbortController();
				const timer = window.setInterval(() => {
					refreshUsage(activeRegion, controller.signal);
				}, refreshIntervalMs);
				return () => {
					window.clearInterval(timer);
					controller.abort();
				};
			}, [
				open,
				activeRegion,
				activeRegionOn,
				refreshUsage,
				status.status,
				refreshIntervalMs
			]);
			const rescanAccounts = async () => {
				setBusy(true);
				setWriteError(void 0);
				try {
					const response = await fetch(withTraeRegion(TRAE_ACCOUNTS_REFRESH_PATH, activeRegion), {
						method: "POST",
						headers: { accept: "application/json" },
						credentials: "same-origin"
					});
					const body = await response.json().catch(() => void 0);
					if (!response.ok || body === void 0 || !Array.isArray(body.accounts)) throw new Error(routeErrorText(body, response.status));
					/**
					* What this press must persist, and why it is NOT `accounts.find(selected)`.
					*
					* The route's `selected` flag answers "which account is IN USE" — and the
					* store reports the account it is bound to, OR, when no binding has ever
					* been saved, the DETECTED default (`preferred`, i.e. whatever the Trae
					* app is signed in to). Those are the same value on a machine that has
					* been used for a while and diverge on exactly the press where it matters:
					* a fresh install, or a Trae sign-in the plugin has not recorded yet.
					*
					* Reading the flag alone therefore meant "nothing was explicitly bound"
					* reduced to "the detected default is what is in use, write nothing" —
					* so the account the user just refreshed was shown as bound while
					* `accounts.<region>` stayed EMPTY, and the next store rebuild (restart,
					* or a Trae sign-in change) silently re-defaulted somewhere else. That is
					* the "refreshed account was not saved" report.
					*
					* The rule is now: persist the account this region is actually using
					* (the store's verdict, which is the truth the card is displaying), and
					* fall back to the region's own roster only when the route returned no
					* verdict at all. A row that is already the SAVED binding is left alone —
					* one press must not rewrite the settings document for nothing.
					*/
					const inUse = body.accounts.find((account) => account.selected) ?? body.accounts[0];
					const configured = configuredAccountsOf(settingsScope?.getSnapshot().value);
					const alreadyBound = inUse !== void 0 && inUse.id === configured[activeRegion];
					const writable = settingsScope !== void 0 && settingsScope.getSnapshot().writable === true;
					const saved = inUse !== void 0 && !alreadyBound && writable;
					if (saved && settingsScope !== void 0 && inUse !== void 0) await writeSettingsField(settingsScope, "accounts", {
						...configured,
						[activeRegion]: inUse.id
					}, (readBack) => configuredAccountsOf(readBack)[activeRegion] === inUse.id);
					await refreshUsage(activeRegion);
					if (mounted.current) setRescanNote(body.accounts.length === 0 ? t("row.accountsRefreshedNone") : t("row.accountsRefreshed", {
						count: String(body.accounts.length),
						selected: saved ? ` · ${t("row.accountsSaved")} ${inUse.accountName ?? inUse.id}` : ` · ${t("row.accountsKept")} ${inUse?.accountName ?? configured[activeRegion] ?? "—"}`
					}));
				} catch (error) {
					if (mounted.current) {
						const message = error instanceof Error ? error.message : t("row.requestFailed");
						setRescanNote(t("row.accountsRescanFailed", { message }));
					}
				} finally {
					if (mounted.current) setBusy(false);
				}
			};
			const switchAccount = async (accountId) => {
				if (settingsScope === void 0) return;
				setSwitchingAccount(true);
				setWriteError(void 0);
				try {
					await writeSettingsField(settingsScope, "accounts", {
						...configuredAccountsOf(settingsScope.getSnapshot().value),
						[activeRegion]: accountId
					}, (readBack) => configuredAccountsOf(readBack)[activeRegion] === accountId);
					await refreshUsage(activeRegion);
					loadAccountStatus(accountId, activeRegion);
				} catch (error) {
					if (mounted.current) setWriteError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) setSwitchingAccount(false);
				}
			};
			/**
			* Load one account row's per-account state (check-in / balances /
			* subscription) and cache it for the row. Called when the table renders and
			* again after a claim so the reward/refusal lands on the row that owns it.
			*/
			const loadAccountStatus = async (accountId, region = activeRegion) => {
				try {
					const url = `${withTraeRegion(TRAE_ACCOUNT_STATUS_PATH, region)}&accountId=${encodeURIComponent(accountId)}`;
					const response = await fetch(url, {
						headers: { accept: "application/json" },
						credentials: "same-origin"
					});
					const body = await response.json().catch(() => ({}));
					if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
					if (mounted.current) setAccountStatusByRegion((prev) => ({
						...prev,
						[region]: {
							...prev[region],
							[accountId]: body
						}
					}));
					return body;
				} catch {
					return;
				}
			};
			/**
			* Re-read EVERY row of one region, not just the one that was acted on.
			*
			* Trae spends the DEVICE's daily check-in, not the account's, so one claim
			* changes what every other row may do: they go from "check in" to "device
			* already used". Re-reading only the claimed account left its siblings
			* advertising a claim that could only come back 9095 — a row of live buttons
			* of which exactly one could work, which is the same false promise the 3.2.0
			* note refused bulk check-in for. Reading the siblings instead of guessing
			* them means the server's own `didCheckedIn` decides, so a sibling that is
			* still genuinely claimable (the device was not spent by this claim) keeps
			* its button.
			*/
			const reloadAccountStatuses = async (region) => {
				if (status.status !== "signed-in") return;
				const ids = status.accounts.map((account) => account.id);
				await Promise.all(ids.map((id) => loadAccountStatus(id, region)));
			};
			/**
			* Claim today's check-in reward for ONE named account row (CN only).
			*
			* The Host route owns every guard that matters — POST only, loopback origin
			* only, CN only, and a status read before the claim — because a browser-side
			* check is not a guard. The row button's own `disabled` is therefore a
			* courtesy (it stops an obviously pointless click), not the protection. The
			* body carries the `accountId`, so the claim reaches THAT account's
			* credential without moving the whole binding.
			*
			* A refusal is not thrown away: the route answers `claimed: false` with the
			* upstream's business code and message, and the row shows it. Three answers
			* are distinguished rather than collapsed into "failed":
			*
			*  - `alreadyCheckedIn` — this ACCOUNT was already paid today; show it as
			*    claimed and refresh, never as an error.
			*  - `deviceCheckedIn` (code 9095) — this MACHINE already spent today's
			*    check-in, so this account cannot claim here today. That is the normal
			*    outcome after switching accounts, and saying "check-in failed" would
			*    blame the plugin for an upstream rule.
			*  - anything else — a real refusal, reported verbatim.
			*/
			const claimFor = async (accountId) => {
				if (activeRegion !== "cn") return;
				setClaimingFor(accountId);
				setClaimNoticeByRegion((prev) => {
					const next = { ...prev[activeRegion] };
					delete next[accountId];
					return {
						...prev,
						[activeRegion]: next
					};
				});
				setDeviceSpentByRegion((prev) => {
					const next = { ...prev[activeRegion] };
					delete next[accountId];
					return {
						...prev,
						[activeRegion]: next
					};
				});
				const controller = new AbortController();
				const timer = setTimeout(() => {
					controller.abort();
				}, checkinTimeoutMs());
				try {
					const response = await fetch(withTraeRegion(TRAE_CHECKIN_PATH, activeRegion), {
						method: "POST",
						headers: {
							accept: "application/json",
							"content-type": "application/json"
						},
						credentials: "same-origin",
						body: JSON.stringify({ accountId }),
						signal: controller.signal
					});
					const body = await response.json().catch(() => void 0);
					if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
					if (body?.claimed === false && body.deviceCheckedIn === true) {
						setDeviceSpentByRegion((prev) => ({
							...prev,
							[activeRegion]: {
								...prev[activeRegion],
								[accountId]: true
							}
						}));
						await refreshUsage(activeRegion);
						await reloadAccountStatuses(activeRegion);
						return;
					}
					if (body?.claimed === false && body.alreadyCheckedIn !== true) {
						const busy = busyNotice(body.code);
						if (busy !== void 0) {
							if (mounted.current) setClaimNoticeByRegion((prev) => ({
								...prev,
								[activeRegion]: {
									...prev[activeRegion],
									[accountId]: busy
								}
							}));
							return;
						}
						const message = body.message === void 0 || body.message === "" ? t("row.checkinRefused", { code: String(body.code ?? "") }) : `${t("row.checkinRefused", { code: String(body.code ?? "") })}: ${body.message}`;
						throw new Error(message);
					}
					await refreshUsage(activeRegion);
					await reloadAccountStatuses(activeRegion);
				} catch (error) {
					if (mounted.current) {
						const notice = controller.signal.aborted ? timeoutNotice() : errorNotice(error instanceof Error ? error.message : t("row.requestFailed"));
						setClaimNoticeByRegion((prev) => ({
							...prev,
							[activeRegion]: {
								...prev[activeRegion],
								[accountId]: notice
							}
						}));
					}
				} finally {
					clearTimeout(timer);
					if (mounted.current) setClaimingFor(void 0);
				}
			};
			/**
			* Load every account row's per-account status when the card shows a
			* signed-in region. This is what makes the check-in buttons, balances, and
			* (ai) subscription rows appear. It is scoped to a stable `status.accounts`
			* identity so switching tabs or re-reading the document does not re-trigger a
			* burst of upstream calls for rows already loaded.
			*/
			(0, react.useEffect)(() => {
				if (!open || !activeRegionOn || status.status !== "signed-in" || status.accounts.length === 0) return;
				status.accounts.map((account) => account.id).join("\0");
				const loadedIds = accountStatusByRegion[activeRegion];
				const todo = status.accounts.filter((account) => loadedIds[account.id] === void 0);
				if (todo.length === 0) return;
				for (const account of todo) loadAccountStatus(account.id, activeRegion);
			}, [
				open,
				activeRegionOn,
				status,
				accountStatusByRegion
			]);
			/**
			* Switch one region's provider off or on (issue #11). The write carries the
			* region's whole slot through untouched — only `enabled` changes — so the
			* user's directory, model picks, image opt-ins and budgets survive a
			* round trip. The Host withdraws or restores the provider route on the next
			* `onChange`, which is what actually removes it from DSH's model picker.
			*/
			const toggleRegion = async (item, enabled) => {
				if (settingsScope === void 0 || settingsScope.getSnapshot().writable !== true) return;
				setTogglingRegion(item);
				setWriteError(void 0);
				try {
					await writeSettingsField(settingsScope, "regions", nextRegionEnabled(settingsScope.getSnapshot().value, item, enabled), (readBack) => regionSlotsOf(readBack)[item] !== void 0 && regionSlotsOf(readBack)[item].enabled === enabled);
				} catch (error) {
					if (mounted.current) setWriteError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) setTogglingRegion(void 0);
				}
			};
			/**
			* One-click availability test for a list of models of the active region.
			*
			* Shared by the「enabled models」and「all models」buttons: the only difference
			* between them is which ids are sent — the enabled rows or the whole visible
			* catalog. Each run goes one model per request, deliberately: the host probe
			* is sequential anyway (Trae throttles bursts), and a per-model round trip
			* lets each row show its verdict as soon as it is known instead of the card
			* sitting blank for a minute. User-started, and it stops on the first
			* authentication failure — every later probe would only repeat that answer.
			*/
			const testModels = async (ids) => {
				setTestError(void 0);
				setTestSummary(void 0);
				if (ids.length === 0) {
					setTestError(t("row.modelsTestEmpty"));
					return;
				}
				setTesting({
					done: 0,
					total: ids.length
				});
				const collected = {};
				let available = 0;
				let denied = false;
				try {
					for (const [index, id] of ids.entries()) {
						if (!mounted.current) return;
						const response = await fetch(withTraeRegion(TRAE_MODELS_TEST_PATH, activeRegion), {
							method: "POST",
							headers: {
								accept: "application/json",
								"content-type": "application/json"
							},
							credentials: "same-origin",
							body: JSON.stringify({ ids: [id] })
						});
						const body = await response.json().catch(() => ({}));
						if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
						const verdict = body.results?.[0];
						if (verdict !== void 0) {
							collected[id] = {
								verdict: verdict.verdict,
								detail: verdict.detail
							};
							if (verdict.verdict === "available") available += 1;
							setProbeByRegion((prev) => ({
								...prev,
								[activeRegion]: {
									...prev[activeRegion],
									[id]: {
										verdict: verdict.verdict,
										detail: verdict.detail
									}
								}
							}));
							if (verdict.verdict === "auth") {
								denied = true;
								break;
							}
						}
						setTesting({
							done: index + 1,
							total: ids.length
						});
					}
					if (mounted.current) {
						setTestSummary(t("row.modelsTestDone", {
							available,
							total: Object.keys(collected).length
						}));
						if (denied) setTestError(t("row.probeAuth"));
					}
				} catch (error) {
					if (mounted.current) setTestError(t("row.modelsTestError", { message: error instanceof Error ? error.message : t("row.requestFailed") }));
				} finally {
					if (mounted.current) setTesting(void 0);
				}
			};
			/** Test only the enabled models of the active region. */
			const testEnabledModels = async () => {
				const ids = [...activeEnabledIds];
				if (ids.length === 0) {
					setTestError(t("row.modelsTestEmpty"));
					setTestSummary(void 0);
					return;
				}
				testModels(ids);
			};
			/**
			* One-click availability test for EVERY model in the active region's catalog,
			* enabled or not — including the rows that are off and the rows the SOLO
			* channel does not serve. The host validates each id against the live catalog
			* and reports rows it does not know as skipped, so passing the whole visible
			* list cannot spend quota on arbitrary config names. Costs quota per model —
			* meaningfully more than the「enabled only」run, which the hint states.
			*/
			const testAllModels = async () => {
				const ids = visibleModels.map((model) => model.id);
				if (ids.length === 0) {
					setTestError(t("row.modelsTestEmpty"));
					setTestSummary(void 0);
					return;
				}
				testModels(ids);
			};
			const refreshModels = async () => {
				setBusy(true);
				try {
					const response = await fetch(withTraeRegion(TRAE_MODELS_REFRESH_PATH, activeRegion), {
						method: "POST",
						headers: { accept: "application/json" },
						credentials: "same-origin"
					});
					const body = await response.json().catch(() => void 0);
					if (!response.ok || body === void 0 || !Array.isArray(body.models)) throw new Error(routeErrorText(body, response.status));
					const fresh = body.models;
					const freshIds = new Set(fresh.map((model) => model.id));
					const stillEnabled = [...activeEnabledIds].filter((id) => freshIds.has(id));
					const stillImages = [...activeImageIds].filter((id) => freshIds.has(id));
					const stillBudgets = {};
					for (const id of freshIds) {
						const budget = activeContextBudgets[id];
						if (typeof budget === "number") stillBudgets[id] = budget;
					}
					setDrafts((prev) => ({
						...prev,
						[activeRegion]: {
							models: fresh.map((model) => ({
								...model,
								input: ["text"]
							})),
							enabledIds: new Set(stillEnabled),
							imageIds: new Set(stillImages),
							contextBudgets: stillBudgets
						}
					}));
				} catch (error) {
					if (mounted.current) setStatusByRegion((prev) => ({
						...prev,
						[activeRegion]: {
							status: "error",
							message: error instanceof Error ? error.message : t("row.requestFailed")
						}
					}));
				} finally {
					if (mounted.current) setBusy(false);
				}
			};
			const settingsValue = unwrapVolatileDeep(settingsScope?.getSnapshot().value);
			const region = activeRegion;
			const configuredRegions = typeof settingsValue === "object" && settingsValue !== null && typeof settingsValue.regions === "object" && settingsValue.regions !== null ? settingsValue.regions : {};
			const regionSlot = configuredRegions[region];
			const legacySlot = region === "cn" && regionSlot === void 0;
			const slotContextBudgets = typeof regionSlot?.contextBudgets === "object" && regionSlot.contextBudgets !== null ? regionSlot.contextBudgets : void 0;
			const legacyContextBudgets = legacySlot && typeof settingsValue === "object" && settingsValue !== null && typeof settingsValue.contextBudgets === "object" && settingsValue.contextBudgets !== null ? settingsValue.contextBudgets : void 0;
			const savedContextBudgets = slotContextBudgets ?? legacyContextBudgets ?? {};
			/**
			* The saved thinking-level choice per model for this panel.
			*
			* A missing key is a real statement — "follow this model's own default" — so
			* it is preserved everywhere below as an absent entry rather than being
			* filled in with the level the model would run at anyway. Writing that level
			* here would freeze today's upstream default into the config, and the model
			* would then ignore upstream when it changed its mind.
			*/
			const savedThinkingEfforts = typeof regionSlot?.thinkingEfforts === "object" && regionSlot.thinkingEfforts !== null ? Object.fromEntries(Object.entries(regionSlot.thinkingEfforts).filter((entry) => typeof entry[1] === "string" && entry[1] !== "")) : {};
			const slotImageIds = Array.isArray(regionSlot?.imageModelIds) ? regionSlot.imageModelIds.filter((id) => typeof id === "string") : void 0;
			const legacyImageIds = legacySlot && typeof settingsValue === "object" && settingsValue !== null && Array.isArray(settingsValue.imageModelIds) ? settingsValue.imageModelIds.filter((id) => typeof id === "string") : [];
			const savedImageIds = new Set(slotImageIds ?? legacyImageIds);
			/**
			* The active panel's 「自主生图」 consent, read from the SAME place the Host
			* reads it (`regions.<panel>.drawImageEnabled`, see regionStateOf) with any
			* in-flight flip laid over it. There is deliberately no legacy flat fallback:
			* this flag was born after the region split, and reading a top-level key here
			* would show consent the Host's per-panel resolver never grants.
			*/
			const committedDrawImage = regionSlot?.drawImageEnabled === true;
			const drawImageOn = drawImageDraft ?? committedDrawImage;
			/**
			* Whether the active panel can serve text-to-image at all. This is the SAME
			* list the Host registers from (`DRAW_IMAGE_PANELS`, imported rather than
			* restated), so the box can never offer a grant the Host will then refuse:
			* a switch that ticks and does nothing is the exact failure this whole
			* opt-in must not have. Two panels are out — `enterprise` bills through a
			* tenant gateway, and `ai` has never been probed at all (every measurement
			* behind the credit figures is CN), so neither may spend credits.
			*/
			const drawImageServable = DRAW_IMAGE_PANELS.includes(activeRegion);
			const drawImageUnavailableHint = activeRegion === "ai" ? t("row.drawImageHintAi") : t("row.drawImageHintEnterprise");
			const draft = drafts[activeRegion];
			const visibleModels = draft?.models ?? (status.status === "signed-in" ? status.models : []);
			/**
			* The catalog as the card draws it: one fixed order, then the search filter,
			* then split into the channels the rows will actually be called through
			* (issue #52, P0).
			*
			* The ROLL is `orderTraeModels` and it is applied here as well as at
			* discovery, because a catalog saved by an older build carries the arrival
			* order — the very thing the reporter photographed. Re-sorting costs one
			* comparison pass over ≤40 rows and makes the screen independent of which
			* version wrote `lastCatalog`.
			*
			* Every action below still ranges over `visibleModels` (the whole catalog),
			* never `shownModels`: 「test all」 and the bulk context buttons must act on all
			* rows, not on whatever the search box happens to show.
			*/
			const modelRegion = regionOfPanel(activeRegion);
			const orderedModels = orderTraeModels(visibleModels, modelRegion);
			/**
			* Scope, then search, then group — in that order, and each step answers a
			* different question (P2): the view is 「how much of the catalog」, the query is
			* 「which row」, the groups are 「where will the turn go」.
			*
			* SEARCH IS SCOPED TO THE VIEW. A global search would contradict the group
			* headers the user is looking at (results from a channel that is not on
			* screen), and scoping it means the empty state has to be honest about what it
			* did not look at — see `matchesOutsideView`.
			*/
			const commonModels = scopeTraeModels(orderedModels, "common", modelRegion);
			const scopedModels = modelView === "all" ? orderedModels : commonModels;
			const commonModelCount = commonModels.length;
			const shownModels = filterTraeModels(scopedModels, modelQuery);
			const modelGroups = groupTraeModels(shownModels, modelRegion);
			const modelQueryActive = modelQuery.trim() !== "";
			/**
			* Matches the query has in the FULL catalog while the view has none.
			*
			* Without this, searching `kimi` with the default view up would answer
			* 「没有匹配」 for `kimi-k2.5`, which is on screen in 全部 — the one wrong
			* answer a search box must not give. Zero means "genuinely absent".
			*/
			const matchesOutsideView = modelQueryActive && shownModels.length === 0 ? filterTraeModels(orderedModels, modelQuery).length : 0;
			/**
			* One clock reading for the whole model list.
			*
			* Promotion badges are judged against it (see `promoBadge`): reading the clock
			* once per render keeps every row's verdict consistent with the others, and
			* because the card re-renders on its poll, a badge still appears and vanishes
			* with its window instead of sticking until the next manual refresh.
			*/
			const nowForPromo = /* @__PURE__ */ new Date();
			const savedEnabledIds = status.status === "signed-in" ? new Set(status.enabledModelIds) : /* @__PURE__ */ new Set();
			const activeEnabledIds = draft?.enabledIds ?? savedEnabledIds;
			const activeImageIds = draft?.imageIds ?? savedImageIds;
			/**
			* Enabled rows this view does not draw.
			*
			* The view hides 10 rows by default; if the user had enabled some of them
			* before this existed, their checkbox is not on the screen, so the ONLY honest
			* options are "say they exist" or "let the screen imply they are off". The save
			* path is already safe (it writes `activeEnabledIds` from state, never from the
			* rendered checkboxes), so this is about not lying to the reader.
			*/
			const scopedIds = new Set(scopedModels.map((model) => model.id));
			const enabledOutsideView = modelView === "all" ? [] : orderedModels.filter((model) => activeEnabledIds.has(model.id) && !scopedIds.has(model.id));
			/**
			* Effective image capability of one row, mirroring what the Host reports to
			* DSH: the user's opt-in unioned with Trae's own `multimodal` flag (issue
			* #16). Rendering the union is what keeps this checkbox truthful — showing the
			* raw `imageModelIds` would draw an unticked box next to a model the plugin
			* is in fact advertising as image-capable.
			*/
			const rowAcceptsImage = (model) => activeImageIds.has(model.id) || model.multimodal === true;
			/**
			* A row Trae itself declares multimodal needs no manual opt-in, so its box is
			* shown ticked and read-only rather than offering a toggle that the union
			* would immediately undo. Turning image input off for such a model is
			* deliberately not supported: the flag is the vendor's own capability answer,
			* and enabling it only lets DSH attach an image the user still has to pick per
			* message — it never sends one by itself.
			*/
			const rowImageIsAutomatic = (model) => model.multimodal === true;
			/**
			* The international tab's plan is rendered by `rowValue`, in the account
			* table's 额度 column — one place, per account, beside the account it belongs
			* to.
			*
			* There used to be a SECOND surface for it: a standalone 「订阅状态」 box below
			* the table, reporting the bound account's plan on its own. It was added to
			* fix 「国际版没有那个积分框」 — an asymmetry against the CN tab's credit panel
			* — but the table's 额度 column had since absorbed exactly that figure, so the
			* box repeated the row directly above it. Two renderers of one verdict is the
			* drift risk `plan-text.ts` exists to prevent, and the box could only ever
			* restate what the marked 「当前使用」 row already said. It is gone; the row is
			* the single surface.
			*/
			const activeContextBudgets = draft?.contextBudgets ?? savedContextBudgets;
			const activeThinkingEfforts = draft?.thinkingEfforts ?? savedThinkingEfforts;
			const dirty = draft !== void 0;
			/** Apply an edit to the ACTIVE tab's draft, seeding it from the current view. */
			const editDraft = (edit) => {
				setDrafts((prev) => ({
					...prev,
					[activeRegion]: edit(prev[activeRegion] ?? {
						models: [...visibleModels],
						enabledIds: new Set(activeEnabledIds),
						imageIds: new Set(activeImageIds),
						contextBudgets: { ...activeContextBudgets },
						thinkingEfforts: { ...activeThinkingEfforts }
					})
				}));
			};
			const toggleModel = (modelId) => {
				editDraft((current) => {
					const next = new Set(current.enabledIds);
					if (!next.delete(modelId)) next.add(modelId);
					return {
						...current,
						enabledIds: next
					};
				});
			};
			const toggleImage = (modelId) => {
				editDraft((current) => {
					const next = new Set(current.imageIds);
					if (!next.delete(modelId)) next.add(modelId);
					return {
						...current,
						imageIds: next
					};
				});
			};
			const setContextBudget = (modelId, budget) => {
				editDraft((current) => {
					const next = { ...current.contextBudgets };
					if (budget === void 0) delete next[modelId];
					else next[modelId] = budget;
					return {
						...current,
						contextBudgets: next
					};
				});
			};
			/**
			* Record one model's thinking level; an empty value means "follow the
			* upstream default" and therefore DELETES the key.
			*
			* Deletion is the point. Keeping the level that happens to equal today's
			* default would look identical on screen while quietly pinning it — the model
			* would stop following upstream the moment Trae changed its own default.
			*/
			const setThinkingEffort = (modelId, effort) => {
				editDraft((current) => {
					const next = { ...current.thinkingEfforts };
					if (effort === "") delete next[modelId];
					else next[modelId] = effort;
					return {
						...current,
						thinkingEfforts: next
					};
				});
			};
			/**
			* Bulk context-budget switch (issue #42 side request). The per-model radios
			* stay exactly as they are; these two act on the whole region draft at once.
			* The reporter counted 18 CN models whose Max window differs from the
			* default and described clicking 18 times per region — 「整区切到 Max」 is
			* those 18 clicks as one button. It writes `maxContextWindow` per row, which
			* is precisely the spelling `applyContextBudgets` recognizes (a budget equal
			* to the native Max window widens the effective window), so bulk and per-row
			* paths land on identical saved state. Models without a Max window are left
			* untouched — inventing a budget for them would be filtered out anyway.
			*/
			const setAllContextMax = () => {
				editDraft((current) => {
					const next = { ...current.contextBudgets };
					for (const model of current.models) if (model.maxContextWindow !== void 0) next[model.id] = model.maxContextWindow;
					return {
						...current,
						contextBudgets: next
					};
				});
			};
			/**
			* Bulk 500K switch: every model that offers the middle step goes to it, and
			* every other model is left exactly as configured.
			*
			* The reporter-shaped case this serves: a region can hold 19 models with a
			* 1M Max, and picking the half-way window one radio at a time is 19 clicks.
			* It writes the literal {@link TRAE_CONTEXT_BUDGET_MID} — the same value the
			* per-row radio writes — so bulk and per-row land on identical saved state,
			* and `applyContextBudgets` re-validates it against each model's windows on
			* every read.
			*/
			const setAllContextMid = () => {
				editDraft((current) => {
					const next = { ...current.contextBudgets };
					for (const model of current.models) if (contextBudgetOptions(model).includes(5e5)) next[model.id] = TRAE_CONTEXT_BUDGET_MID;
					return {
						...current,
						contextBudgets: next
					};
				});
			};
			/**
			* 「恢复默认上下文」 clears every override in this region's draft. Empty
			* dict = every row falls back to its default window (the same state as a
			* region that was never configured), and clearing is what makes the bulk
			* action reversible without 18 more clicks.
			*/
			const resetAllContextBudgets = () => {
				editDraft((current) => ({
					...current,
					contextBudgets: {}
				}));
			};
			const discardModels = () => {
				setDrafts((prev) => {
					const next = { ...prev };
					delete next[activeRegion];
					return next;
				});
			};
			const saveModels = async () => {
				if (settingsScope === void 0) return;
				setSaving(true);
				setWriteError(void 0);
				try {
					if (status.status !== "signed-in") return;
					const nextSlot = {
						enabled: regionOn(activeRegion),
						lastCatalog: orderedModels.map((model) => ({
							...model,
							input: ["text"],
							...model.multimodal === void 0 ? {} : { multimodal: model.multimodal }
						})),
						enabledModelIds: [...activeEnabledIds],
						imageModelIds: [...activeImageIds].filter((id) => activeEnabledIds.has(id)),
						contextBudgets: activeContextBudgets,
						thinkingEfforts: activeThinkingEfforts
					};
					await writeSettingsField(settingsScope, "regions", nextRegionDirectory(configuredRegions, activeRegion, nextSlot), (readBack) => {
						const slot = regionSlotsOf(readBack)[activeRegion];
						const ids = slot?.enabledModelIds;
						if (!Array.isArray(ids) || ids.length !== nextSlot.enabledModelIds.length || !nextSlot.enabledModelIds.every((id) => ids.includes(id))) return false;
						const savedLevels = slot?.thinkingEfforts;
						return (typeof savedLevels === "object" && savedLevels !== null ? Object.keys(savedLevels).filter((id) => activeThinkingEfforts[id] !== void 0) : []).length === Object.keys(activeThinkingEfforts).length;
					});
					discardModels();
					await refreshUsage(activeRegion);
				} catch (error) {
					if (mounted.current) setWriteError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) setSaving(false);
				}
			};
			/**
			* The thinking-level picker for one model row, or nothing when Trae published
			* no tier list for it.
			*
			* The first option is deliberately the interesting one: it names the level
			* this model will actually run at with no choice made. A picker that only
			* listed tiers would leave "nothing chosen" unlabelled, so the reader cannot
			* tell what they are overriding — and the previous UI could not state it at
			* all, which is why DSH's own picker said `Default`.
			*
			* Options are the model's OWN tiers, unlocalised: `low / high / xhigh` need no
			* translation, and a shared ladder across models would list levels that cannot
			* be selected.
			*/
			const effortPicker = (model) => {
				const efforts = model.reasoning?.supported ?? [];
				if (efforts.length === 0) return null;
				const chosen = activeThinkingEfforts[model.id] ?? "";
				const upstream = model.reasoning?.defaultEffort;
				const effective = defaultEffortFor({
					id: model.id,
					supported: efforts,
					defaultEffort: upstream
				}, activeThinkingEfforts);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsm-trae-model-effort",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.modelReasoningLabel") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						className: "dsm-trae-model-effort-select",
						disabled: settingsScope?.getSnapshot().writable !== true || saving,
						value: chosen,
						onChange: (event) => {
							setThinkingEffort(model.id, event.target.value);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: "",
							children: effective === void 0 ? t("row.modelReasoningFollowUpstream") : t("row.modelReasoningFollowUpstreamNamed", { effort: effective })
						}), efforts.map((effort) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: effort,
							children: effort
						}, effort))]
					})] })
				});
			};
			const title = t("row.title");
			/**
			* Row labels for the account table.
			*
			* The raw `edition` token ("solo") told the user nothing about WHICH product a
			* credential came from, which is exactly what made a leftover TRAE SOLO login
			* indistinguishable from the Trae CN one they thought they were bound to
			* (issue #25). Spell the product out, and keep the region as the second axis.
			*/
			const editionLabel = (edition) => t(`row.edition${edition === "cn" ? "Cn" : edition === "sg" ? "Sg" : edition === "solo" ? "Solo" : "SoloSg"}`);
			const sourceLabel = (source) => source === "desktop" ? t("row.sourceDesktop") : source === "cli" ? t("row.sourceCli") : t("row.sourceDsh");
			/**
			* The trailing value on an account row's meta line: the account's general
			* balance (CN) or its subscription verdict (ai).
			*
			* A status that has not loaded — or whose read failed — renders NOTHING
			* rather than a dash. The row already names the account, its edition and its
			* source; a column of placeholder glyphs was pure noise, and it made every
			* row look like something was wrong. `undefined` means "no figure", never
			* "zero".
			*/
			const rowValue = (state) => {
				if (credentialRegionIsAi) {
					const payStatus = state?.payStatus;
					if (payStatus === void 0) return void 0;
					const verdict = planVerdict(payStatus);
					if (!verdict.paid) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsm-trae-account-value",
						children: t("row.noPackage")
					});
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsm-trae-account-value dsm-trae-account-value-on",
						children: verdict.tier === void 0 ? t("row.subscribed") : t("row.planTier", { tier: verdict.tier })
					});
				}
				if (activeRegion === "enterprise") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsm-trae-account-value dsm-trae-account-value-muted",
					children: t("row.balanceConsoleOnly")
				});
				const figure = state?.credits?.generalAvailable;
				if (figure === void 0) return void 0;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsm-trae-account-value",
					children: t("row.accountBalance", { credits: formatNumber(figure) })
				});
			};
			/**
			* The CN check-in control for one account row.
			*
			* The reward rides INSIDE the button ("签到 +150") instead of sitting beside
			* it as a second line, so the row says what the click pays without also
			* carrying a "150 credits per day" caption. Four states, none of which lies:
			*
			*  - claimable — live, and names the payout.
			*  - claiming — this row's own claim is in flight; only its button changes.
			*  - claimed — `checkedIn`: this ACCOUNT was paid, so it reads as done.
			*  - device spent — `didCheckedIn` (or a 9095 refusal from this row's click):
			*    the DEVICE is spent but this account was never rewarded, so the button
			*    says exactly that and stays disabled rather than reporting "done" for an
			*    account that got nothing. The full rule lives in `title` — rendered as a
			*    paragraph it dominated the row and drowned out the account itself.
			*
			* Until the row's status lands the button waits, disabled, so the row keeps
			* its shape instead of reflowing the moment the read returns.
			*/
			/**
			* Everything a check-in button needs, derived once. The pool's table replaces
			* this card's roster table, so the same derivation has to feed both: two
			* copies would drift the moment one of them learned about a new refusal.
			*/
			/**
			* Whether THIS machine has already been paid today, for any account.
			*
			* `didCheckedIn` is not an account fact. Trae keys the daily claim to
			* `x-device-id` and answers a second claim with 9095, so once one account has
			* claimed from this machine, every other account on it is refused for the
			* rest of the day. Keeping that flag per account made the card invite a
			* check-in that could only fail — visible as soon as two accounts sit next to
			* each other in one table.
			*/
			const deviceClaimedToday = (() => {
				for (const state of Object.values(accountStatusByRegion[activeRegion])) if (state?.checkin?.didCheckedIn === true) return true;
				for (const spent of Object.values(deviceSpentByRegion[activeRegion])) if (spent) return true;
				return status.status === "signed-in" && status.pool !== void 0 && status.pool.accounts.some((account) => account.deviceCheckedIn === true);
			})();
			const claimViewOf = (accountId, state) => {
				const checkin = state?.checkin;
				const reward = checkin === void 0 ? void 0 : formatNumber(checkin.credits);
				const claimed = checkin?.checkedIn === true;
				const deviceSpent = deviceClaimedToday;
				const spending = claimingFor === accountId;
				const usable = checkin !== void 0 && checkin.enabled;
				const title = reward === void 0 || !usable ? t("row.checkinDisabled") : deviceSpent && !claimed ? t("row.checkinDeviceSpent") : claimed ? t("row.checkinClaimed") : t("row.checkinReward", { reward });
				return {
					label: spending ? t("row.checkinClaiming") : claimed ? t("row.checkinClaimed") : deviceSpent ? t("row.checkinDeviceSpentShort") : !usable || reward === void 0 ? t("row.checkinClaim") : t("row.checkinClaimWith", { reward }),
					title,
					disabled: !usable || claimed || deviceSpent || spending,
					busy: spending,
					/**
					* False when there is nothing left to DO: a disabled "already claimed"
					* button restates the status line above it, in grey, forever. Callers
					* drop the control instead of buying it a permanent disabled state.
					*/
					claimable: !claimed && !deviceSpent,
					settled: claimed ? "claimed" : deviceSpent ? "device" : void 0
				};
			};
			/**
			* The account roster, ALREADY JUDGED — one row per locally detected sign-in.
			*
			* Every verdict the table draws is decided here rather than in the section
			* component, because each one is a rule with a write or a Host answer behind
			* it: which account is serving (the document's own `accountId`, or the
			* roster's `selected` flag when signed out), what an account is worth
			* (`rowValue`, judged by CREDENTIAL region so the enterprise panel reads CN
			* balances), and whether a row may claim (`claimViewOf`, which knows the
			* device-wide check-in rule). A section that re-derived any of them could
			* disagree with the pool table below it, which reads the same three answers.
			*/
			const accountRows = status.status === "error" ? [] : (status.accounts ?? []).map((account) => {
				const current = status.status === "signed-in" ? account.id === status.accountId : account.selected === true;
				const state = accountStatusByRegion[activeRegion][account.id];
				const notice = claimNoticeByRegion[activeRegion][account.id];
				return {
					id: account.id,
					accountName: account.accountName,
					current,
					selected: account.selected === true,
					meta: `${editionLabel(account.edition)} · ${sourceLabel(account.source)}`,
					value: rowValue(state),
					refreshExpiresAtMs: account.refreshExpiresAtMs,
					error: notice === void 0 ? void 0 : t(notice.key, notice.params),
					errorTone: notice?.tone,
					claim: isCnPool ? (() => {
						const view = claimViewOf(account.id, state);
						return {
							label: view.label,
							title: view.title,
							disabled: view.disabled,
							busy: view.busy,
							claimable: view.claimable,
							settled: view.settled
						};
					})() : void 0
				};
			});
			/**
			* The pool's per-row details, joined from the roster above by id.
			*
			* The pool document carries the accounts but not their edition, source or
			* refresh-token countdown, so those three are spliced in here — by the same
			* `editionLabel` / `sourceLabel` / `refreshTokenWarning` the roster uses, so
			* one account cannot read "国内版 · 桌面端" in one table and something else in
			* the next.
			*/
			const poolDetails = Object.fromEntries((status.status === "signed-in" ? status.accounts : []).map((account) => {
				const warn = refreshTokenWarning(account.refreshExpiresAtMs, Date.now(), t, formatDateTime);
				return [account.id, {
					meta: `${editionLabel(account.edition)} · ${sourceLabel(account.source)}`,
					...warn === void 0 ? {} : {
						warn: warn.text,
						warnTone: warn.tone
					}
				}];
			}));
			const label = loading ? t("row.accountsLoading") : status.status === "signed-in" ? t("row.signedIn", { accountName: status.accountName }) : status.status === "error" ? t("row.requestFailed") : t("row.signedOut");
			/**
			* Whether the sidebar row's box is ticked.
			*
			* Precedence: an in-flight flip, then the committed settings value when this
			* namespace is actually served, then the HOST's answer on the usage document.
			* The Host is the fallback rather than the first source because the card can
			* be bound before the mirror settles; it is consulted at all because that
			* mirror is documented as stale on the affected 0.1.7 deployments, so a stale
			* `false` alone would make a served row look switched off.
			*/
			const sidebarPanelOn = sidebarPanelEdit ?? (settingsScope === void 0 ? void 0 : sidebarPanelEnabledOf(unwrapVolatileDeep(settingsScope.getSnapshot().value))) ?? loaded?.sidebarPanelEnabled === true;
			/**
			* The body BOTH surfaces draw: the region tabs, the section tabs and every
			* section below them.
			*
			* Kept as one value because a page duplicate would be a copy that drifts —
			* the SURFACE changes the chrome around this tree, nothing inside it.
			*/
			const cardBody = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-trae-usage",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-trae-tabs",
						role: "tablist",
						"aria-label": title,
						children: TRAE_PANELS.map((item) => {
							const regionStatus = statusByRegion[item];
							const on = regionOn(item);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-trae-tab-cell",
								role: "presentation",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									role: "tab",
									"aria-selected": item === activeRegion,
									className: `dsm-trae-tab${item === activeRegion ? " dsm-trae-tab-active" : ""}${on ? "" : " dsm-trae-tab-off"}`,
									onClick: () => {
										setActiveRegion(item);
									},
									children: [regionStatus === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										"aria-hidden": "true",
										className: "dsm-trae-tab-dot",
										style: dotStyle(regionStatus.status)
									}), item === "cn" ? t("row.tabCn") : item === "enterprise" ? t("row.tabEnterprise") : t("row.tabAi")]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									className: "dsm-trae-switch dsm-trae-tab-switch",
									title: t("row.tabSwitchHint"),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: on,
										disabled: settingsScope?.getSnapshot().writable !== true || togglingRegion !== void 0,
										"aria-label": t("row.tabSwitchAria", { region: item === "cn" ? t("row.tabCn") : item === "enterprise" ? t("row.tabEnterprise") : t("row.tabAi") }),
										onChange: (event) => {
											toggleRegion(item, event.currentTarget.checked);
										}
									})
								})]
							}, item);
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-region-summary",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-trae-models-summary dsm-trae-tab-hint",
								children: t("row.tabHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-trae-models-summary",
								children: t("row.tabCredentialHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-trae-models-summary dsm-trae-free-quota-warn",
								children: t("row.tabFreeQuotaWarn")
							})
						]
					}),
					writeError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-trae-usage-error",
						role: "alert",
						children: t("row.settingsWriteFailed", { message: writeError })
					}),
					regionOn(activeRegion) ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-trae-tab-off-notice",
						role: "status",
						children: t("row.tabOffNotice")
					}),
					signedIn ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-panels",
						role: "tablist",
						"aria-label": t("row.panelAria"),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "tab",
								id: "dsm-trae-tab-accounts",
								"aria-controls": "dsm-trae-panel-accounts",
								"aria-selected": panel === "accounts",
								className: `dsm-trae-panel-tab${panel === "accounts" ? " dsm-trae-panel-tab-active" : ""}`,
								onClick: () => {
									setPanel("accounts");
								},
								children: t("row.panelAccounts")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "tab",
								id: "dsm-trae-tab-models",
								"aria-controls": "dsm-trae-panel-models",
								"aria-selected": panel === "models",
								className: `dsm-trae-panel-tab${panel === "models" ? " dsm-trae-panel-tab-active" : ""}`,
								onClick: () => {
									setPanel("models");
								},
								children: t("row.panelModels")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "tab",
								id: "dsm-trae-tab-capabilities",
								"aria-controls": "dsm-trae-panel-capabilities",
								"aria-selected": panel === "capabilities",
								className: `dsm-trae-panel-tab${panel === "capabilities" ? " dsm-trae-panel-tab-active" : ""}`,
								onClick: () => {
									setPanel("capabilities");
								},
								children: t("row.panelCapabilities")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "tab",
								id: "dsm-trae-tab-diag",
								"aria-controls": "dsm-trae-panel-diag",
								"aria-selected": panel === "diag",
								className: `dsm-trae-panel-tab${panel === "diag" ? " dsm-trae-panel-tab-active" : ""}`,
								onClick: () => {
									setPanel("diag");
								},
								children: t("row.panelDiag")
							})
						]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-trae-panel",
						role: "tabpanel",
						id: "dsm-trae-panel-accounts",
						"aria-labelledby": "dsm-trae-tab-accounts",
						hidden: signedIn && panel !== "accounts",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TraeAccountPanel, {
							t,
							settingsScope,
							section: "accounts",
							panel: activeRegion,
							status,
							statusLabel: label,
							credentialRegionIsAi,
							regionOn: activeRegionOn,
							showPointsInMainUi: settingsEdits.showPointsInMainUi,
							onToggleShowPoints: (value) => {
								writePreference("showPointsInMainUi", value);
							},
							creditPosition: creditPositionOn(activeRegion),
							onCreditPositionChange: (position) => {
								changeCreditPosition(activeRegion, position);
							},
							refreshIntervalMinutes: settingsEdits.refreshIntervalMinutes,
							onRefreshIntervalChange: (minutes) => {
								writeRefreshInterval(minutes);
							},
							sidebarPanelOn,
							sidebarPanelBusy,
							onToggleSidebarPanel: (value) => {
								writeSidebarPanel(value);
							},
							savingPreferences: savingSettings,
							creditsLabelId,
							creditsHintId,
							rows: accountRows,
							busy,
							rescanNote,
							onRescan: () => {
								rescanAccounts();
							},
							switchingAccount,
							onSwitchAccount: (accountId) => {
								switchAccount(accountId);
							},
							onClaim: (accountId) => {
								claimFor(accountId);
							},
							onTransferChanged: async () => {
								const fresh = await refreshUsage(activeRegion);
								if (fresh !== void 0) setStatusByRegion((current) => ({
									...current,
									[activeRegion]: fresh
								}));
							},
							poolDetails,
							poolClaims: status.status === "signed-in" && status.pool?.checkinSupported === true ? Object.fromEntries(status.accounts.map((account) => [account.id, claimViewOf(account.id, accountStatusByRegion[activeRegion][account.id])])) : void 0,
							models: visibleModels,
							deviceClaimed: deviceClaimedToday,
							onPoolChanged: async () => {
								const fresh = await refreshUsage(activeRegion);
								if (fresh !== void 0) setStatusByRegion((current) => ({
									...current,
									[activeRegion]: fresh
								}));
							},
							onPoolRefresh: async () => {
								const fresh = await refreshUsage(activeRegion);
								if (fresh !== void 0) setStatusByRegion((current) => ({
									...current,
									[activeRegion]: fresh
								}));
							},
							creditsUnavailable: status.status === "signed-in" ? status.creditsUnavailable : void 0,
							creditsExpiry: status.status === "signed-in" ? status.credits?.expiry : void 0,
							alternatives: status.status === "signed-in" ? status.alternatives : void 0,
							onSwitchToAlternative: (accountId) => {
								switchAccount(accountId);
							}
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-panel",
						role: "tabpanel",
						id: "dsm-trae-panel-capabilities",
						"aria-labelledby": "dsm-trae-tab-capabilities",
						hidden: signedIn && panel !== "capabilities",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-trae-panel-note",
							children: t("row.panelCapabilitiesHint")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TraeAccountPanel, {
							t,
							settingsScope,
							section: "prefs",
							panel: activeRegion,
							status,
							statusLabel: label,
							credentialRegionIsAi,
							regionOn: activeRegionOn,
							showPointsInMainUi: settingsEdits.showPointsInMainUi,
							onToggleShowPoints: (value) => {
								writePreference("showPointsInMainUi", value);
							},
							creditPosition: creditPositionOn(activeRegion),
							onCreditPositionChange: (position) => {
								changeCreditPosition(activeRegion, position);
							},
							refreshIntervalMinutes: settingsEdits.refreshIntervalMinutes,
							onRefreshIntervalChange: (minutes) => {
								writeRefreshInterval(minutes);
							},
							sidebarPanelOn,
							sidebarPanelBusy,
							onToggleSidebarPanel: (value) => {
								writeSidebarPanel(value);
							},
							savingPreferences: savingSettings,
							creditsLabelId,
							creditsHintId,
							rows: accountRows,
							busy,
							rescanNote,
							onRescan: () => {
								rescanAccounts();
							},
							switchingAccount,
							onSwitchAccount: (accountId) => {
								switchAccount(accountId);
							},
							onClaim: (accountId) => {
								claimFor(accountId);
							},
							onTransferChanged: async () => {
								const fresh = await refreshUsage(activeRegion);
								if (fresh !== void 0) setStatusByRegion((current) => ({
									...current,
									[activeRegion]: fresh
								}));
							},
							creditsUnavailable: status.status === "signed-in" ? status.creditsUnavailable : void 0,
							creditsExpiry: status.status === "signed-in" ? status.credits?.expiry : void 0,
							alternatives: status.status === "signed-in" ? status.alternatives : void 0,
							onSwitchToAlternative: (accountId) => {
								switchAccount(accountId);
							}
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-trae-panel",
						role: "tabpanel",
						id: "dsm-trae-panel-models",
						"aria-labelledby": "dsm-trae-tab-models",
						hidden: !signedIn || panel !== "models",
						children: signedIn ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: "dsm-trae-models",
							"aria-label": t("row.modelsTitle"),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-models-head",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
										className: "dsm-trae-models-title",
										children: t("row.modelsTitle")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsm-trae-models-summary",
										children: t("row.modelsSummary", { count: activeEnabledIds.size })
									})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsm-trae-models-actions",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "dsm-btn dsm-btn-outline",
												disabled: busy,
												onClick: () => {
													refreshModels();
												},
												children: busy ? t("row.modelsRefreshing") : t("row.modelsRefresh")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "dsm-btn dsm-btn-outline",
												disabled: busy || testing !== void 0 || activeEnabledIds.size === 0,
												title: t("row.modelsTestHint"),
												onClick: () => {
													testEnabledModels();
												},
												children: testing === void 0 ? t("row.modelsTestEnabled") : t("row.modelsTesting", {
													done: testing.done,
													total: testing.total
												})
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "dsm-btn dsm-btn-outline",
												disabled: busy || testing !== void 0 || visibleModels.length === 0,
												title: t("row.modelsTestAllHint"),
												onClick: () => {
													testAllModels();
												},
												children: testing === void 0 ? t("row.modelsTestAll") : t("row.modelsTesting", {
													done: testing.done,
													total: testing.total
												})
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsm-trae-models-hint",
									children: t("row.modelsTestHint")
								}),
								testSummary === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsm-trae-models-summary",
									children: testSummary
								}),
								testError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsm-trae-usage-error",
									role: "alert",
									children: testError
								}),
								orderedModels.length > commonModelCount ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-models-view",
									role: "group",
									"aria-label": t("row.modelsViewLabel"),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsm-trae-models-view-opt",
										"aria-pressed": modelView === "common",
										title: t("row.modelsViewCommonHint"),
										onClick: () => {
											setModelView("common");
										},
										children: t("row.modelsViewCommon", { count: commonModelCount })
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsm-trae-models-view-opt",
										"aria-pressed": modelView === "all",
										title: t("row.modelsViewAllHint"),
										onClick: () => {
											setModelView("all");
										},
										children: t("row.modelsViewAll", { count: orderedModels.length })
									})]
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-models-search",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "search",
										className: "dsm-trae-models-search-input",
										value: modelQuery,
										placeholder: t("row.modelsSearchPlaceholder"),
										"aria-label": t("row.modelsSearch"),
										onChange: (event) => {
											setModelQuery(event.target.value);
											setClosedModelGroups(/* @__PURE__ */ new Set());
										}
									}), modelQueryActive ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-models-search-count",
										children: t("row.modelsSearchCount", {
											shown: shownModels.length,
											total: scopedModels.length
										})
									}) : null]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-model-list",
									children: [modelGroups.length === 0 ? matchesOutsideView > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
										className: "dsm-trae-models-empty",
										children: [t("row.modelsSearchOutsideView", {
											query: modelQuery.trim(),
											count: matchesOutsideView
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsm-trae-models-widen",
											onClick: () => {
												setModelView("all");
											},
											children: t("row.modelsViewShowAll")
										})]
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsm-trae-models-empty",
										children: t("row.modelsSearchEmpty", { query: modelQuery.trim() })
									}) : null, modelGroups.map((group) => {
										const groupKey = `${activeRegion}|${group.channel ?? ""}`;
										const groupOpen = modelQueryActive || !closedModelGroups.has(groupKey);
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
											className: "dsm-trae-model-group",
											open: groupOpen,
											onToggle: (event) => {
												const open = event.currentTarget.open;
												setClosedModelGroups((current) => {
													if (open === !current.has(groupKey)) return current;
													const next = new Set(current);
													if (open) next.delete(groupKey);
													else next.add(groupKey);
													return next;
												});
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
												className: "dsm-trae-model-group-head",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-model-group-name",
													children: modelChannelLabel(group.channel, t)
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-model-group-count",
													children: t("row.modelsGroupCount", { count: group.rows.length })
												})]
											}), group.rows.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: `dsm-trae-model${activeEnabledIds.has(model.id) ? "" : " dsm-trae-model-disabled"}`,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "dsm-trae-model-head",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														className: "dsm-trae-model-enabled",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															type: "checkbox",
															checked: activeEnabledIds.has(model.id),
															disabled: settingsScope?.getSnapshot().writable !== true || saving,
															onChange: () => {
																toggleModel(model.id);
															}
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															className: "dsm-trae-model-copy",
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																className: "dsm-trae-model-name",
																children: [
																	model.name,
																	activeRegion === "enterprise" || model.creditMultiplier === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																		className: "dsm-trae-model-name-rate",
																		children: ["· x", model.creditMultiplier.toFixed(2)]
																	}),
																	probeBadge(probeByRegion[activeRegion][model.id], t)
																]
															}), promoBadge(model, t, nowForPromo)]
														})]
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "dsm-trae-model-options",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
															className: "dsm-trae-model-image",
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																type: "checkbox",
																checked: rowAcceptsImage(model),
																disabled: rowImageIsAutomatic(model) || settingsScope?.getSnapshot().writable !== true || saving,
																title: rowImageIsAutomatic(model) ? t("row.modelImageAuto") : void 0,
																onChange: () => {
																	toggleImage(model.id);
																}
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.modelImage") })]
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("fieldset", {
															className: "dsm-trae-context-budget",
															"aria-label": t("row.contextBudget"),
															title: t("row.contextBudgetHint"),
															children: (() => {
																const options = contextBudgetOptions(model);
																const selectable = model.maxContextWindow !== void 0;
																const current = activeContextBudgets[model.id] ?? model.contextWindow;
																return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
																	className: "dsm-trae-context-select",
																	"aria-label": t("row.contextBudget"),
																	title: t("row.contextBudgetHint"),
																	value: current === void 0 ? "" : String(current),
																	disabled: !selectable || settingsScope?.getSnapshot().writable !== true || saving,
																	onChange: (event) => {
																		setContextBudget(model.id, Number(event.currentTarget.value));
																	},
																	children: options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: String(option),
																		children: formatCapacity(option, t("row.modelUnknown"))
																	}, option))
																});
															})()
														})]
													})]
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "dsm-trae-model-meta",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.modelContext", { context: formatCapacity(model.maxContextWindow ?? model.contextWindow, t("row.modelUnknown")) }) }),
														model.maxTokens === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.modelOutput", { output: formatCapacity(model.maxTokens, t("row.modelUnknown")) }) }),
														effortPicker(model)
													]
												})]
											}, model.id))]
										}, groupKey);
									})]
								}),
								enabledOutsideView.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: "dsm-trae-models-note",
									children: [t("row.modelsEnabledOutsideView", { count: enabledOutsideView.length }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsm-trae-models-widen",
										onClick: () => {
											setModelView("all");
										},
										children: t("row.modelsViewShowAll")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-context-bulk",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsm-btn dsm-btn-outline",
											disabled: busy || saving || settingsScope?.getSnapshot().writable !== true || !visibleModels.some((model) => contextBudgetOptions(model).includes(5e5)),
											title: t("row.contextAllMidHint"),
											onClick: setAllContextMid,
											children: t("row.contextAllMid")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsm-btn dsm-btn-outline",
											disabled: busy || saving || settingsScope?.getSnapshot().writable !== true || !visibleModels.some((model) => model.maxContextWindow !== void 0),
											title: t("row.contextAllMaxHint"),
											onClick: setAllContextMax,
											children: t("row.contextAllMax")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsm-btn dsm-btn-outline",
											disabled: busy || saving || settingsScope?.getSnapshot().writable !== true || Object.keys(activeContextBudgets).length === 0,
											title: t("row.contextAllDefaultHint"),
											onClick: resetAllContextBudgets,
											children: t("row.contextAllDefault")
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsm-trae-model-capability-note",
									children: t("row.contextBudgetHint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dsm-trae-draw-image",
									"data-disabled": drawImageServable ? void 0 : "true",
									title: drawImageServable ? t("row.drawImageHint") : drawImageUnavailableHint,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: drawImageOn,
										disabled: !drawImageServable || busy || saving || savingSettings || settingsScope?.getSnapshot().writable !== true,
										onChange: (event) => {
											writeDrawImage(event.target.checked);
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [t("row.drawImage"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dsm-trae-draw-image-hint",
										children: [" ", drawImageServable ? t("row.drawImageHint") : drawImageUnavailableHint]
									})] })]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsm-trae-model-capability-note",
									children: t("row.modelCapabilityPending")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-model-actions",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
										className: "dsm-trae-usage-cheer",
										href: TRAE_GITHUB_URL,
										target: "_blank",
										rel: "noopener noreferrer",
										children: [t("row.cheer"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsm-trae-usage-cheer-star",
											"aria-hidden": "true",
											children: "★"
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsm-trae-model-actions-buttons",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsm-btn dsm-btn-outline",
											disabled: !dirty || saving,
											onClick: discardModels,
											children: t("row.discard")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsm-btn dsm-btn-primary",
											disabled: !dirty || saving || activeEnabledIds.size === 0,
											onClick: () => {
												saveModels();
											},
											children: saving ? t("row.saving") : t("row.save")
										})]
									})]
								})
							]
						}) }) : null
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-trae-panel",
						role: "tabpanel",
						id: "dsm-trae-panel-diag",
						"aria-labelledby": "dsm-trae-tab-diag",
						hidden: !signedIn || panel !== "diag",
						children: status.status !== "signed-in" || panel !== "diag" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-trae-diag",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-diag-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-label",
										children: t("row.diagRegion")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-value",
										children: activeRegion === "cn" ? t("row.tabCn") : activeRegion === "enterprise" ? t("row.tabEnterprise") : t("row.tabAi")
									})]
								}),
								status.unsupportedRegion === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-diag-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-label",
										children: t("row.diagUnsupportedRegion")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dsm-trae-diag-value dsm-trae-diag-bad",
										children: [
											status.unsupportedRegion.region.toUpperCase(),
											" · ",
											status.unsupportedRegion.accounts.join(", ")
										]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-diag-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-label",
										children: t("row.diagProvider")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-value dsm-trae-diag-mono",
										children: providerOfPanel(activeRegion)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-diag-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-label",
										children: t("row.diagAccount")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-value",
										children: status.accountName
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-diag-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-label",
										children: t("row.diagToken")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-value dsm-trae-diag-mono",
										children: formatDateTime(status.tokenExpiresAtMs)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-diag-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-label",
										children: t("row.diagRefresh")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-value dsm-trae-diag-mono",
										children: status.refreshExpiresAtMs === void 0 ? t("row.diagRefreshNone") : formatDateTime(status.refreshExpiresAtMs)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-diag-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-label",
										children: t("row.diagCatalog")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-value",
										children: formatNumber(status.models.length)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-diag-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-label",
										children: t("row.diagEnabled")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-value",
										children: formatNumber(status.enabledModelIds.length)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-diag-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-label",
										children: t("row.diagPool")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-value",
										children: status.pool === void 0 ? t("row.diagPoolOff") : status.pool.enabled ? t("row.diagPoolOn", { count: status.pool.effectiveMemberAccountIds?.length ?? status.pool.accounts.length }) : t("row.diagPoolOff")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-diag-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-label",
										children: t("row.diagCheckin")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-value",
										children: status.checkin !== void 0 || status.pool?.checkinSupported === true ? t("row.diagCheckinOn") : t("row.diagCheckinOff")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-diag-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-label",
										children: t("row.diagRaw")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-value dsm-trae-diag-mono",
										children: status.rawChat === void 0 ? t("row.diagRawOff") : status.rawChat.state
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-diag-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-label",
										children: t("row.diagFailures")
									}), (() => {
										const failures = [];
										if (status.creditsError !== void 0) failures.push(status.creditsError);
										if (status.payStatusError !== void 0) failures.push(status.payStatusError);
										if (status.checkinError !== void 0) failures.push(status.checkinError);
										if (writeError !== void 0) failures.push(writeError);
										return failures.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsm-trae-diag-value",
											children: t("row.diagNoFailures")
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsm-trae-diag-value dsm-trae-diag-bad dsm-trae-diag-mono",
											children: failures.join(" · ")
										});
									})()]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-diag-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-label",
										children: t("row.diagQuarantine")
									}), status.quarantined === void 0 || status.quarantined.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-value",
										children: t("row.diagQuarantineNone")
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-diag-value dsm-trae-diag-bad dsm-trae-diag-mono",
										children: status.quarantined.map((item) => item.quarantinedAs).join(" · ")
									})]
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-trae-diag-hint",
							children: t("row.diagHint")
						})] })
					}),
					status.status === "signed-out" && loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-trae-usage-text",
						role: "status",
						children: t("row.accountsLoading")
					}) }) : null,
					status.status === "signed-out" && !loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-trae-usage-text",
							children: status.message ?? t("row.signedOutHint")
						}),
						status.unsupportedRegion === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
							className: "dsm-trae-quarantine",
							open: true,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("row.unsupportedRegionTitle") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsm-trae-quarantine-hint",
									children: t("row.unsupportedRegionHint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: "dsm-trae-quarantine-list",
									children: status.unsupportedRegion.accounts.map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: name }) }, name))
								})
							]
						}),
						status.quarantined && status.quarantined.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
							className: "dsm-trae-quarantine",
							open: true,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
									t("row.quarantineTitle"),
									" (",
									status.quarantined.length,
									")"
								] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsm-trae-quarantine-hint",
									children: t("row.quarantineHint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: "dsm-trae-quarantine-list",
									children: status.quarantined.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: item.quarantinedAs }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dsm-trae-quarantine-reason",
										children: [
											item.accounts === void 0 ? t("row.quarantineAccountsUnknown") : t("row.quarantineAccounts", { count: item.accounts }),
											" · ",
											t("row.quarantineBytes", { bytes: item.bytes })
										]
									})] }, item.quarantinedAs))
								})
							]
						}) : null,
						status.searched && status.searched.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
							className: "dsm-trae-searched",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
									t("row.searchedTitle"),
									" (",
									status.searched.length,
									")"
								] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsm-trae-searched-hint",
									children: t("row.searchedHint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: "dsm-trae-searched-list",
									children: status.searched.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: item.path }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dsm-trae-searched-reason",
										children: [
											t(item.source === "cli" ? "row.sourceCli" : "row.sourceDesktop"),
											" · ",
											t(item.reason === "missing" ? "row.reasonMissing" : item.reason === "unreadable" ? "row.reasonUnreadable" : "row.reasonInvalid")
										]
									})] }, `${item.source}:${item.path}`))
								})
							]
						}) : null
					] }) : null,
					status.status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-trae-usage-error",
						children: status.message
					}) : null
				]
			});
			/**
			* The page header, drawn only by the sidebar row's `main` panel.
			*
			* A settings card has the Plugins page's own chrome around it; a full page has
			* nothing, so it has to say what it is and how to leave. The back control
			* reuses the host's `layout.selectPanel(null)` (handed down as
			* `backToConversation`), which is the only public contract for returning the
			* centre column to the conversation — and it is omitted, not drawn dead, on a
			* host that does not declare `layout`.
			*/
			const pageHead = pageSurface ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-trae-page-head",
				children: [
					backToConversation === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "dsm-trae-page-back",
						onClick: backToConversation,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							"aria-hidden": "true",
							className: "dsm-trae-page-back-caret"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.pageBack") })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PluginIcon, { className: "dsm-trae-page-icon" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsm-trae-page-title",
						children: title
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsm-trae-page-desc",
						children: t("row.desc")
					})
				]
			}) : null;
			/**
			* The section head, drawn only by the `settings.section` page.
			*
			* Deliberately NOT {@link pageHead} minus a button: the settings shell already
			* paints the nav row (which carries the icon registered into
			* `settings.section.icon`), the close control and the scroll column, so a
			* second 40px brand mark and a second title here would say the same thing
			* twice in one dialog. What the shell does NOT supply is a statement of what
			* the page is for, which is this heading plus the one-line description.
			*
			* No back control: the shell's close button is the way out of a modal, and a
			* "back to conversation" in here would either duplicate it or — worse — move
			* the centre column behind an open dialog.
			*/
			const sectionHead = sectionSurface ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-trae-section-head",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
					className: "dsm-trae-section-title",
					children: title
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dsm-trae-section-desc",
					children: t("row.desc")
				})]
			}) : null;
			if (pageSurface) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-trae-page",
				onScroll: (event) => {
					updateStickyTabs(event.currentTarget);
				},
				ref: (page) => {
					if (page !== null) requestAnimationFrame(() => {
						updateStickyTabs(page);
					});
				},
				children: [
					pageHead,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-trae-page-body",
						children: cardBody
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BusyOverlay, {
						visible: saving || savingSettings,
						message: t("row.veilSaving")
					})
				]
			});
			if (sectionSurface) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-trae-section",
				children: [
					sectionHead,
					cardBody,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BusyOverlay, {
						visible: saving || savingSettings,
						message: t("row.veilSaving")
					})
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: `dsm-plugin-card${open ? " dsm-plugin-card-open" : ""}`,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "dsm-plugin-card-header",
						"aria-expanded": open,
						"aria-label": `${t(open ? "row.collapse" : "row.expand")}: ${title}`,
						onClick: () => {
							setCardOpen(!open);
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PluginIcon, { className: "dsm-plugin-card-icon" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-plugin-card-head",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-plugin-card-title",
									children: title
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-plugin-card-description",
									children: t("row.desc")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								"aria-hidden": "true",
								className: `dsm-plugin-card-chevron${open ? " dsm-plugin-card-chevron-open" : ""}`
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-plugin-card-body",
						hidden: !open,
						children: open ? cardBody : null
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BusyOverlay, {
						visible: saving || savingSettings,
						message: t("row.veilSaving")
					})
				]
			});
		}
		//#endregion
		//#region src/client/popover.ts
		/**
		* The two shell behaviours the composer credit panel needs: hanging the panel
		* off its trigger, and dismissing it on an outside press.
		*
		* Implemented locally rather than imported from
		* `@deepseek-ai/dsh-client-ui-primitives`. The shell DOES register that package
		* for plugin bundles, so importing it is legal — this is a deliberate choice,
		* not a workaround: the two behaviours are ~40 lines of DOM geometry, and owning
		* them keeps this component renderable in the Node test suite without mocking a
		* package that itself reaches `*.module.css` and further DSH dependencies.
		*
		* NOTE ON A MISDIAGNOSIS, kept because it is the kind of thing that gets
		* re-litigated: the 2.12.0/2.13.0 client load failure was first attributed to
		* importing the primitives package. It was not that. The real cause was
		* `import { createPortal } from 'react-dom'` being BUNDLED rather than
		* externalized — the inlined development build opens with
		* `process.env.NODE_ENV` and threw `ReferenceError: process is not defined` in
		* the browser. See `tsdown.config.ts` for the fix and
		* `tests/client-runtime-imports.spec.ts` for the rule that now prevents it.
		*
		* Behaviour is intentionally identical to the shell's implementations: the same
		* top/bottom placement, the same viewport clamping, the same re-measure on
		* scroll (capture, so nested scrollers count), resize and the panel's own size
		* changes, and the same "a pointerdown outside both the trigger and the panel
		* closes it" rule.
		*/
		/**
		* Clearance to keep from the top of the viewport.
		*
		* The shell reserves a strip at the top of the frame (`--dsh-frame-top-clearance`)
		* for the window chrome, so a panel clamped to `margin` alone can still land
		* under it. Absent variable or no `data-fullscreen` distinction is handled the
		* same way the shell does: fall back to `min`.
		*/
		function overlayTopMargin(min) {
			if (typeof document === "undefined") return min;
			const root = document.documentElement;
			const clearance = Number.parseFloat(getComputedStyle(root).getPropertyValue("--dsh-frame-top-clearance"));
			if (Number.isNaN(clearance)) return min;
			return Math.max(min, (root.hasAttribute("data-fullscreen") ? 0 : clearance) + 20);
		}
		/** Keep a `position: fixed` floating element anchored to a trigger. */
		function useAnchoredPosition(options) {
			const { open, anchorRef, panelRef, side = "bottom", align = "start", gap, margin } = options;
			const [position, setPosition] = (0, react.useState)(null);
			(0, react.useLayoutEffect)(() => {
				if (!open) {
					setPosition(null);
					return;
				}
				const place = () => {
					const rect = anchorRef.current?.getBoundingClientRect();
					if (rect === void 0) return;
					const panel = panelRef.current;
					const width = panel?.offsetWidth ?? 0;
					const height = panel?.offsetHeight ?? 0;
					let left = align === "end" ? rect.right - width : rect.left;
					let top = side === "top" ? rect.top - gap - height : rect.bottom + gap;
					if (width > 0) left = Math.min(Math.max(left, margin), window.innerWidth - width - margin);
					if (height > 0) top = Math.min(Math.max(top, overlayTopMargin(margin)), window.innerHeight - height - margin);
					setPosition({
						left,
						top
					});
				};
				place();
				window.addEventListener("scroll", place, true);
				window.addEventListener("resize", place);
				const panel = panelRef.current;
				let observer = null;
				if (typeof ResizeObserver !== "undefined" && panel !== null) {
					observer = new ResizeObserver(place);
					observer.observe(panel);
				}
				return () => {
					observer?.disconnect();
					window.removeEventListener("scroll", place, true);
					window.removeEventListener("resize", place);
				};
			}, [
				open,
				anchorRef,
				panelRef,
				side,
				align,
				gap,
				margin
			]);
			return position;
		}
		/**
		* Close an open popover when a pointerdown lands outside it.
		*
		* `portal` counts as inside: the panel is portaled to `document.body`, so it is
		* not a descendant of `root` and a click on the panel itself would otherwise
		* read as "outside" and dismiss the popover the user is trying to use.
		*/
		function useDismissOnOutsidePointer(root, open, setOpen, portal) {
			(0, react.useEffect)(() => {
				if (!open) return void 0;
				const closeOutside = (event) => {
					if (event.target instanceof Node && root.current?.contains(event.target) !== true && portal?.current?.contains(event.target) !== true) setOpen(false);
				};
				document.addEventListener("pointerdown", closeOutside);
				return () => {
					document.removeEventListener("pointerdown", closeOutside);
				};
			}, [
				root,
				open,
				setOpen,
				portal
			]);
		}
		//#endregion
		//#region src/client/ComposerPoints.tsx
		/**
		* Credit readout for the composer row (`conversation.input.right`, rendered
		* immediately before the model picker).
		*
		* Shows the bound CN account's general credit balance, but ONLY while the
		* session's selected model belongs to this plugin. That condition is the whole
		* point: the sidebar foot is a single shared row, so two connector plugins each
		* parking a line there end up fighting for the same space. The composer row is
		* per-session and provider-scoped, so exactly one plugin's credits are relevant
		* at a time and nothing overlaps.
		*
		* The row itself is a bare clickable readout — `Trae CN · 657` — with NO
		* controls of its own. Clicking it opens an anchored panel: a TABLE with one row
		* per account in the region and that account's general balance, where a row
		* click switches to it.
		*
		* ONE ACCOUNT, ONE NUMBER, ONE READ (issue #95). The row the trigger describes
		* carries the TRIGGER's own figure — the usage document's balance — instead of a
		* second, separately-read one; the other rows keep their own balances, because
		* the document only knows one account. The current row is the account the
		* request path would bill right now (the pool's `current` flag, then the
		* document's own id), not the saved binding the `selected` flag names.
		*
		* While an account POOL is running the rows are not switchable: a row click
		* writes the saved binding, and the pool — not the binding — decides who bills.
		* The account name and the dot stay; only the button goes, and the panel says
		* why.
		*
		* The panel's header carries the account-pool test batch, labelled 「刷新」, and
		* a SETTINGS pill that opens this plugin's own page in the wide Settings dialog
		* (`./settings-route.ts`).
		*
		* The pill was briefly removed, on the belief that no host seam could open the
		* dialog on a given section. That belief was wrong — the settings shell
		* publishes its state as the `sidebar.settings` store seat, whose `openSection(id)`
		* is exactly that seam — so the pill is back and now lands on this plugin's own
		* `settings.section` page. The route module records the finding.
		*
		* Two deliberate choices in that panel:
		*
		*  - GENERAL balance only, not Work credits. The table's one figure is the
		*    bucket the SOLO chat actually spends; two columns of numbers in a
		*    five-slot popover is noise, and the card is where the breakdown belongs.
		*  - Per-account figures are fetched ONLY while the panel is open. The
		*    5-minute readout must not multiply its upstream reads by the account
		*    count — a healthy balance should not pay for a table nobody is looking at.
		*    This is the same principle that keeps `creditAlternatives` firing only
		*    when a balance hits zero.
		*
		* The provider comes from the Host's own `modelSelection` projection rather
		* than from anything this plugin tracks: the projection is what the model
		* picker writes and what the next request will use, so the readout cannot
		* disagree with the model actually in effect.
		*/
		/**
		* Inject the readout's styles into the document head, once, on module load.
		*
		* Same idempotent pattern as the card's injection, and for the same reason: the
		* classes are attached to DOM this component owns, and `.dsm-card-*` lives in
		* `TRAE_CARD_CSS` — which only loads when the settings card does. Before this
		* existed (2.13.0–2.13.4) the trigger rendered as the browser's default button
		* box and the panel, with no `position: fixed`, had its measured left/top
		* ignored and appeared nowhere.
		*/
		if (typeof document !== "undefined") {
			const cssId = "dsh-connect-trae/composer-points.css";
			if (!document.querySelector(`style[data-plugin-css="${cssId}"]`)) {
				const styleTag = document.createElement("style");
				styleTag.dataset.plugin = "dsh-connect-trae";
				styleTag.dataset.pluginCss = cssId;
				styleTag.textContent = COMPOSER_POINTS_CSS;
				document.head.appendChild(styleTag);
			}
		}
		/**
		* Automatic refresh period when nothing says otherwise.
		*
		* Five minutes, matching the sidebar line: a credit balance moves on the scale
		* of model calls, not seconds, and each read is two read-only upstream calls.
		*
		* The LIVE period is the user's `Config.refreshIntervalMinutes` (see
		* {@link refreshIntervalMsOf}), whose default is this same five minutes — so
		* this constant is now the fallback for a caller that renders the readout
		* without a settings scope (a test, or a host that serves none), not the rule.
		* Both polling surfaces read that ONE field, so the composer row and the card
		* cannot end up refreshing the same routes at different rates.
		*/
		const COMPOSER_POINTS_REFRESH_INTERVAL_MS = 3e5;
		/**
		* Provider routes this readout serves, mapped to the region to read from.
		*
		* BOTH regions, but they do not show the same KIND of number, and that is the
		* data's doing rather than a preference:
		*
		*  - `cn` is credit-based, so the readout shows the account's general balance.
		*  - `ai` is subscription-based. The Host builds its usage document from
		*    `payStatus` and never sets `credits` on it (`webStatusFor` returns early
		*    for `region === 'ai'`), so there is no balance to show. What it does carry
		*    is the PLAN, so the readout names the plan (`Pro` / `Free`) instead.
		*
		* The international route was previously omitted entirely, which meant the
		* readout vanished while an international model was selected — the asymmetry a
		* user reported. Omitting it was the safer half of a real problem (a plan-shaped
		* document templated into a number slot renders a dash), but the fix is to
		* render what that side actually has, not to render nothing.
		*
		* Mirrors `TRAE_PROVIDERS` on the host side; duplicated here because the client
		* bundle must not import the host entry.
		*/
		const TRAE_COMPOSER_PROVIDERS = {
			"trae": "cn",
			"trae-global": "ai"
		};
		/** The general credit balance out of one usage document, or undefined. */
		function generalCreditsOf(usage) {
			if (usage.status !== "signed-in") return void 0;
			return usage.credits?.generalAvailable;
		}
		/** Group the digits so a four-figure balance stays readable in a narrow row. */
		function formatCredits(value) {
			return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
		}
		/**
		* The notice this panel would render, or undefined when there is nothing to say.
		*
		* THE ONE GUARD THE RENDER READS. An earlier version asked
		* `signedIn?.credits?.expiry !== undefined`, which is true whenever upstream sent
		* the four buckets — even with every `packs` count at 0. The box then rendered
		* with an empty `<span>` inside and the `lapsed` border (the tone fallback),
		* i.e. a warning-shaped rectangle containing nothing. Every empty-bucket
		* document produced one, which is the blank box in the reported screenshot.
		*
		* Putting the whole lookup here means the render cannot ask a weaker question
		* than the copy does: "is there a box" and "is there a sentence" are now the
		* same boolean.
		*/
		function expiryNoticeOf(signedIn) {
			const expiry = signedIn?.credits?.expiry;
			return expiry === void 0 ? void 0 : expiryNotice(expiry);
		}
		/**
		* The notice's headline sentence, naming the amount and the pack count.
		*
		* The TIER is chosen by the shared ladder (see `./expiry-ladder.ts`), which the
		* card's account panel uses too — the two surfaces render the same locale
		* keys, so the choice must not be made twice.
		*/
		function expiryMessageOf(expiry, t) {
			const notice = expiryNotice(expiry);
			if (notice === void 0) return "";
			return t(expiryHeadlineKey(notice.tier), {
				total: formatCredits(notice.total),
				packs: String(notice.packs)
			});
		}
		/**
		* A clock time, for the ONE thing in this panel that is always the same day:
		* `composer.lastRefresh`, which is "now" by construction.
		*
		* DO NOT reuse this for credit expiry. It was reused for that once (issue #71)
		* and produced `最早到期：23:59` for a pack expiring TOMORROW at 23:59 — a full
		* day earlier than the truth, in the one sentence whose entire job is "how long
		* do I have left". The card already rendered the same locale key
		* (`row.expiryEarliest`) through `formatDateTime`, so one key had two
		* granularities in one plugin. Expiry goes through `formatDateTime`; only
		* same-day instants may use this.
		*
		* The locale is `undefined` — the READER's, not a fixed one — so an English UI
		* shows `11:59 PM` rather than the Chinese convention's `23:59`. It used to
		* hardcode `'zh-CN'`, which meant the English interface printed a Chinese-style
		* time (issue #71's aside). `formatDateTime` already worked this way; this
		* brings the two into agreement.
		*/
		function formatClock(value) {
			return new Date(value).toLocaleTimeString(void 0, {
				hour: "2-digit",
				minute: "2-digit"
			});
		}
		function ComposerPoints(props) {
			const { t, provider, region, settingsScope, onOpenSettings } = props;
			if (t === void 0) throw new Error("Composer points readout requires its translation function");
			const owned = provider === void 0 ? void 0 : TRAE_COMPOSER_PROVIDERS[provider];
			const activeRegion = region ?? owned;
			/**
			* The poll period, from the user's own cadence setting.
			*
			* Read through the SHARED reader (the card's poll reads the same field the
			* same way), with the constant above as the fallback when this readout is
			* rendered with no settings scope at all. It re-reads on every render, so the
			* scope's notification after a write is enough to rebuild the timer — the
			* effect below lists it as a dependency for exactly that reason.
			*/
			const refreshIntervalMs = settingsScope === void 0 ? COMPOSER_POINTS_REFRESH_INTERVAL_MS : refreshIntervalMsOf(settingsScope.getSnapshot().value);
			const [usage, setUsage] = (0, react.useState)(void 0);
			const [accountCredits, setAccountCredits] = (0, react.useState)(void 0);
			/**
			* Per-account PLANS, international region only.
			*
			* The CN panel reads the credit route; that route is CN-shaped (it calls the
			* credit snapshot, which the ai document does not carry), so the international
			* panel reads the per-account STATUS route instead — the same one the card's
			* roster uses, which answers `payStatus` for ai. Reads only while the panel is
			* open, for the same reason the credit route does.
			*/
			const [accountPlans, setAccountPlans] = (0, react.useState)(void 0);
			const [switchingId, setSwitchingId] = (0, react.useState)(void 0);
			const [failed, setFailed] = (0, react.useState)(false);
			/**
			* The settings button was pressed on a host with no route to the page.
			*
			* Its own state rather than reusing `failed`: the two say different things
			* ("the upstream read failed" vs "this host cannot open the settings page"),
			* and a shared flag would let one press erase the other's explanation.
			*/
			const [settingsFailed, setSettingsFailed] = (0, react.useState)(false);
			/**
			* The account-pool test batch, driven from this panel's header.
			*
			* WHY IT LIVES HERE AT ALL: the rows below ARE the pool's members, and a row's
			* mark is a MEASUREMENT (`被限流 · 约 6 小时后` is a probe result, not a
			* setting). Re-reading the usage document cannot improve a stale measurement —
			* only running it again can — so the question "which of these can serve right
			* now?" had no answer from the place that asks it. The pool card can do this,
			* but it is behind the settings page; the reader is already looking at these
			* accounts.
			*
			* `testing` is separate from the panel's other busy states on purpose: this is
			* a SERIAL batch against one account at a time with a gap (hitting the whole
			* pool at once is how the upstream's volume limit gets tripped), so it can run
			* for a minute while a credits read would be merely slow.
			*
			* `testFailed` is its own line so the two failures cannot take turns
			* overwriting each other in one slot. `testNote` carries the last outcome summary, which is what makes the
			* press feel answered even when the table's marks are subtle.
			*/
			const [testing, setTesting] = (0, react.useState)(false);
			const [testFailed, setTestFailed] = (0, react.useState)(void 0);
			const [testNote, setTestNote] = (0, react.useState)(void 0);
			const testingRef = (0, react.useRef)(false);
			/**
			* The usage document, mirrored into a ref.
			*
			* `fetchAccountPlans` has to read the roster out of it, and reading it as a
			* `useCallback` DEPENDENCY made that callback a new function on every poll
			* (every `fetchUsage` stores a fresh object). The open/region effect calls
			* the callback by identity, so a new identity re-ran it — which meant every
			* five-minute poll silently re-read the per-account status of every account,
			* the exact "read on OPEN, not on a cycle" cost the effect's own comment says
			* it is avoiding. The ref keeps the callback stable while still reading the
			* newest document.
			*/
			const usageRef = (0, react.useRef)(void 0);
			const [lastRefresh, setLastRefresh] = (0, react.useState)(void 0);
			const [open, setOpen] = (0, react.useState)(false);
			/**
			* The usage read that is running right now, if any.
			*
			* A PROMISE, not a flag: a caller that finds one waits for it (see
			* {@link fetchUsage}) instead of dropping its own read. A boolean could only
			* say "yes, something is running", which is not enough to wait on.
			*/
			const inFlight = (0, react.useRef)(void 0);
			const mounted = (0, react.useRef)(true);
			const rootRef = (0, react.useRef)(null);
			const panelRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			/**
			* Re-render when the settings document changes, so a cadence picked in the
			* card reaches THIS readout without a reload.
			*
			* The scope is a stable injected reference, so the subscription is set up once
			* per scope. `settingsRevision` is not read anywhere — bumping it is the whole
			* point, since `refreshIntervalMs` above is recomputed on every render.
			*
			* The gate above (`ComposerPointsGate`) already subscribes for its own two
			* switches, but a child does not re-render because its PARENT subscribed: this
			* component is mounted through that gate, so without its own subscription a
			* cadence change would only land on the next unrelated render.
			*/
			const [, setSettingsRevision] = (0, react.useState)(0);
			(0, react.useEffect)(() => settingsScope?.subscribe(() => {
				setSettingsRevision((revision) => revision + 1);
			}), [settingsScope]);
			const position = useAnchoredPosition({
				open: open && activeRegion !== void 0,
				anchorRef: rootRef,
				panelRef,
				side: "top",
				gap: 8,
				margin: 12
			});
			useDismissOnOutsidePointer(rootRef, open, setOpen, panelRef);
			/**
			* The usage document, read once per call.
			*
			* A read that is ALREADY RUNNING is waited for, not dropped.
			*
			* It used to be skipped outright (`if (inFlight.current) return`), and that
			* left a hole in the fix for issue #95: the panel opens, the 5-minute poll
			* happens to be mid-read, the panel's own read is dropped — and the panel
			* then shows a balance read AFTER the toolbar's, which is exactly the
			* disagreement this change removes. Waiting costs nothing: the caller wants
			* the document anyway, and the wait is what keeps the reads from stacking.
			*/
			const fetchUsage = (0, react.useCallback)(async (signal) => {
				if (activeRegion === void 0) return;
				while (inFlight.current !== void 0) await inFlight.current;
				if (signal?.aborted === true) return;
				const task = (async () => {
					try {
						const response = await fetch(withTraeRegion(TRAE_USAGE_PATH, activeRegion), {
							headers: { accept: "application/json" },
							credentials: "same-origin",
							...signal === void 0 ? {} : { signal }
						});
						if (!response.ok) throw new Error(`HTTP ${response.status}`);
						const value = await response.json();
						if (!mounted.current || signal?.aborted === true) return;
						usageRef.current = value;
						setUsage(value);
						setLastRefresh(Date.now());
						setFailed(false);
					} catch {
						if (mounted.current && signal?.aborted !== true) setFailed(true);
					}
				})();
				inFlight.current = task;
				try {
					await task;
				} finally {
					if (inFlight.current === task) inFlight.current = void 0;
				}
			}, [activeRegion]);
			/**
			* Every account's general balance — one upstream read per account.
			*
			* Paid only while the panel is open (see the note at the top of this file).
			* A failure keeps whatever we already have rather than clearing it: a number
			* that went stale is better than a switch that vanished.
			*/
			const fetchAccountCredits = (0, react.useCallback)(async (signal) => {
				if (activeRegion === void 0) return;
				try {
					const response = await fetch(withTraeRegion(TRAE_ACCOUNT_CREDITS_PATH, activeRegion), {
						headers: { accept: "application/json" },
						credentials: "same-origin",
						...signal === void 0 ? {} : { signal }
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const data = await response.json();
					if (!mounted.current || signal?.aborted === true) return;
					if (Array.isArray(data.accounts)) setAccountCredits(data.accounts);
				} catch {}
			}, [activeRegion]);
			(0, react.useEffect)(() => {
				if (owned === void 0) return void 0;
				let cancelled = false;
				let timer;
				const controller = new AbortController();
				fetchUsage(controller.signal).finally(() => {
					if (cancelled) return;
					timer = window.setInterval(() => {
						fetchUsage(controller.signal);
					}, refreshIntervalMs);
				});
				return () => {
					cancelled = true;
					if (timer !== void 0) window.clearInterval(timer);
					controller.abort();
				};
			}, [
				owned,
				fetchUsage,
				refreshIntervalMs
			]);
			/**
			* Every account's PLAN, one status read per account — ai only.
			*
			* Costs one upstream call per account, paid only while the panel is open (the
			* same rule the credit route follows). A failed read leaves that account's plan
			* undefined, which the row renders as a dash: the row still switches accounts,
			* which is the panel's primary job.
			*/
			const fetchAccountPlans = (0, react.useCallback)(async (signal) => {
				if (activeRegion !== "ai") return;
				const document = usageRef.current;
				const roster = document?.status === "signed-in" ? document.accounts.filter((account) => account.region === "ai") : [];
				if (roster.length === 0) {
					setAccountPlans({});
					return;
				}
				const entries = await Promise.all(roster.map(async (account) => {
					try {
						const response = await fetch(`${withTraeRegion(TRAE_ACCOUNT_STATUS_PATH, "ai")}&accountId=${encodeURIComponent(account.id)}`, {
							headers: { accept: "application/json" },
							credentials: "same-origin",
							...signal === void 0 ? {} : { signal }
						});
						if (!response.ok) throw new Error(`HTTP ${response.status}`);
						const state = await response.json();
						return [account.id, state.payStatus];
					} catch {
						return [account.id, void 0];
					}
				}));
				if (!mounted.current || signal?.aborted === true) return;
				setAccountPlans(Object.fromEntries(entries));
			}, [activeRegion]);
			/**
			* Per-account figures are read on OPEN, not on the 5-minute cycle.
			*
			* The USAGE DOCUMENT is read again here too, and that is the fix for the
			* report (issue #95): the toolbar's number came from the 5-minute poll, so a
			* credit spent since then left the panel reading a NEWER balance than the
			* trigger beside it — the two readouts described different moments of one
			* account. Opening the panel IS the reader asking what is left right now, so
			* the document is re-read with the table: both numbers then come from the
			* same moment, and the row the trigger describes carries the trigger's own
			* figure.
			*
			* It costs the same read the poll would have made anyway, and only while
			* someone is looking at the panel.
			*/
			(0, react.useEffect)(() => {
				if (!open || activeRegion === void 0) return void 0;
				const controller = new AbortController();
				fetchUsage(controller.signal);
				if (activeRegion === "ai") fetchAccountPlans(controller.signal);
				else fetchAccountCredits(controller.signal);
				return () => {
					controller.abort();
				};
			}, [
				open,
				activeRegion,
				fetchUsage,
				fetchAccountCredits,
				fetchAccountPlans
			]);
			(0, react.useEffect)(() => {
				if (!open) return void 0;
				const onKeyDown = (event) => {
					if (event.key === "Escape") setOpen(false);
				};
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [open]);
			/**
			* Switch to another account, then re-read both the usage document and the
			* table so the marker, the readout, and the panel all move together.
			*
			* The merge goes through the shared `configuredAccountsOf` helper (the card
			* uses the same one): writing only `[region]: id` would drop the other
			* region's selection. The write is read-back checked — `set()` resolving is
			* not proof it landed — so a refused write reports failure instead of
			* showing a marker on an account that was never selected.
			*/
			const switchTo = async (accountId) => {
				if (settingsScope === void 0 || settingsScope.getSnapshot().writable !== true) return;
				if (activeRegion === void 0 || switchingId !== void 0) return;
				if (accountId === currentId) return;
				setSwitchingId(accountId);
				setFailed(false);
				try {
					const configured = configuredAccountsOf(settingsScope.getSnapshot().value);
					const accepted = await settingsScope.set("accounts", {
						...configured,
						[activeRegion]: accountId
					});
					const readBack = configuredAccountsOf(settingsScope.getSnapshot().value);
					if (accepted === false || readBack[activeRegion] !== accountId) throw new Error("the Host did not persist the switch");
					await fetchUsage();
					if (activeRegion === "ai") await fetchAccountPlans();
					else await fetchAccountCredits();
				} catch {
					if (mounted.current) setFailed(true);
				} finally {
					if (mounted.current) setSwitchingId(void 0);
				}
			};
			/**
			* The header's settings control: open this plugin's page, then close.
			*
			* CLOSING IS PART OF THE JOB. The panel is portaled to `document.body` and
			* floats over the composer; opening the Settings dialog does not remove it, so
			* leaving it open would park a credits table on top of the dialog the user
			* just asked for. It is not reopened on return — a popover that comes back by
			* itself after navigation is a popover the user cannot get rid of.
			*
			* `false` (no route on this host) sets the panel's own error line rather than
			* doing nothing: a press that changes nothing on screen is indistinguishable
			* from a broken button, and the honest answer here is "this host has no way
			* there".
			*/
			const openSettings = () => {
				if (!(onOpenSettings === void 0 ? false : onOpenSettings())) {
					setSettingsFailed(true);
					return;
				}
				setSettingsFailed(false);
				setOpen(false);
			};
			/**
			* Run the pool's test batch, then re-read what it changed.
			*
			* The route is the SAME one the card's "测试勾选的账号" drives — it tests the
			* pool's checked-in members, not every account listed in this panel — and the
			* model comes from the Host's saved target rather than from here, so a press
			* cannot spend credits on a model the user did not choose. Same for the
			* outcome vocabulary and the NDJSON fold: both live in `./pool-test.ts` so the
			* card and this header cannot answer one batch two ways.
			*
			* The re-read afterwards is not a courtesy. The probes live in the USAGE
			* document (`usage.pool.accounts[].probe`), so the marks only move once that
			* document is fetched again; without it the press would leave the table
			* showing the state it just measured away.
			*
			* A failure keeps the previous measurements: nothing was learned about them,
			* and blanking the marks would look like the addresses had become unusable.
			*/
			const testAccounts = async () => {
				if (activeRegion === void 0 || testingRef.current) return;
				testingRef.current = true;
				setTesting(true);
				setTestFailed(void 0);
				setTestNote(void 0);
				const controller = new AbortController();
				const timer = setTimeout(() => {
					controller.abort();
				}, POOL_TEST_TIMEOUT_MS);
				try {
					const response = await fetch(withTraePoolAction(activeRegion, "test"), {
						method: "POST",
						headers: { accept: "application/json" },
						credentials: "same-origin",
						signal: controller.signal
					});
					let failure;
					let sawAny = false;
					/**
					* Counted by ACCOUNT ID, not by line.
					*
					* The route streams one `{row}` per account and then a `{rows}` summary
					* that repeats every one of them, so counting lines would report "4 / 2".
					* The summary is what guarantees a client that only reads the last line
					* still gets the whole batch, so it cannot simply be ignored.
					*/
					const seen = /* @__PURE__ */ new Map();
					for await (const line of testLinesOf(response)) if (applyTestLine(line, t, (row) => {
						seen.set(row.accountId, row.outcome);
					}, (message) => {
						failure = message;
					})) sawAny = true;
					if (!mounted.current) return;
					if (failure !== void 0) {
						setTestFailed(failure);
						return;
					}
					if (!sawAny) throw new Error(t("row.poolLogGeneric"));
					const outcomes = [...seen.values()];
					setTestNote(t("composer.testDone", {
						ok: String(outcomes.filter((outcome) => outcome === "ok").length),
						total: String(outcomes.length)
					}));
				} catch {
					if (mounted.current && !controller.signal.aborted) setTestFailed(t("composer.testFailed"));
					else if (mounted.current) setTestFailed(t("composer.testTimedOut"));
				} finally {
					clearTimeout(timer);
					testingRef.current = false;
					if (mounted.current) setTesting(false);
					await Promise.all([fetchUsage(), fetchAccountCredits()]);
				}
			};
			if (owned === void 0) return null;
			const signedIn = usage?.status === "signed-in" ? usage : void 0;
			const signedOut = usage !== void 0 && usage.status === "signed-out";
			const general = signedIn === void 0 ? void 0 : generalCreditsOf(signedIn);
			/**
			* What the readout shows after the separator.
			*
			* Region-dependent because the two sides answer different questions: CN has a
			* spendable balance, ai has a plan. Reading the credit field on an ai document
			* would always be `undefined` and print the dash this change exists to remove.
			*/
			const valueText = activeRegion === "ai" ? signedIn?.payStatus === void 0 ? "—" : planText(signedIn.payStatus, t) : general === void 0 ? "—" : formatCredits(general);
			/**
			* The label before the separator. Per REGION, not one hardcoded 'Trae CN':
			* the international readout sat next to the wrong product name otherwise.
			*/
			const label = activeRegion === "ai" ? t("composer.pointsGlobal") : t("composer.points");
			/**
			* The table's rows: every account in this region, with its general balance.
			*
			* The endpoint's answer is authoritative (it carries the figures). Before it
			* lands — or if it fails — fall back to the usage document's account list so
			* the switches are reachable immediately, showing `—` for the figure rather
			* than a spinner the user has to wait on.
			*/
			const selectedId = accountCredits?.find((account) => account.selected)?.id ?? (signedIn === void 0 ? void 0 : signedIn.accountId);
			/**
			* The account the TOOLBAR'S number belongs to.
			*
			* TWO rules, one answer — and the answer is "the account the request path
			* would bill right now", which is the pool card's own rule (`servingAccount`):
			*
			*  - the pool section's `current` flag. The pool selection runs BEFORE the
			*    document reads the credits, so the flag names the very account whose
			*    balance the document carries;
			*  - the document's own `accountId`, which names the credential it read.
			*
			* The pool's flag comes FIRST on purpose: it stays right even when the two
			* halves of the plugin are updated at different times — the client bundle is
			* served from disk, so a browser refresh can pick up a new one while the
			* Host still runs the old module. `accountId` is the fallback for a Host that
			* serves no pool section at all.
			*
			* The table's `selected` flag is the LAST fallback, and it names a different
			* thing (the saved binding). Preferring it put the trigger's number on the
			* wrong row whenever the pool rotated: the panel showed one account's
			* balance and the toolbar another, and both looked authoritative (issue
			* #95).
			*/
			const currentId = signedIn?.pool?.accounts.find((account) => account.current === true)?.accountId ?? (signedIn !== void 0 && signedIn.accountId !== "" ? signedIn.accountId : void 0) ?? selectedId;
			const rows = (activeRegion === "ai" ? signedIn === void 0 ? [] : signedIn.accounts.filter((account) => account.region === "ai").map((account) => ({
				id: account.id,
				accountName: account.accountName,
				selected: account.selected
			})) : accountCredits ?? (signedIn === void 0 ? [] : signedIn.accounts.filter((account) => account.region === activeRegion).map((account) => ({
				id: account.id,
				accountName: account.accountName,
				selected: account.selected
			})))).map((row) => {
				/**
				* ONE account, ONE number, ONE read (issue #95).
				*
				* The current row's balance is the TRIGGER'S balance — the figure the
				* usage document carries — and not a second, separately-read figure for
				* the same account.
				*
				* Two reads of one balance, taken at different moments, is exactly how the
				* report looked: a toolbar reading 「Trae CN · <n>」 beside a row reading
				* a slightly smaller number for the very same account. The table's own
				* read is still the source for every OTHER account (the document only
				* knows one), but for the account the toolbar describes there is nothing
				* to add: the two must be the same number, and the only way to guarantee
				* that is to use one of them.
				*
				* The old rule was the same idea applied to a narrower case — it filled in
				* a MISSING figure from the document — which left a figure that was merely
				* present (and therefore possibly read at another moment) standing on its
				* own.
				*/
				if (row.id !== currentId || general === void 0) return row;
				return {
					...row,
					generalAvailable: general
				};
			});
			const canSwitch = settingsScope !== void 0 && settingsScope.getSnapshot().writable === true;
			/**
			* Whether the ACCOUNT POOL is the one choosing who bills.
			*
			* The pool card answers the same question in one line (「当前计费：X」) and
			* drops its manual picker, because with the pool on the binding does not
			* decide who serves. This panel follows the same rule: a row click writes
			* the saved binding, so while the pool is running the rows are a READOUT of
			* the balances, not a switch.
			*/
			const poolPicks = signedIn?.pool?.enabled === true;
			/**
			* This panel's account pool, when the Host reports one.
			*
			* A `pool` carrying no members is still a pool: the test button is drawn (the
			* Host answers 409 `no-members` and the panel says so) rather than hidden, so
			* the control's absence always means "this panel has no pool feature", never
			* "you have not checked anybody in yet".
			*/
			const pool = signedIn?.pool;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				ref: rootRef,
				className: "dsm-trae-composer-points",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "dsm-trae-composer-points-trigger",
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					onClick: () => {
						setOpen(!open);
					},
					children: [
						label,
						" · ",
						valueText
					]
				}), open && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: panelRef,
					className: "dsm-trae-composer-panel",
					style: position ?? {
						visibility: "hidden",
						left: 0,
						top: 0
					},
					role: "dialog",
					"aria-label": activeRegion === "ai" ? t("composer.panelTitleGlobal") : t("composer.panelTitle"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-trae-composer-panel-head",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-trae-composer-panel-title",
								children: activeRegion === "ai" ? t("composer.panelTitleGlobal") : t("composer.panelTitle")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-trae-composer-panel-actions",
								children: [pool === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "dsm-trae-composer-panel-test",
									title: t("composer.testHint"),
									"aria-label": t("composer.testHint"),
									disabled: testing || switchingId !== void 0,
									onClick: () => {
										testAccounts();
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
										className: testing ? "dsm-trae-composer-panel-test-icon dsm-trae-composer-panel-test-icon-spin" : "dsm-trae-composer-panel-test-icon",
										viewBox: "0 0 16 16",
										width: "12",
										height: "12",
										fill: "none",
										"aria-hidden": "true",
										focusable: "false",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
											d: "M13.4 8a5.4 5.4 0 1 1-5.4-5.4c1.5 0 2.95.62 3.96 1.63L13.4 5.6",
											stroke: "currentColor",
											strokeWidth: "1.5",
											strokeLinecap: "round",
											strokeLinejoin: "round"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
											d: "M13.4 2.6v3h-3",
											stroke: "currentColor",
											strokeWidth: "1.5",
											strokeLinecap: "round",
											strokeLinejoin: "round"
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-composer-panel-test-label",
										children: testing ? t("composer.testing") : t("composer.test")
									})]
								}), onOpenSettings === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "dsm-trae-composer-panel-settings",
									title: t("composer.openSettingsHint"),
									disabled: switchingId !== void 0,
									onClick: openSettings,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
										className: "dsm-trae-composer-panel-settings-icon",
										viewBox: "0 0 16 16",
										width: "12",
										height: "12",
										fill: "none",
										"aria-hidden": "true",
										focusable: "false",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
											d: "M8 10.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z",
											stroke: "currentColor",
											strokeWidth: "1.5"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
											d: "M12.9 9.6a1.2 1.2 0 0 0 .24 1.32l.04.04a1.4 1.4 0 1 1-1.98 1.98l-.04-.04a1.2 1.2 0 0 0-1.32-.24 1.2 1.2 0 0 0-.72 1.1v.12a1.4 1.4 0 1 1-2.8 0v-.07a1.2 1.2 0 0 0-.78-1.1 1.2 1.2 0 0 0-1.32.24l-.04.04a1.4 1.4 0 1 1-1.98-1.98l.04-.04a1.2 1.2 0 0 0 .24-1.32 1.2 1.2 0 0 0-1.1-.72h-.12a1.4 1.4 0 1 1 0-2.8h.07a1.2 1.2 0 0 0 1.1-.78 1.2 1.2 0 0 0-.24-1.32l-.04-.04a1.4 1.4 0 1 1 1.98-1.98l.04.04a1.2 1.2 0 0 0 1.32.24h.05a1.2 1.2 0 0 0 .72-1.1v-.12a1.4 1.4 0 1 1 2.8 0v.07a1.2 1.2 0 0 0 .72 1.1 1.2 1.2 0 0 0 1.32-.24l.04-.04a1.4 1.4 0 1 1 1.98 1.98l-.04.04a1.2 1.2 0 0 0-.24 1.32v.05a1.2 1.2 0 0 0 1.1.72h.12a1.4 1.4 0 1 1 0 2.8h-.07a1.2 1.2 0 0 0-1.1.72Z",
											stroke: "currentColor",
											strokeWidth: "1.5",
											strokeLinecap: "round",
											strokeLinejoin: "round"
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-composer-panel-settings-label",
										children: t("composer.openSettings")
									})]
								})]
							})]
						}),
						signedOut ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-trae-composer-panel-empty",
							children: t("composer.signedOut")
						}) : rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-trae-composer-panel-empty",
							children: t("composer.noAccounts")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
							className: "dsm-trae-composer-panel-table",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								children: t("composer.account")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								className: "dsm-trae-composer-panel-num",
								children: activeRegion === "ai" ? t("composer.plan") : t("composer.generalCredits")
							})] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: rows.map((row) => {
								const current = row.id === currentId;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
									className: current ? "dsm-trae-composer-panel-row-current" : void 0,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										scope: "row",
										children: poolPicks ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dsm-trae-composer-panel-account",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsm-trae-composer-panel-dot",
												"aria-hidden": "true"
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsm-trae-composer-panel-name",
												children: row.accountName
											})]
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: "dsm-trae-composer-panel-switch",
											disabled: !canSwitch || switchingId !== void 0 || current,
											"aria-label": t("composer.switchTo", { account: row.accountName }),
											onClick: () => {
												switchTo(row.id);
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsm-trae-composer-panel-dot",
												"aria-hidden": "true"
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsm-trae-composer-panel-name",
												children: row.accountName
											})]
										})
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: "dsm-trae-composer-panel-num",
										children: activeRegion === "ai" ? (() => {
											const payStatus = row.id === currentId && signedIn?.payStatus !== void 0 ? signedIn.payStatus : accountPlans?.[row.id];
											return payStatus === void 0 ? "—" : planText(payStatus, t);
										})() : row.generalAvailable === void 0 ? "—" : formatCredits(row.generalAvailable)
									})]
								}, row.id);
							}) })]
						}),
						activeRegion === "cn" && expiryNoticeOf(signedIn) !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `dsm-trae-expiry ${expiryToneClass(expiryNoticeOf(signedIn).tier)}`,
							role: "status",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: expiryMessageOf(signedIn.credits.expiry, t) }), expiryNoticeOf(signedIn).soonestExpiresAtMs === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-trae-expiry-detail",
								children: t("row.expiryEarliest", { time: formatDateTime(expiryNoticeOf(signedIn).soonestExpiresAtMs) })
							})]
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsm-trae-composer-panel-foot",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t("composer.lastRefresh"),
								" ",
								lastRefresh === void 0 ? "—" : formatClock(lastRefresh)
							] })
						}),
						poolPicks ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-trae-composer-panel-note",
							role: "status",
							children: t("composer.poolPicks")
						}) : null,
						failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-trae-composer-panel-error",
							role: "status",
							children: t("composer.refreshFailed")
						}) : null,
						settingsFailed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-trae-composer-panel-error",
							role: "status",
							children: t("composer.openSettingsFailed")
						}) : null,
						testNote === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-trae-composer-panel-note",
							role: "status",
							children: testNote
						}),
						testFailed === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-trae-composer-panel-error",
							role: "status",
							children: testFailed
						})
					]
				}), document.body)]
			});
		}
		//#endregion
		//#region src/client/ComposerPointsGate.tsx
		/**
		* Decides whether the composer credit readout belongs in this session, by
		* reading the Host's own `modelSelection` projection and the plugin's
		* `showPointsInMainUi` switch.
		*
		* Kept separate from {@link ComposerPoints} (and from the browser-plugin entry)
		* so the decision can be unit-tested without a Host: the entry imports
		* browser-only DSH packages the test environment cannot load, while this module
		* depends only on React and a narrow projection shape.
		*
		* WHY the projection rather than this plugin's own state: the projection is
		* what the model picker writes and what the next request will use, so the
		* readout cannot disagree with the model actually in effect. `next` outranks
		* `lastUsed` because a selection that has been made but not yet sent is still
		* what the composer shows the user.
		*
		* The switch is read the same way the retired sidebar gate read it: absent or
		* false means OFF, and only an explicit `true` shows the readout. The composer
		* row is shared with the shell's own permission/agent/model controls, so the
		* readout must be asked for, not imposed — 2.13.0 rendered it unconditionally
		* and 2.13.3 restored the opt-in after the user went looking for the switch.
		*
		* WHY THERE IS A SECOND SEAT (learned from dsh-connect-workbuddy issue #62).
		* That row is a LIST seat, so it is shared not only with the shell's own
		* controls but with any other plugin that registers there — and one report is
		* exactly that: with a third-party plugin installed the readout stopped
		* appearing. A list seat cannot promise that every occupant is visible, so the
		* seat becomes the USER's choice: `composer` (default, unchanged for anyone who
		* does not choose) or `stats`, the ambient dock below the composer card where
		* the shell renders its own round/step/token pills. This plugin has already
		* lost this readout once to a shared seat — it used to live at the sidebar
		* foot, where it was clipped to "Tr" beside dsh-connect-workbuddy's rows.
		*
		* The gate is registered in BOTH seats and renders in the one the setting
		* names, which keeps the decision in ONE function instead of re-registering
		* slots when the setting changes — and this repository already documents that
		* kind of binding as fragile (the rc.6→rc.7 `id`/`order` → `key`/`priority`
		* rename). Registration is unconditional; only the render is conditional.
		*/
		/**
		* The provider route the session is currently pointed at.
		*
		* `next` wins over `lastUsed`: a switch that has landed but not yet been sent
		* is still the selection the composer displays.
		*/
		function selectedProviderOf(projection) {
			const provider = (projection?.next ?? projection?.lastUsed)?.provider;
			return typeof provider === "string" && provider !== "" ? provider : void 0;
		}
		/**
		* The settings tree this plugin writes, unwrapped to a plain object.
		*
		* `unwrapVolatileDeep` first: on DSH 0.1.7 the scope's value is a live
		* cosmokit reference, and reading a field off it without unwrapping yields a
		* proxy whose `===` comparison against a string is false — which would make the
		* seat test below reject EVERY seat and silently hide the readout.
		*/
		function scopeValueOf(scope) {
			return scope === void 0 ? void 0 : unwrapVolatileDeep(scope.getSnapshot().value);
		}
		/**
		* Read the composer-readout switch out of a committed settings snapshot.
		*
		* Absent means OFF, matching the host default (`false`): a scope that has not
		* populated yet, or a host too old to serve the field, must not put a row in
		* the composer toolbar that the user never asked for.
		*/
		function composerPointsEnabledOf(scope) {
			return scopeValueOf(scope)?.showPointsInMainUi === true;
		}
		function ComposerPointsGate(props) {
			const { t, position, settingsScope, useProjection } = props;
			const [enabled, setEnabled] = (0, react.useState)(() => composerPointsEnabledOf(settingsScope));
			(0, react.useEffect)(() => settingsScope?.subscribe(() => {
				setEnabled(composerPointsEnabledOf(settingsScope));
			}), [settingsScope]);
			const projection = useProjection === void 0 ? void 0 : useProjection("modelSelection");
			if (!enabled) return null;
			const provider = selectedProviderOf(projection);
			const region = provider === void 0 ? void 0 : TRAE_COMPOSER_PROVIDERS[provider];
			if (region === void 0) return null;
			if (!regionEnabledOf(scopeValueOf(settingsScope), region)) return null;
			if (regionCreditPositionOf(scopeValueOf(settingsScope), region) !== (position ?? "composer")) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComposerPoints, {
				t,
				provider,
				region,
				...settingsScope === void 0 ? {} : { settingsScope },
				...props.onOpenSettings === void 0 ? {} : { onOpenSettings: props.onOpenSettings }
			});
		}
		//#endregion
		//#region src/client/settings-route.ts
		/**
		* The route from the composer credit readout to THIS plugin's settings page.
		*
		* ## The finding this module encodes (m02517)
		*
		* The 4.9.0 line deleted the panel's settings pill on the stated reasoning that
		* "the host exposes no client service that opens the Settings dialog on a given
		* section, so the pill had nowhere to go". That reasoning was WRONG, and the
		* owner said so: clicking through the sidebar DOES open the wide settings on a
		* chosen page. The route exists; it was simply not the one the old module used.
		*
		* The old module (`openBundle` → `layout.selectPanel('plugins')`) targeted the
		* **Plugins** page, which stopped holding this plugin's configuration the moment
		* it moved to its own `settings.section` page. So the previous implementation is
		* not restorable, and a replacement was needed — this is it.
		*
		* ## The route: the settings shell's own store seat
		*
		* `@deepseek-ai/dsh-client-ui-settings-general` registers the `sidebar.settings`
		* slot with a **store seat**, and that seat is the shell's public state handle:
		*
		*     const shellHandle = createSettingsShellStore()
		*     const shellInstance = shellHandle.create()
		*     const shellStore = { ...shellHandle, create: () => shellInstance }
		*     ctx.slots.register({ name: 'sidebar.settings', store: shellStore, … })
		*
		* `createSettingsShellStore().actions` contains exactly the four shell
		* mutations, and `openSection(id)` is the one that answers this button: it sets
		* `activeId = id` AND `open = true`, i.e. "open the Settings dialog on the
		* named section" in a single call. `id` is the same string this plugin already
		* registers the page under (`TRAE_SETTINGS_ID`), so no translation is needed.
		*
		* Note the `create: () => shellInstance` override. A bare handle would mint a
		* FRESH instance per `create()` call — a private copy whose `openSection` moves
		* a dialog nobody renders. The shell pins the seat to its one live instance
		* precisely so a reader of the seat gets the dialog the user actually sees. This
		* module is that reader.
		*
		* ## Why reading the seat is legitimate, and not a private reach-through
		*
		*  - `StoredEntry.store` is a documented public field: "Declared store seat
		*    (instance resolution and lifecycle live with the host machinery)".
		*  - `slots.entries(key)` is a documented public service method, and reading a
		*    seat through it is the pattern the harness's OWN client tests use for this
		*    exact store, e.g. `ui-shortcuts/tests/commands.client.spec.ts`:
		*    `ctx.slots.entries('sidebar.settings')[0].store.create()`.
		*  - No other id-targeted seam exists. `settings.launcher` hands `openSettings`
		*    with no id, `settings.section` receives only `close`, and `openSection` is
		*    otherwise given only to `settings.onboarding` registrants — reaching it
		*    from there would mean registering a fake first-run step, which is far more
		*    intrusive than reading the seat the shell deliberately published.
		*
		* ## Why the probe is at PRESS time
		*
		* The seat belongs to ANOTHER bundle whose apply order is not ours to assume.
		* Probing once during `apply()` would capture `undefined` on a page whose
		* settings bundle applied later, leaving the button dead for the whole session
		* with nothing to re-evaluate it. `entries()` answers `[]` for a slot that is
		* not declared yet, so probing per press is free of state and always current.
		*
		* ## Why `false` rather than an exception
		*
		* The caller is a popover button. There is no supported host line lacking the
		* shell, but "cannot" must not become a thrown error inside a click handler on
		* a user's machine; it becomes a `false` the caller reports, and a button that
		* stays honest about it.
		*/
		/**
		* The `settings.section` id this plugin registers its page under.
		*
		* One spelling, in one place: the page registration, the nav row and
		* `openSection(id)` must agree, or the dialog opens on the shell's fallback
		* (first) section instead of this plugin's — silently, since an unknown id is
		* not an error to the store.
		*/
		const TRAE_SETTINGS_ID = "dsh-connect-trae";
		/** The shipped slot whose store seat is the settings shell's state handle. */
		const SETTINGS_SLOT = "sidebar.settings";
		/**
		* The sidebar's settings trigger: dialog semantics plus an expanded state.
		*
		* Both attributes are load-bearing. `aria-haspopup="dialog"` identifies it as
		* the thing that opens the panel; `aria-expanded` is how route 2 tells an open
		* panel from a closed one WITHOUT clicking, because clicking a trigger that is
		* already expanded CLOSES the dialog — a jump that would read as the settings
		* window flickering shut.
		*/
		const SETTINGS_TRIGGER_SELECTOR = "button[aria-haspopup=\"dialog\"][aria-expanded]";
		/**
		* Budget for "panel mounted + nav row rendered".
		*
		* The panel mounts synchronously on the click, but the nav rows' labels wait
		* for a locale snapshot, so a same-frame query is often one tick too early.
		* Five attempts over ~300ms covers one layout pass while staying under the
		* threshold where a user starts to think the press did nothing.
		*/
		const RETRY_DELAYS_MS = [
			0,
			60,
			70,
			80,
			90
		];
		function defaultSchedule(run, ms) {
			try {
				window.setTimeout(run, ms);
			} catch {
				run();
			}
		}
		/**
		* Find the settings nav row whose label is this plugin's.
		*
		* Trimmed equality, not `includes`: 「dsh-connect-trae」 is a SUBSTRING of
		* nothing here, but 「模型」 is a substring of 「模型与预设」 on a differently
		* worded shell, and a loose match would click the wrong row.
		*/
		function findSectionRow(scope, label) {
			const want = label.trim();
			if (want === "") return void 0;
			return Array.from(scope.querySelectorAll("button")).find((button) => (button.textContent ?? "").trim() === want);
		}
		/**
		* Route 1: open this plugin's section through the shell's store seat.
		*
		* @returns `'opened'` when the dialog is on the right section, `'shell'` when
		*   the dialog opened but is NOT preselected (route 2 can still click the row),
		*   and `undefined` when the seat is absent or unusable.
		*/
		function openThroughStoreSeat(get, sectionId) {
			let slots;
			try {
				slots = get("slots");
			} catch {
				return;
			}
			if (slots === void 0 || typeof slots.entries !== "function") return void 0;
			let seat;
			try {
				seat = slots.entries(SETTINGS_SLOT)[0]?.store;
			} catch {
				return;
			}
			if (seat === null || typeof seat !== "object") return void 0;
			const handle = seat;
			if (typeof handle.create !== "function") return void 0;
			try {
				const instance = handle.create();
				const openSection = instance?.actions?.openSection;
				if (typeof openSection === "function") {
					openSection(sectionId);
					return "opened";
				}
				const open = instance?.actions?.open;
				if (typeof open === "function") {
					open();
					return "shell";
				}
			} catch {}
		}
		/**
		* Open this plugin's settings page — the wide Settings dialog, on THIS
		* plugin's section.
		*
		* ## Two routes, best first (the shape borrowed from dsh-connect-workbuddy 5.20.4)
		*
		* 1. **The shell's store seat** — one call, exact, no timing:
		*    `slots.entries(SETTINGS_SLOT)[0].store.create().actions.openSection(id)`.
		* 2. **Driving the chrome** — click the sidebar's settings trigger, wait for the
		*    panel, then click this plugin's nav row by its label.
		*
		* Route 1 is strictly better where it exists: `openSection(id)` sets `activeId`
		* AND `open` in one action, so there is no window in which the dialog is open
		* on the wrong section, no retry loop, and no dependency on the nav row's
		* localized text. Route 2 is kept because the host range this plugin declares
		* spans shell lines that may predate the seat; deleting it would trade a
		* working fallback for nothing.
		*
		* ## Why both routes are needed even now
		*
		* A seat that carries `open()` but not `openSection()` is a real shell shape
		* (the store gained `openSection` after `open`). Returning `true` on that seat —
		* which 4.9.x did — claimed success while leaving the user on the shell's
		* default section, so the button appeared to do something other than what its
		* label promised. Handing back `'shell'` and continuing to route 2 is what
		* makes the button land on the page it names on EVERY shell.
		*
		* ## Why the probe happens per PRESS, not during `apply`
		*
		* The seat belongs to ANOTHER bundle whose apply order is not ours to assume.
		* Probing once during `apply()` would capture `undefined` on a host whose
		* settings bundle applied later, leaving the button dead for the whole session.
		* `entries()` answers `[]` for an undeclared slot, so a per-press probe is
		* stateless and always current — the same reason the caller passes `softGet`.
		*
		* ## Why it never throws
		*
		* Every path runs from a RENDER path (a click handler in the credits popover).
		* A throw here would take out the whole readout rather than one button, so each
		* stage swallows its own failure and the jump degrades to a silent no-op when
		* the shell has a different shape.
		*
		* @param get - the entry's soft service probe (`ctx.get`), which returns
		*   `undefined` for an absent service instead of throwing. Called HERE, on every
		*   invocation, so a service that appears after `apply` is still found.
		* @param options - label thunk (required for route 2) plus test seams.
		* @returns whether a route was taken. `false` means `onGiveUp` already ran or
		*   there was nothing to fall back to.
		*/
		function openPluginSettingsPage(get, options) {
			const { doc = document, label } = options;
			const schedule = options.schedule ?? defaultSchedule;
			let seatResult;
			try {
				seatResult = openThroughStoreSeat(get, TRAE_SETTINGS_ID);
			} catch {
				seatResult = void 0;
			}
			if (seatResult === "opened") return true;
			try {
				if (doc.querySelector("[data-shortcut-modal=\"settings\"]") === null) {
					const collapsed = Array.from(doc.querySelectorAll(SETTINGS_TRIGGER_SELECTOR)).find((button) => button.getAttribute("aria-expanded") !== "true");
					if (collapsed === void 0) {
						try {
							options.onGiveUp?.();
						} catch {}
						return false;
					}
					collapsed.click();
				}
				let clicked = false;
				let remaining = RETRY_DELAYS_MS.length;
				for (const delay of RETRY_DELAYS_MS) schedule(() => {
					if (clicked) return;
					remaining -= 1;
					try {
						const row = findSectionRow(doc.querySelector("[data-shortcut-modal=\"settings\"]") ?? doc, label());
						if (row !== void 0) {
							clicked = true;
							row.click();
							return;
						}
					} catch {}
					if (remaining === 0) try {
						options.onGiveUp?.();
					} catch {}
				}, delay);
				return true;
			} catch {
				return false;
			}
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* Plugin-card copy registered under the settings.trae locale namespace.
		* Key shape follows `dsh-subagent-default-model`'s `row.*` convention so the
		* two plugins share one external-presentation language.
		*/
		const en = {
			"row.tabCredentialHint": "Domestic and enterprise providers share Trae CN credentials and save account bindings separately.",
			"row.tabFreeQuotaWarn": "Free models can still encounter upstream request limits or busy responses.",
			"row.poolFailoverHint": "Trae also tries another account after server failures. Invalid requests and model permission refusals are reported directly.",
			"row.iconStyleLabel": "Icon style",
			"row.iconStyleHint": "Updates the sidebar and page icons immediately. Saved separately for this plugin in this browser.",
			"row.iconStyleClaude": "Claude style",
			"row.iconStyleOriginal": "Default icon",
			"row.iconStyleSaveFailed": "The browser could not save the icon preference. Please check site storage permissions.",
			"row.poolAutoCheckinDeviceHint": "Trae limits daily rewards per device, so some members may not receive a reward.",
			"row.checkinStatusError": "Could not read today's check-in status: {message}",
			"row.poolAutoCheckinDeviceDone": "Today: this device has reached its daily reward limit.",
			"row.poolAutoCheckinRetry": "Today: {count} accounts checked in. Failed requests will retry automatically.",
			"row.poolAutoCheckinProgress": "Today: {count} accounts checked in.",
			"row.poolAutoCheckinWaiting": "Waiting for the next background check.",
			"row.poolAutoCheckin": "Check in automatically each day",
			"row.poolAutoCheckinHint": "Enable and save to claim daily rewards for selected domestic personal accounts while DSH is running. After a restart, the plugin checks today's progress before processing remaining accounts. Failed attempts retry automatically.",
			"row.title": "Trae credits & models",
			"row.desc": "Use Trae domestic, enterprise and global models in DSH. Manage accounts, select models, view credits and claim daily check-in rewards. Refreshing the model catalog also updates credit multipliers.",
			"row.expand": "Expand",
			"row.collapse": "Collapse",
			"row.tabCn": "Domestic",
			"row.tabEnterprise": "Enterprise",
			"row.tabAi": "Global",
			"row.tabHint": "Domestic, enterprise and global versions can be enabled together. Use the version tabs above to view and manage each version's accounts, credits and models.",
			"row.tabEnterpriseHint": "Enterprise bills the tenant pool of the same Trae CN account instead of the personal one. It never falls back: a refusal is reported as an error rather than quietly spending personal credits.",
			"row.tabSwitchHint": "Uncheck to switch this provider off. Its models disappear from the DSH model picker; your account, credits, and model settings are kept and return when you check it again.",
			"row.tabSwitchAria": "Offer the {region} provider to DSH",
			"row.tabOffNotice": "This provider is switched off. None of its models are offered to DSH. Your account, credits, and model settings are kept. Check the box above the tab to bring it back.",
			"row.panelAria": "Card sections",
			"row.panelAccounts": "Account",
			"row.panelCapabilities": "Capabilities",
			"row.panelCapabilitiesHint": "What the plugin may do on your behalf. These switches take effect on the click — there is no Save button for them.",
			"row.panelModels": "Models",
			"row.panelDiag": "Diagnostics",
			"row.diagRegion": "Region",
			"row.diagProvider": "Provider id",
			"row.diagAccount": "Serving account",
			"row.diagToken": "Sign-in expires",
			"row.diagRefresh": "Re-sign-in deadline",
			"row.diagRefreshNone": "this credential carries none",
			"row.diagCatalog": "Models in the catalog",
			"row.diagEnabled": "Enabled models",
			"row.diagPool": "Account pool",
			"row.diagPoolOn": "on · {count} accounts",
			"row.diagPoolOff": "off",
			"row.diagCheckin": "Daily check-in",
			"row.diagCheckinOn": "supported",
			"row.diagCheckinOff": "not offered here",
			"row.diagRaw": "Raw chat channel",
			"row.diagRawOff": "not checked",
			"row.diagFailures": "Last failure",
			"row.diagNoFailures": "Nothing reported.",
			"row.diagQuarantine": "Quarantined copies",
			"row.diagQuarantineNone": "none",
			"row.diagHint": "These values come from this panel's latest refresh. Remove account identifiers and personal information in local paths before sharing a report.",
			"row.settingsWriteFailed": "The setting was not saved: {message}",
			"row.signedOut": "Not signed in",
			"row.signedOutHint": "Sign in to the Trae desktop app, then click Detect accounts again to save a plugin-owned credential copy.",
			"row.unsupportedRegionTitle": "US region is not supported yet",
			"row.unsupportedRegionHint": "A Trae account on this machine belongs to the United States region (userRegion \"US\" / host *.traeapi.us). This build does not serve that region, so the account is NOT used and no request is sent to the Singapore gateway — signing in again changes nothing. Use a CN or Singapore account (or the Trae CN build) in this panel.",
			"row.diagUnsupportedRegion": "Unsupported region",
			"row.searchedTitle": "Paths checked",
			"row.searchedHint": "No sign-in was found. These locations were probed; if your Trae stores its login elsewhere, please report the path.",
			"row.searchedMore": "Show {count} more",
			"row.quarantineTitle": "Quarantined credential copies",
			"row.quarantineHint": "The plugin could not read a credential copy and renamed the file to preserve it. Inspect that file if you need to recover accounts. Delete it only after confirming that it is no longer needed.",
			"row.quarantineAccounts": "{count} account(s)",
			"row.quarantineAccountsUnknown": "account count unreadable",
			"row.quarantineBytes": "{bytes} bytes",
			"row.reasonMissing": "not found",
			"row.reasonUnreadable": "unreadable",
			"row.reasonInvalid": "unreadable format",
			"row.sourceDesktop": "desktop app",
			"row.sourceCli": "Trae CLI",
			"row.signedIn": "Signed in: {accountName}",
			"row.tokenExpiry": "Access token expires at {expiresAt}; the plugin will attempt to renew it automatically",
			"row.refreshTokenExpiring": "Sign in to Trae again by {expiresAt} ({days} day(s) left) — automatic renewal stops after that.",
			"row.refreshTokenLapsed": "Automatic renewal has stopped: the Trae sign-in expired {expiresAt}. Sign in to Trae again to restore it.",
			"row.requestFailed": "Request failed",
			"row.creditsAvailableLabel": "Available",
			"row.workCreditsLabel": "Work credits",
			"row.generalCreditsLabel": "General credits",
			"row.workNotUsable": "Not usable in DSH",
			"row.generalUsable": "Usable",
			"row.workUsableHint": "Only inside the Trae app",
			"row.generalUsableHint": "Powers DSH chat & tools",
			"row.creditsConsumedLabel": "Consumed",
			"row.creditsTotalLabel": "Total",
			"row.creditsError": "Usage unavailable: {message}",
			"row.checkinReward": "{reward} credits per day",
			"row.checkinClaim": "Check in",
			"row.checkinClaimWith": "Check in +{reward}",
			"row.checkinClaiming": "Claiming…",
			"row.checkinClaimed": "Claimed",
			"row.checkinRefused": "Trae refused the check-in (code {code})",
			"row.checkinBusy": "Trae is busy right now — check-in was not claimed. Please try again in a few minutes.",
			"row.checkinTimeout": "The check-in request did not answer in time. Please try again.",
			"row.checkinError": "Check-in failed: {message}",
			"row.checkinDeviceSpent": "This machine already used today's check-in — Trae allows one per device per day, so this account cannot claim here today. Claim it on another device or from the account that checked in, or come back tomorrow.",
			"row.checkinDisabled": "This account has no check-in activity available.",
			"row.checkinDeviceSpentShort": "Device used",
			"row.subscriptionLabel": "Subscription",
			"row.subscribed": "Active package",
			"row.noPackage": "No active package",
			"row.planTier": "{tier} plan",
			"row.trialUntil": "Trial until {date}",
			"row.payStatusError": "Subscription status unavailable: {message}",
			"row.payStatusUnknown": "Plan not loaded yet",
			"row.refresh": "Refresh",
			"row.refreshTokens": "Refresh accounts & tokens",
			"row.refreshCredits": "Refresh usage",
			"row.refreshing": "Refreshing…",
			"row.accountsTitle": "Trae account",
			"row.accountsHint": "On refresh, the plugin saves copies of detected Trae credentials. Refresh after signing in to a new account, before another sign-in replaces credentials that have not yet been copied.",
			"row.transferTitle": "Export / import accounts",
			"row.transferExport": "Export accounts",
			"row.transferImport": "Import accounts",
			"row.transferCancel": "Cancel",
			"row.transferSelectAll": "Select all",
			"row.transferExportPick": "Choose the accounts to export ({total} available):",
			"row.transferExportConfirm": "Export {count} account(s)",
			"row.transferExported": "Exported {count} account(s) to {fileName}.",
			"row.transferExporting": "Exporting…",
			"row.transferImportPick": "This file holds {total} record(s). Ticked records are added as plugin-owned copies; the Trae app is not touched.",
			"row.transferImportConfirm": "Import {count} account(s)",
			"row.transferImported": "Imported {imported} account copy/copies, skipped {skipped}.",
			"row.transferImporting": "Importing…",
			"row.transferReading": "Reading the file…",
			"row.transferHint": "Export accounts to a JSON file or import accounts from one. The file contains login credentials; restrict access to it. Accounts from other regions are skipped during import.",
			"row.transferError": "Import/export failed: {message}",
			"row.transferVeilHint": "The account list refreshes when this finishes.",
			"row.transferUnnamed": "Unnamed account",
			"row.transferNoToken": "no token in this record",
			"row.accountsRescan": "Detect accounts again",
			"row.accountsScanning": "Detecting…",
			"row.accountsLoading": "Loading your accounts…",
			"row.accountsNone": "This region reports no usable account.",
			"row.accountCurrentBadge": "in use",
			"row.accountSwitch": "Switch",
			"row.accountSwitching": "Switching…",
			"row.accountColumnAccount": "Account",
			"row.accountColumnValue": "Balance",
			"row.accountColumnCheckin": "Check-in",
			"row.accountBalance": "{credits} credits",
			"row.balanceConsoleOnly": "In the enterprise console",
			"row.enterpriseCreditsNotice": "The plugin cannot currently read the tenant balance. Check console.enterprise.trae.cn. Personal credits are omitted here to avoid presenting them as enterprise quota.",
			"row.sourceDsh": "plugin copy",
			"row.modelsTitle": "Models",
			"row.modelsSummary": "{count} enabled",
			"row.modelsRefresh": "Refresh from Trae",
			"row.modelsRefreshing": "Refreshing models…",
			"row.modelsSearch": "Search models",
			"row.modelsSearchPlaceholder": "Search by name or config name",
			"row.modelsSearchCount": "{shown} of {total}",
			"row.modelsSearchEmpty": "No model matches 「{query}」.",
			"row.modelsGroupCount": "{count}",
			"row.modelsViewLabel": "Model scope",
			"row.modelsViewCommon": "Common channels · {count}",
			"row.modelsViewAll": "All · {count}",
			"row.modelsViewCommonHint": "Models offered through solo_work_remote or solo_work_lite.",
			"row.modelsViewAllHint": "Also includes models only offered by a specialist channel: solo_coder, chat_v3, solo_agent_remote.",
			"row.modelsViewShowAll": "Show all",
			"row.modelsSearchOutsideView": "No match for 「{query}」 on the common channels; the full catalog has {count}.",
			"row.modelsEnabledOutsideView": "{count} enabled model(s) are not in this view.",
			"row.modelsChannelWorkRemote": "SOLO workspace · remote",
			"row.modelsChannelWorkLite": "SOLO workspace · default",
			"row.modelsChannelAgentRemote": "SOLO agent · remote",
			"row.modelsChannelChatV3": "Chat · v3",
			"row.modelsChannelCoder": "Code · solo_coder",
			"row.modelsChannelDefault": "No mode announced (calls solo_work_lite)",
			"row.modelsTestEnabled": "Test enabled models",
			"row.modelsTestAll": "Test all models",
			"row.modelsTesting": "Testing {done}/{total}…",
			"row.modelsTestHint": "Send a minimal test request to each enabled model and show its result. Each request is billed at that model's rate.",
			"row.modelsTestAllHint": "Test every model in this panel's catalog, including disabled models. Each request is billed at that model's rate.",
			"row.showPointsInMainUi": "Show credits in the composer row",
			"row.showPointsInMainUiHint": "Show a clickable Trae readout at the selected position, including when another provider's model is selected. Click it to view account details.",
			"row.drawImage": "Let the model draw images (trae_draw_image)",
			"row.drawImageHint": "Adds a trae_draw_image tool to this panel: the model can generate one image when you ask for one, at this account's real credit cost (measured ~8.8 for 1920x1920 on Trae CN). Off by default — while this is unticked the tool does not exist, so the model cannot spend credits on its own.",
			"row.drawImageHintEnterprise": "Not available on the enterprise panel: that path bills through the tenant gateway and has not been verified.",
			"row.drawImageHintAi": "Image generation and billing have not been verified for the global provider, so the tool is unavailable here. Use the domestic panel for image generation.",
			"row.showPointsInMainUiHintAi": "Show the global plan at the selected position, including when a model from another provider is selected.",
			"row.creditPositionLabel": "position",
			"row.creditPositionComposer": "composer toolbar",
			"row.creditPositionStats": "below the input box",
			"row.creditPositionAria": "Credit readout position for {region}",
			"row.creditPositionHint": "The default position is on the model picker row. If another connector occupies the same position, the readout loaded later moves left automatically. Choose below the input box to show it beside the round, step and token statistics.",
			"row.refreshIntervalLabel": "refresh every",
			"row.refreshIntervalOption": "{minutes} min",
			"row.refreshIntervalAria": "Automatic refresh interval",
			"row.refreshIntervalHint": "How often the card and the composer readout re-read usage by themselves, every 5 minutes by default. Each refresh is two read-only upstream requests, so a shorter interval means more traffic; nothing here spends credits. A change takes effect immediately, and turning a panel off stops its reads.",
			"composer.switchTo": "Switch to {account}",
			"composer.noAccounts": "No account in this region",
			"composer.panelTitle": "Trae credits",
			"composer.panelTitleGlobal": "Trae Global plan",
			"composer.account": "Account",
			"composer.generalCredits": "General credits",
			"composer.plan": "Plan",
			"composer.lastRefresh": "Last refreshed",
			"composer.signedOut": "Not signed in",
			"composer.points": "Trae CN",
			"composer.pointsGlobal": "Trae Global",
			"composer.openSettings": "Settings",
			"composer.openSettingsHint": "Open this plugin's settings page",
			"composer.openSettingsFailed": "This host has no route to the plugin settings page",
			"composer.test": "Refresh",
			"composer.testHint": "Refresh every account checked into this panel's pool — probes each one in turn (spends a small amount of credits, can take a minute)",
			"composer.testing": "Refreshing…",
			"composer.testDone": "Pool tested: {ok} of {total} answered",
			"composer.testFailed": "Could not test the pool",
			"composer.testTimedOut": "Testing took too long and was given up on",
			"composer.refreshFailed": "Could not refresh credits",
			"composer.poolPicks": "The account pool is choosing the billing account — switch accounts in the settings page",
			"row.accountsRefreshed": "Accounts refreshed: {count} found{selected}",
			"row.accountsSaved": "bound to",
			"row.accountsKept": "still bound to",
			"row.accountsRefreshedNone": "Accounts refreshed: no usable Trae account found",
			"row.accountsRescanFailed": "Could not refresh accounts: {message}",
			"row.editionCn": "Trae",
			"row.editionSg": "Trae (international)",
			"row.editionSolo": "TRAE SOLO",
			"row.editionSoloSg": "TRAE SOLO (international)",
			"row.creditsExhausted": "The bound account ({account}) has run out of credit",
			"row.creditsAlternative": "Another account on this machine still has credit: {accounts}",
			"row.creditsAlternativeSwitch": "Switch to it",
			"row.expiryWarningSoon": "{total} credit lapses within 24 hours ({packs} packs)",
			"row.expiryWarningDays": "{total} credit lapses within 3 days ({packs} packs)",
			"row.expiryWarningWeek": "{total} credit lapses within 7 days ({packs} packs)",
			"row.expiryWarningLapsed": "{total} credit has already lapsed but is still counted in the balance ({packs} packs)",
			"row.expiryEarliest": "Earliest: {time}",
			"row.settingsDirty": "Unsaved changes",
			"row.modelsTestEmpty": "Enable at least one model first.",
			"row.contextAllMid": "Switch all to 500K",
			"row.contextAllMidHint": "Set the DSH context budget to 500K for models in this panel with a Max window of at least 500K. Other models keep their current values. Click Save to apply.",
			"row.contextAllMax": "Switch all to Max",
			"row.contextAllMaxHint": "Set each model with a Max window to that maximum DSH context budget. Other models keep their current values. Click Save to apply.",
			"row.contextAllDefault": "Restore default context",
			"row.contextAllDefaultHint": "Clear this panel's custom context budgets and use the Trae catalog defaults. Click Save to apply.",
			"row.modelsTestError": "Test failed: {message}",
			"row.modelsTestDone": "{available} of {total} answered.",
			"row.probeAvailable": "works",
			"row.probeGated": "needs a higher plan",
			"row.probeUnsupported": "not served",
			"row.probeRateLimited": "throttled",
			"row.probeAuth": "sign-in rejected",
			"row.probeUnknown": "not determined",
			"row.promoLimited": "Limited {percent}% off",
			"row.promoSubsidy": "{percent}% off",
			"row.promoOffPeak": "Off-peak {percent}% off",
			"row.promoHintRate": "was {before} credits/Mtoken, now {rate}",
			"row.promoHintWindow": "off-peak hours {from}–{until} ({zone})",
			"row.promoHintMember": "subscription price is {rate} credits/Mtoken ({percent}% off)",
			"row.modelEnabled": "Enabled",
			"row.discard": "Discard changes",
			"row.save": "Save",
			"row.saving": "Saving…",
			"row.veilSaving": "Saving changes…",
			"row.modelContext": "Max context {context}",
			"row.contextBudget": "DSH context budget",
			"row.contextBudgetHint": "Affects the DSH-side context budget only. The plugin does not send a window or Max-mode field upstream, so this does not change the window Trae serves the request with.",
			"row.modelOutput": "Output {output}",
			"row.modelImage": "Image",
			"row.modelImageAuto": "Enabled automatically: Trae marks this model multimodal.",
			"row.modelRate": "{rate}x credits",
			"row.modelReasoningSupported": "Reasoning: supported",
			"row.modelReasoningLabel": "Reasoning",
			"row.modelReasoningFollowUpstream": "Default",
			"row.modelReasoningFollowUpstreamNamed": "Default ({effort})",
			"row.modelUnknown": "Unknown",
			"row.modelCapabilityPending": "Image input follows Trae's own multimodal flag, plus anything you tick yourself.",
			"row.poolTitle": "Account pool",
			"row.poolEnabled": "Enable the account pool",
			"row.poolEnabledHint": "When enabled, the plugin selects accounts automatically and tries another account after account rate limits, depleted credits or account failures. When disabled, select the account to use from the account list.",
			"row.poolCurrentHeader": "Billing now: {account}",
			"row.poolModeAuto": "pool picks",
			"row.poolModeManual": "you pick",
			"row.poolMember": "in pool",
			"row.poolNotMember": "Not in pool",
			"row.poolBusyHint": "Running one account at a time…",
			"row.poolTestAll": "Test selected",
			"row.poolTesting": "Testing…",
			"row.poolOffNotice": "The pool is off and requests use the bound account. Enable the switch above and save to let the pool select accounts.",
			"row.poolNoCandidate": "No account in this pool can be used right now.",
			"row.poolNoCandidateEmpty": "No pool members are selected yet.",
			"row.poolNoCandidateEmptyHint": "Select accounts below and save the pool settings to add them to the pool.",
			"row.poolNoCandidateUnusable": "Every selected member is unavailable right now.",
			"row.poolNoCandidateHint": "Requests will try the saved account binding while the pool has no usable member. Member status: ",
			"row.poolServingOutside": "{account} is billing right now but is not in the pool — until a member becomes available, requests fall back to the saved selection.",
			"row.poolMembersTitle": "Accounts in this pool",
			"row.poolRescan": "Re-detect accounts",
			"row.poolToolsLabel": "Export / import accounts",
			"row.poolCreditExpiry": "expires {when}",
			"row.poolProbeMeasured": "measured {when}",
			"row.poolProbeAt": "tested {when}",
			"row.poolSettingsNote": "Preferences below take effect when you save; test results are written by the plugin and are not affected by that button.",
			"row.poolSelectedCount": "Selected {count} / {total}",
			"row.poolNoCopyTag": "no copy here",
			"row.poolCopyFile": "The plugin keeps {count} credential copies in {path}. Refreshing creates copies for newly detected logins and retains existing copies.",
			"row.poolNoCopyTestHint": "The plugin cannot read credentials for this account. Sign in again in Trae and detect accounts, or remove it from the pool.",
			"row.poolSelectAll": "Select all",
			"row.poolSelectNone": "Clear all",
			"row.poolColumnAccount": "Account",
			"row.poolColumnCredits": "Credits",
			"row.poolColumnProbe": "Status",
			"row.poolColumnCheckin": "Check-in",
			"row.poolGeneralLabel": "Credits",
			"row.poolWorkHint": "DSH chat uses the credits balance. Work credits cannot be used for these requests.",
			"row.poolCreditNone": "—",
			"row.poolTestedAt": "Tested {at}",
			"row.poolNeverTested": "Untested",
			"row.poolRetryAt": "Retry after {at}",
			"row.poolRetryUnknown": "retry time unknown",
			"row.poolTargetCurrentPreferred": "Current: {model} (your choice).",
			"row.poolTargetCurrentFree": "Current: {model} (auto-picked free model).",
			"row.poolTargetStale": "The target model you saved is no longer offered: {model}",
			"row.poolTargetStaleOption": "{model} (no longer offered)",
			"row.poolTargetStaleClear": "Switch back to automatic",
			"row.poolTargetNone": "No free model available for this panel",
			"row.poolTargetNoneHint": "Automatic selection uses free models only. Refresh the catalog or select a test model manually. Paid models spend the tested account's credits.",
			"row.poolActionNoteTestNone": "No free model was found in this panel. Select a target model before testing accounts.",
			"row.poolActionNoteNoMembers": "Select accounts to test and save the pool settings.",
			"row.poolTargetAutoOption": "Auto-select a free model",
			"row.poolTargetLabel": "Account test model",
			"row.poolTargetHint": "Batch tests use this model. Auto selects this region's free model with the largest context window. Selecting a paid model spends credits from every account tested.",
			"row.poolProbeSizeLabel": "Test input size",
			"row.poolProbeSizeHint": "Choose an input length close to your conversations. A short test can succeed while a longer request encounters account limits. Longer tests cost more when the model charges for input.",
			"row.poolProbeSizeDefault": "Minimal (default)",
			"row.poolProbeSizeOption": "{wan}0k tokens",
			"row.poolSettingsTitle": "More settings",
			"row.poolMoreRulesTitle": "Account copies & saving rules",
			"row.poolManualAccountLabel": "Account in use",
			"row.poolManualAccountNone": "No account in effect",
			"row.poolDirty": "● Unsaved changes",
			"row.poolSaved": "Save",
			"row.poolSaving": "Saving…",
			"row.poolDiscard": "Discard changes",
			"row.poolSaveFailed": "Save failed: {message}",
			"row.poolGhostMembers": "{count} saved member(s) no longer resolve to a local sign-in: {names}",
			"row.poolUnsavedMembers": "Selection changed. Save to apply.",
			"row.poolRowTest": "Test",
			"row.poolLogTitle": "Activity",
			"row.poolLogClear": "Clear",
			"row.poolLogEmpty": "No pool activity yet.",
			"row.poolLogTestStart": "Testing {count} account(s) against {model}",
			"row.poolLogTestRow": "{accountName}: {outcome}",
			"row.poolLogTestRowMalformed": "{accountName}: the host returned no result for this account",
			"row.poolLogTestDone": "Test finished; the pool was re-ranked",
			"row.poolLogBatchFailed": "Batch operation failed: {message}",
			"row.poolLogTimeout": "The account test timed out and was cancelled. Check the network before retrying. Error: {message}",
			"row.poolSelectAria": "Include {accountName} in this region's account pool",
			"row.poolCheckedIn": "Checked in",
			"row.poolNotCheckedIn": "Not checked in",
			"row.poolCheckinUnknown": "Unknown",
			"row.poolDeviceUsed": "device used",
			"row.poolTestingPerRow": "testing…",
			"row.poolProbeOk": "works",
			"row.poolProbeRateLimited": "rate limited",
			"row.poolProbeModelBusy": "model busy",
			"row.poolProbeOutOfCredit": "out of credit",
			"row.poolProbeCredentialRejected": "sign-in rejected",
			"row.poolProbePolicyRejected": "policy rejected",
			"row.poolProbePlanGated": "needs a higher plan",
			"row.poolProbeUnavailable": "unavailable",
			"row.poolProbeNotFound": "not served",
			"row.poolProbeFailed": "failed",
			"row.poolProbeSourceUnknown": "source unknown",
			"row.poolProbeSourceLive": "hit by a live request",
			"row.poolProbeSourceTest": "tested",
			"row.poolProbeModel": "model {model}",
			"row.poolProbeModelUnknown": "model not recorded",
			"row.poolExcludedUnusable": "unusable",
			"row.poolTokenExpired": "sign-in expired",
			"row.poolExcludedRateLimited": "rate limited",
			"row.poolExcludedModelBusy": "model busy",
			"row.poolExcludedOutOfCredit": "Out of credits",
			"row.poolExcludedCredentialRejected": "sign-in rejected",
			"row.poolExcludedPolicyRejected": "policy rejected",
			"row.poolExcludedPlanGated": "needs a higher plan",
			"row.poolExcludedNotFound": "not served",
			"row.poolExcludedUnavailable": "unavailable",
			"row.poolExcludedFailed": "failed",
			"row.poolAgoNow": "just now",
			"row.poolAgoMin": "{n} min ago",
			"row.poolAgoHour": "{n} h ago",
			"row.poolAgoDay": "{n} d ago",
			"row.poolErrOrigin": "Request origin validation failed; no pool action was executed",
			"row.poolErrUnavailable": "The account pool is not available in this build (or its batch route is missing). Restart the app; if it persists, the plugin needs reinstalling.",
			"row.poolErrMethod": "the pool does not accept that request method",
			"row.poolErrBadRequest": "the pool refused the request",
			"row.poolErrNoMembers": "No accounts are selected for this pool. Select accounts below and save.",
			"row.poolErrNoLiveMembers": "The plugin cannot read valid login credentials for the selected accounts. Sign in to Trae again, or remove these accounts from the pool and save.",
			"row.poolErrCheckinUnsupported": "this panel does not offer a daily check-in",
			"row.poolErrTargetStale": "the saved target model is no longer offered",
			"row.poolErrNoFreeModel": "No free model is available in this region. Refresh the catalog or select a test model manually before retrying.",
			"row.poolErrConflict": "the pool refused the request",
			"row.poolErrGeneric": "pool request failed (HTTP {status})",
			"row.poolSettingsHint": "These are preferences: they take effect when you save (same as the model list). Test results are written automatically and are not affected by this button.",
			"row.poolLogSaved": "Pool settings saved.",
			"row.poolLogSaveFailed": "Could not save the pool settings.",
			"row.poolLogNoMembers": "Nothing to do — no pool members are selected.",
			"row.poolLogDiscarded": "Discarded the unsaved pool changes.",
			"row.poolLogGeneric": "the pool answered nothing usable",
			"row.poolLogRowTesting": "Testing {accountName}…",
			"row.poolLogTargetCleared": "Returned the test target to automatic.",
			"row.poolRowDelete": "Delete",
			"row.poolRowDeleteAria": "Delete {accountName} from this machine: the plugin's copy and its Trae app login (this will sign it out of Trae)",
			"row.poolRowDeleting": "Deleting…",
			"row.poolGhostDeleteAria": "Delete the saved but unreachable account {accountName} from this machine",
			"row.poolRowDeleteError": "Could not delete {accountName}: {message}",
			"row.poolRowDeleteFailed": "the deletion was not confirmed",
			"row.poolRowDeleted": "Deleted the credential copy of {accountName}.",
			"row.poolDeleteStillSigned": "Deleted this plugin's copy of {accountName}, but it is still signed in to Trae, so the account itself is not gone. Sign out inside Trae to remove it from this machine.",
			"row.poolRowDeletedSignedOut": "Deleted {accountName} and signed it out of {apps}.",
			"row.poolRowDeleteAppRunning": "{apps} is running and may overwrite login file changes. Quit those apps completely before deleting {accountName}.",
			"row.poolDeleteAppRunning": "No files were changed because {apps} is running and may overwrite login file changes. Quit those apps completely before deleting the account.",
			"row.poolDeleteNoCopy": "There was no plugin copy of {accountName} left to delete — it only exists as a Trae app login, and that sign-out did not take effect.",
			"row.poolRowDeleteStillSigned": "removed this copy, but {accountName} is still signed in to Trae",
			"row.poolRowDeleteNoCopy": "{accountName} had no plugin copy — only its Trae app login",
			"row.poolDeleteHint": "The plugin keeps its own copy of every local Trae login (a copy is created on refresh unless one already exists) and only ever shows and bills those copies. Delete removes the copy AND signs that account out of Trae itself, leaving a backup of every file it rewrites; a deleted account is not re-imported while it stays signed in Trae. A running Trae would flush its own state back over the file, so quit it first — the card names the app it needs closed.",
			"row.cheer": "Star on GitHub",
			"nav.panel": "Trae",
			"row.pageBack": "Back to conversation",
			"row.sidebarPanelLabel": "Show Trae in the sidebar",
			"row.sidebarPanelHint": "Show the Trae settings entry in the sidebar, disabled by default. Changes take effect immediately; disabling it returns an open settings page to the conversation."
		};
		const zh = {
			"row.tabCredentialHint": "国内版与企业版共用 Trae CN 登录凭据，账号绑定分别保存。",
			"row.tabFreeQuotaWarn": "免费模型也可能遇到上游请求限制或服务繁忙。",
			"row.poolFailoverHint": "Trae 也会在服务端故障时尝试换号；参数错误和模型权限不足会直接显示报错。",
			"row.iconStyleLabel": "图标样式",
			"row.iconStyleHint": "立即更新侧边栏和页面图标，当前浏览器分别保存每个插件的选择。",
			"row.iconStyleClaude": "Claude 风格",
			"row.iconStyleOriginal": "默认图标",
			"row.iconStyleSaveFailed": "浏览器无法保存图标选择，请检查网站存储权限。",
			"row.poolAutoCheckinDeviceHint": "Trae 限制每台设备的每日奖励，部分成员可能无法领取。",
			"row.checkinStatusError": "无法读取今日签到状态：{message}",
			"row.poolAutoCheckinDeviceDone": "今日：本机的每日奖励领取次数已用完。",
			"row.poolAutoCheckinRetry": "今日：{count} 个账号已签，失败的请求将自动重试。",
			"row.poolAutoCheckinProgress": "今日：{count} 个账号已签。",
			"row.poolAutoCheckinWaiting": "等待下一次后台检查。",
			"row.poolAutoCheckin": "每天自动签到",
			"row.poolAutoCheckinHint": "开启并保存后，插件在 DSH 运行期间每天为所选国内版个人账号领取签到奖励。重启后，插件先检查当天的签到进度，再处理尚未签到的账号。失败时自动重试。",
			"row.title": "Trae 积分与模型",
			"row.desc": "在 DSH 中使用 Trae 国内版、企业版和国际版模型。可管理账号、选择模型、查询积分和领取每日签到奖励。刷新模型目录时，插件同时更新积分倍率。",
			"row.expand": "展开",
			"row.collapse": "收起",
			"row.tabCn": "国内版",
			"row.tabEnterprise": "企业版",
			"row.tabAi": "国际版",
			"row.tabHint": "国内版、企业版和国际版可同时启用。切换上方版本页签，可分别查看和管理各版本的账号、积分和模型。",
			"row.tabEnterpriseHint": "企业版请求使用 Trae CN 账号的租户额度，失败时直接显示错误，不会改用个人积分重试。",
			"row.tabSwitchHint": "关闭此开关后，插件会从模型列表中隐藏该区域的模型，并保留账号和设置。再次打开开关即可恢复。",
			"row.tabSwitchAria": "启用{region}模型",
			"row.tabOffNotice": "该区域已关闭，账号和设置已保留。勾选上方开关可恢复模型。",
			"row.panelAria": "卡片分区",
			"row.panelAccounts": "账号",
			"row.panelCapabilities": "能力",
			"row.panelCapabilitiesHint": "插件可以替你做什么。这些开关点一下立即生效 —— 开关没有保存按钮。",
			"row.panelModels": "模型",
			"row.panelDiag": "诊断",
			"row.diagRegion": "区域",
			"row.diagProvider": "供应商 id",
			"row.diagAccount": "当前使用账号",
			"row.diagToken": "登录有效期至",
			"row.diagRefresh": "重新登录最后期限",
			"row.diagRefreshNone": "该凭据不携带",
			"row.diagCatalog": "目录中的模型",
			"row.diagEnabled": "已启用的模型",
			"row.diagPool": "账号池",
			"row.diagPoolOn": "开启 · {count} 个账号",
			"row.diagPoolOff": "关闭",
			"row.diagCheckin": "每日签到",
			"row.diagCheckinOn": "支持",
			"row.diagCheckinOff": "本面板不提供",
			"row.diagRaw": "Raw 会话通道",
			"row.diagRawOff": "未检测",
			"row.diagFailures": "最近一次失败",
			"row.diagNoFailures": "没有报错。",
			"row.diagQuarantine": "损坏副本留存",
			"row.diagQuarantineNone": "无",
			"row.diagHint": "这里显示本面板最近一次刷新得到的状态，可用于问题反馈；分享前请隐去账号标识和本机路径中的个人信息。",
			"row.settingsWriteFailed": "设置未能保存：{message}",
			"row.signedOut": "未登录",
			"row.signedOutHint": "请先登录 Trae 桌面端，再点击「重新检测账号」，将登录凭据保存为插件副本。",
			"row.unsupportedRegionTitle": "美国区（US）暂不支持",
			"row.unsupportedRegionHint": "本机有一个 Trae 账号属于美国区（userRegion \"US\" / 主机 *.traeapi.us）。本版本尚未支持该区，因此不会使用这个账号，也不会把请求发往新加坡网关。重新登录不会改变账号所属区域。请在该面板改用国内版或新加坡区账号（或使用 Trae 国内版客户端）。",
			"row.diagUnsupportedRegion": "未支持的区域",
			"row.searchedTitle": "已检查的路径",
			"row.searchedHint": "未找到登录信息。以下是插件探测过的位置；如果你的 Trae 把登录信息存在别处，请把该路径反馈给我们。",
			"row.searchedMore": "展开其余 {count} 条",
			"row.quarantineTitle": "被隔离的账号副本",
			"row.quarantineHint": "插件无法读取该账号副本，已将文件改名保留。需要恢复账号时请检查该文件；确认不再需要后，可自行删除留存文件。",
			"row.quarantineAccounts": "含 {count} 个账号",
			"row.quarantineAccountsUnknown": "账号数无法读取",
			"row.quarantineBytes": "{bytes} 字节",
			"row.reasonMissing": "文件不存在",
			"row.reasonUnreadable": "无法读取",
			"row.reasonInvalid": "格式无法识别",
			"row.sourceDesktop": "桌面端",
			"row.sourceCli": "Trae CLI",
			"row.signedIn": "已登录：{accountName}",
			"row.tokenExpiry": "访问令牌将于 {expiresAt} 过期，插件会尝试自动续期",
			"row.refreshTokenExpiring": "请在 {expiresAt} 前重新登录一次 Trae（还剩 {days} 天），此后将无法自动续期。",
			"row.refreshTokenLapsed": "自动续期已停止：Trae 登录凭据已于 {expiresAt} 过期。请重新登录一次 Trae 以恢复。",
			"row.requestFailed": "请求失败",
			"row.creditsAvailableLabel": "可用",
			"row.workCreditsLabel": "Work 积分",
			"row.generalCreditsLabel": "通用积分",
			"row.workNotUsable": "DSH 不可用",
			"row.generalUsable": "可用",
			"row.workUsableHint": "仅限 Trae 客户端内使用",
			"row.generalUsableHint": "供 DSH 聊天与工具使用",
			"row.creditsConsumedLabel": "消耗",
			"row.creditsTotalLabel": "合计",
			"row.creditsError": "用量查询失败：{message}",
			"row.checkinReward": "每日 {reward} 积分",
			"row.checkinClaim": "签到",
			"row.checkinClaimWith": "签到 +{reward}",
			"row.checkinClaiming": "领取中…",
			"row.checkinClaimed": "已领取",
			"row.checkinRefused": "Trae 拒绝了本次签到（业务码 {code}）",
			"row.checkinBusy": "Trae 当前签到人数过多，本次未领取成功，请几分钟后再试。",
			"row.checkinTimeout": "签到请求超时，没有收到服务器回复，请再试一次。",
			"row.checkinError": "签到失败：{message}",
			"row.checkinDeviceSpent": "Trae 每台设备每天只能签到一次。本机今日已签到，当前账号今天无法在本机领取。请换一台尚未签到的设备，或明天再试。",
			"row.checkinDisabled": "该账号当前没有可用的签到活动。",
			"row.checkinDeviceSpentShort": "本机已签",
			"row.subscriptionLabel": "订阅状态",
			"row.subscribed": "已有套餐",
			"row.noPackage": "无套餐",
			"row.planTier": "{tier} 套餐",
			"row.trialUntil": "试用至 {date}",
			"row.payStatusError": "订阅状态查询失败：{message}",
			"row.payStatusUnknown": "套餐尚未读到",
			"row.refresh": "刷新",
			"row.refreshTokens": "刷新账号与 Token",
			"row.refreshCredits": "刷新用量",
			"row.refreshing": "正在刷新…",
			"row.accountsTitle": "Trae 账号",
			"row.accountsHint": "插件刷新账号时会为检测到的 Trae 登录保存凭据副本。切换到新账号后请刷新一次，以免下次登录覆盖尚未保存的凭据。",
			"row.transferTitle": "导出 / 导入账号",
			"row.transferExport": "导出账号",
			"row.transferImport": "导入账号",
			"row.transferCancel": "取消",
			"row.transferSelectAll": "全选",
			"row.transferExportPick": "选择要导出的账号（共 {total} 个）：",
			"row.transferExportConfirm": "导出 {count} 个账号",
			"row.transferExported": "已导出 {count} 个账号到 {fileName}。",
			"row.transferExporting": "正在导出…",
			"row.transferImportPick": "文件包含 {total} 条记录，请勾选要导入的账号。插件将保存为自己的凭据副本，不改动 Trae 应用登录。",
			"row.transferImportConfirm": "导入 {count} 个账号",
			"row.transferImported": "已导入 {imported} 个账号副本，跳过 {skipped} 个。",
			"row.transferImporting": "正在导入…",
			"row.transferReading": "正在读取文件…",
			"row.transferHint": "使用 JSON 文件导出账号，或将文件中的账号导入插件。文件包含登录凭据，请限制文件的访问权限。导入时会跳过其他区域的账号。",
			"row.transferError": "导入/导出失败：{message}",
			"row.transferVeilHint": "完成后账号列表会自动刷新。",
			"row.transferUnnamed": "未命名账号",
			"row.transferNoToken": "缺少登录凭据",
			"row.accountsRescan": "重新检测账号",
			"row.accountsScanning": "正在检测…",
			"row.accountsLoading": "正在加载账号…",
			"row.accountsNone": "该区域没有可列出的账号。",
			"row.accountCurrentBadge": "当前使用",
			"row.accountSwitch": "切换",
			"row.accountSwitching": "切换中…",
			"row.accountColumnAccount": "账号",
			"row.accountColumnValue": "额度",
			"row.accountColumnCheckin": "签到",
			"row.accountBalance": "积分 {credits}",
			"row.balanceConsoleOnly": "见企业版控制台",
			"row.enterpriseCreditsNotice": "插件尚不能读取企业租户余额，请到企业版控制台 console.enterprise.trae.cn 查看。此处不显示个人积分，以免将其误认为企业额度。",
			"row.sourceDsh": "插件副本",
			"row.modelsTitle": "模型",
			"row.modelsSummary": "已启用 {count} 个",
			"row.modelsRefresh": "从 Trae 刷新",
			"row.modelsRefreshing": "正在刷新模型…",
			"row.modelsSearch": "搜索模型",
			"row.modelsSearchPlaceholder": "按模型名或 config_name 搜索",
			"row.modelsSearchCount": "{shown} / {total}",
			"row.modelsSearchEmpty": "没有匹配「{query}」的模型。",
			"row.modelsGroupCount": "{count} 个",
			"row.modelsViewLabel": "模型范围",
			"row.modelsViewCommon": "常用通道 · {count}",
			"row.modelsViewAll": "全部 · {count}",
			"row.modelsViewCommonHint": "显示可通过 solo_work_remote 或 solo_work_lite 调用的模型。",
			"row.modelsViewAllHint": "还包含只在专用通道提供的模型：solo_coder、chat_v3、solo_agent_remote。",
			"row.modelsViewShowAll": "查看全部",
			"row.modelsSearchOutsideView": "常用通道内没有匹配「{query}」的模型，全部目录里有 {count} 个。",
			"row.modelsEnabledOutsideView": "另有 {count} 个已启用的模型不在此视图内。",
			"row.modelsChannelWorkRemote": "SOLO 工作区 · 远程",
			"row.modelsChannelWorkLite": "SOLO 工作区 · 默认",
			"row.modelsChannelAgentRemote": "SOLO 智能体 · 远程",
			"row.modelsChannelChatV3": "对话 · v3",
			"row.modelsChannelCoder": "代码 · solo_coder",
			"row.modelsChannelDefault": "未标注模式，使用 solo_work_lite",
			"row.modelsTestEnabled": "测试已启用模型",
			"row.modelsTestAll": "测试所有模型",
			"row.modelsTesting": "测试中 {done}/{total}…",
			"row.modelsTestHint": "向每个已启用模型发送最小测试请求，按模型费率消耗额度，并分别显示结果。",
			"row.modelsTestAllHint": "测试当前目录中的所有模型，包含未启用的模型；每次请求均按对应模型费率计费。",
			"row.showPointsInMainUi": "在输入框工具栏显示积分读数",
			"row.showPointsInMainUiHint": "开启后在所选位置显示可点击读数：国内版为「Trae - CN · 余额」，国际版为「Trae 国际版 · 套餐」。选择其他供应商模型时仍可查看。",
			"row.showPointsInMainUiHintAi": "开启后在所选位置显示国际版套餐，选择其他供应商模型时仍可查看。",
			"row.drawImage": "允许模型自主生图（trae_draw_image）",
			"row.drawImageHint": "开启后提供 trae_draw_image 工具，模型可按你的要求生成图片并消耗当前账号积分。国内版曾测得 1920x1920 图片约 8.8 积分，实际费用以上游扣费为准；默认关闭。",
			"row.drawImageHintEnterprise": "企业版的生图调用与计费尚未验证，因此暂不提供该功能。",
			"row.drawImageHintAi": "国际版的生图调用与计费尚未验证，因此暂不提供该功能；需要生图时请使用国内版面板。",
			"row.creditPositionLabel": "显示位置",
			"row.creditPositionComposer": "输入框工具栏",
			"row.creditPositionStats": "输入框下方",
			"row.creditPositionAria": "{region} 的积分显示位置",
			"row.creditPositionHint": "默认与模型选择同一行显示；遇到其他连接器占用排序位置时，后加载的读数自动向左排列。也可选择「输入框下方」，与轮次、步数和 token 统计同一行显示。",
			"row.refreshIntervalLabel": "自动刷新",
			"row.refreshIntervalOption": "{minutes} 分钟",
			"row.refreshIntervalAria": "自动刷新间隔",
			"row.refreshIntervalHint": "卡片与输入框读数各自多久重新读取一次用量，默认 5 分钟。每次刷新是两次只读的上游请求，间隔越短请求越频繁；这里不消耗积分。改动即时生效；面板关闭后该面板不再自动读取。",
			"composer.switchTo": "切换到 {account}",
			"composer.noAccounts": "该区域暂无账号",
			"composer.panelTitle": "Trae 积分",
			"composer.panelTitleGlobal": "Trae 国际版套餐",
			"composer.account": "账号",
			"composer.generalCredits": "通用积分",
			"composer.plan": "套餐",
			"composer.lastRefresh": "最近刷新",
			"composer.signedOut": "未登录",
			"composer.points": "Trae CN",
			"composer.pointsGlobal": "Trae 国际版",
			"composer.openSettings": "设置",
			"composer.openSettingsHint": "打开本插件的设置页",
			"composer.openSettingsFailed": "这个宿主没有通向插件设置页的入口",
			"composer.test": "刷新",
			"composer.testHint": "刷新本面板账号池里勾选账号的状态——逐个探测（会消耗少量积分，最长约一分钟）",
			"composer.testing": "刷新中…",
			"composer.testDone": "账号池已测：{total} 个里 {ok} 个可用",
			"composer.testFailed": "账号池测速失败",
			"composer.testTimedOut": "测速用时过长，已放弃",
			"composer.refreshFailed": "积分刷新失败",
			"composer.poolPicks": "账号池正在挑选计费账号——手动切换账号请到设置页",
			"row.accountsRefreshed": "已刷新账号：找到 {count} 个账号{selected}",
			"row.accountsSaved": "已绑定",
			"row.accountsKept": "仍绑定",
			"row.accountsRefreshedNone": "已刷新账号：未找到可用的 Trae 账号",
			"row.accountsRescanFailed": "刷新账号失败：{message}",
			"row.editionCn": "Trae",
			"row.editionSg": "Trae 国际版",
			"row.editionSolo": "TRAE SOLO",
			"row.editionSoloSg": "TRAE SOLO 国际版",
			"row.creditsExhausted": "当前绑定账号（{account}）额度已用尽",
			"row.creditsAlternative": "本机还有可用账号：{accounts}",
			"row.creditsAlternativeSwitch": "切换到它",
			"row.expiryWarningSoon": "有 {total} 积分将在 24 小时内过期（{packs} 个套餐）",
			"row.expiryWarningDays": "有 {total} 积分将在 3 天内过期（{packs} 个套餐）",
			"row.expiryWarningWeek": "有 {total} 积分将在 7 天内过期（{packs} 个套餐）",
			"row.expiryWarningLapsed": "有 {total} 积分已过期但仍计入余额（{packs} 个套餐）",
			"row.expiryEarliest": "最早到期：{time}",
			"row.settingsDirty": "有未保存的修改",
			"row.modelsTestEmpty": "请先启用至少一个模型。",
			"row.contextAllMid": "整区切到 500K",
			"row.contextAllMidHint": "将本面板中 Max 窗口不小于 500K 的模型设为 500K 上下文预算，其余模型保持原值；点击「保存」后生效。",
			"row.contextAllMax": "整区切到 Max",
			"row.contextAllMaxHint": "将本面板中提供 Max 窗口的模型设为各自的最大上下文预算，其余模型保持原值；点击「保存」后生效。",
			"row.contextAllDefault": "全部恢复默认上下文",
			"row.contextAllDefaultHint": "清除本面板的自定义上下文预算，恢复使用 Trae 目录默认值；点击「保存」后生效。",
			"row.modelsTestError": "测试失败：{message}",
			"row.modelsTestDone": "{total} 个里有 {available} 个正常应答。",
			"row.probeAvailable": "可用",
			"row.probeGated": "需要更高档位",
			"row.probeUnsupported": "上游不提供",
			"row.probeRateLimited": "被限流",
			"row.probeAuth": "登录凭据被拒",
			"row.probeUnknown": "本次未测出",
			"row.promoLimited": "限时 {zhe} 折",
			"row.promoSubsidy": "{zhe} 折",
			"row.promoOffPeak": "闲时 {zhe} 折",
			"row.promoHintRate": "原价 {before} 积分/百万 token，现价 {rate}",
			"row.promoHintWindow": "闲时时段 {from}–{until}（{zone}）",
			"row.promoHintMember": "会员价 {rate} 积分/百万 token（{zhe} 折）",
			"row.modelEnabled": "启用模型",
			"row.discard": "放弃修改",
			"row.save": "保存",
			"row.saving": "保存中…",
			"row.veilSaving": "正在保存更改…",
			"row.modelContext": "最大上下文 {context}",
			"row.contextBudget": "DSH 上下文预算",
			"row.contextBudgetHint": "设置 DSH 组织请求时使用的上下文预算。插件不向上游发送窗口或 Max 模式参数，因此不会据此切换 Trae 的服务窗口。",
			"row.modelOutput": "最大输出 {output}",
			"row.modelImage": "图片",
			"row.modelImageAuto": "已自动开启：Trae 把该模型标为多模态。",
			"row.modelRate": "积分 {rate}x",
			"row.modelReasoningSupported": "推理：支持",
			"row.modelReasoningLabel": "思考强度",
			"row.modelReasoningFollowUpstream": "默认",
			"row.modelReasoningFollowUpstreamNamed": "默认（{effort}）",
			"row.modelUnknown": "未知",
			"row.modelCapabilityPending": "Trae 标注为多模态的模型会自动启用图片输入，也可手动为其他模型启用。",
			"row.poolTitle": "账号池",
			"row.poolEnabled": "启用账号池",
			"row.poolEnabledHint": "开启后，插件自动选择账号；遇到账号限流、积分耗尽或账号故障时尝试换号。关闭后，请从账号列表中选择要使用的账号。",
			"row.poolCurrentHeader": "当前计费：{account}",
			"row.poolModeAuto": "自动选择",
			"row.poolModeManual": "手动选择",
			"row.poolMember": "已在池中",
			"row.poolNotMember": "未加入",
			"row.poolBusyHint": "插件正在处理所选账号…",
			"row.poolTestAll": "测试勾选的账号",
			"row.poolTesting": "测试中…",
			"row.poolOffNotice": "账号池已关闭，当前请求由绑定账号计费。开启上方开关后，插件按账号池规则选择账号。",
			"row.poolNoCandidate": "账号池里目前没有可用的账号。",
			"row.poolNoCandidateEmpty": "账号池尚未选择成员。",
			"row.poolNoCandidateEmptyHint": "请在下方勾选账号并保存，插件才会将其加入账号池。",
			"row.poolNoCandidateUnusable": "所有已选成员当前均不可用。",
			"row.poolNoCandidateHint": "账号池没有可用成员时，请求会尝试使用已保存的绑定账号。成员当前状态：",
			"row.poolServingOutside": "当前由未加入账号池的 {account} 计费，账号池恢复可用成员前会继续使用已保存的绑定账号。",
			"row.poolMembersTitle": "账号池成员",
			"row.poolRescan": "重新检测账号",
			"row.poolToolsLabel": "导出 / 导入账号",
			"row.poolCreditExpiry": "{when} 过期",
			"row.poolProbeMeasured": "测得 {when}",
			"row.poolProbeAt": "测试于 {when}",
			"row.poolSettingsNote": "修改下方设置后请点击「保存」；测试结果由插件单独保存。",
			"row.poolSelectedCount": "已选 {count} / {total}",
			"row.poolNoCopyTag": "本机无副本",
			"row.poolCopyFile": "当前共有 {count} 份账号副本，保存位置为 {path}。刷新账号时，插件为新登录创建副本，并保留已有副本。",
			"row.poolNoCopyTestHint": "插件无法读取该账号的登录凭据，请在 Trae 中重新登录后检测账号，或将其移出账号池。",
			"row.poolSelectAll": "全选",
			"row.poolSelectNone": "全不选",
			"row.poolColumnAccount": "账号",
			"row.poolColumnCredits": "积分",
			"row.poolColumnProbe": "状态",
			"row.poolColumnCheckin": "签到",
			"row.poolGeneralLabel": "积分",
			"row.poolWorkHint": "DSH 对话使用积分余额，不能使用工作积分。",
			"row.poolCreditNone": "—",
			"row.poolTestedAt": "测试于 {at}",
			"row.poolNeverTested": "未测试",
			"row.poolRetryAt": "{at} 后可重试",
			"row.poolRetryUnknown": "重试时间未知",
			"row.poolTargetCurrentPreferred": "测试模型：{model}（手动选择）",
			"row.poolTargetCurrentFree": "测试模型：{model}（自动选择）",
			"row.poolTargetStale": "你保存的目标模型已不在目录中：{model}",
			"row.poolTargetStaleOption": "{model}（已下架）",
			"row.poolTargetStaleClear": "切回自动",
			"row.poolTargetNone": "本面板暂无可用免费模型",
			"row.poolTargetNoneHint": "自动模式仅选择免费模型，请刷新目录后重试，或手动选择测试模型；选择收费模型时会消耗被测账号积分。",
			"row.poolActionNoteTestNone": "本面板未找到免费模型，请选择目标模型后再测试账号。",
			"row.poolActionNoteNoMembers": "请勾选要测试的账号，并保存账号池设置。",
			"row.poolTargetAutoOption": "自动选择免费模型",
			"row.poolTargetLabel": "账号测试模型",
			"row.poolTargetHint": "批量测试使用此处选择的模型。选择「自动」时，插件使用该区域上下文窗口最大的免费模型；选择收费模型时，测试会消耗各被测账号的积分。",
			"row.poolProbeSizeLabel": "测试输入大小",
			"row.poolProbeSizeHint": "建议选择接近会话请求的输入长度。短请求通过测试后，较长的请求也可能触发账号限制。输入越长，收费模型的测试费用越高。",
			"row.poolProbeSizeDefault": "最小请求（默认）",
			"row.poolProbeSizeOption": "{wan} 万 token",
			"row.poolSettingsTitle": "更多设置",
			"row.poolMoreRulesTitle": "账号副本与保存规则",
			"row.poolManualAccountLabel": "当前账号",
			"row.poolManualAccountNone": "当前没有生效的账号",
			"row.poolDirty": "● 有未保存的修改",
			"row.poolSaved": "保存",
			"row.poolSaving": "保存中…",
			"row.poolDiscard": "放弃修改",
			"row.poolSaveFailed": "保存失败：{message}",
			"row.poolGhostMembers": "无法读取 {count} 个已保存成员的登录凭据：{names}",
			"row.poolUnsavedMembers": "成员选择已修改，保存后生效",
			"row.poolRowTest": "测试",
			"row.poolLogTitle": "活动记录",
			"row.poolLogClear": "清空",
			"row.poolLogEmpty": "暂无账号池活动。",
			"row.poolLogTestStart": "开始测试 {count} 个账号 × {model}",
			"row.poolLogTestRow": "{accountName}：{outcome}",
			"row.poolLogTestRowMalformed": "{accountName}：服务端未返回测试结果",
			"row.poolLogTestDone": "测试完成，已更新可用账号列表",
			"row.poolLogBatchFailed": "批量操作失败：{message}",
			"row.poolLogTimeout": "测试超时后已取消，可以重新操作。请检查网络后重试，错误信息：{message}",
			"row.poolSelectAria": "把 {accountName} 加入本区域的账号池",
			"row.poolCheckedIn": "已签到",
			"row.poolNotCheckedIn": "未签到",
			"row.poolCheckinUnknown": "未知",
			"row.poolDeviceUsed": "本设备今日已用",
			"row.poolTestingPerRow": "测速中…",
			"row.poolProbeOk": "正常",
			"row.poolProbeRateLimited": "被限流",
			"row.poolProbeModelBusy": "模型繁忙",
			"row.poolProbeOutOfCredit": "积分不足",
			"row.poolProbeCredentialRejected": "登录凭据被拒",
			"row.poolProbePolicyRejected": "被策略拒绝",
			"row.poolProbePlanGated": "需要更高套餐",
			"row.poolProbeUnavailable": "不可用",
			"row.poolProbeNotFound": "上游不提供",
			"row.poolProbeFailed": "失败",
			"row.poolProbeSourceUnknown": "来源未知",
			"row.poolProbeSourceLive": "对话请求",
			"row.poolProbeSourceTest": "手动测试",
			"row.poolProbeModel": "模型 {model}",
			"row.poolProbeModelUnknown": "未记录模型",
			"row.poolExcludedUnusable": "不可用",
			"row.poolTokenExpired": "登录已失效",
			"row.poolExcludedRateLimited": "被限流",
			"row.poolExcludedModelBusy": "模型繁忙",
			"row.poolExcludedOutOfCredit": "积分耗尽",
			"row.poolExcludedCredentialRejected": "登录凭据被拒",
			"row.poolExcludedPolicyRejected": "被策略拒绝",
			"row.poolExcludedPlanGated": "需要更高套餐",
			"row.poolExcludedNotFound": "上游不提供",
			"row.poolExcludedUnavailable": "不可用",
			"row.poolExcludedFailed": "失败",
			"row.poolAgoNow": "刚刚",
			"row.poolAgoMin": "{n} 分钟前",
			"row.poolAgoHour": "{n} 小时前",
			"row.poolAgoDay": "{n} 天前",
			"row.poolErrOrigin": "请求来源未通过验证，账号池未执行操作",
			"row.poolErrUnavailable": "账号池接口不可用，请重启 DSH；问题持续时请重新安装插件。",
			"row.poolErrMethod": "账号池不接受该请求方法",
			"row.poolErrBadRequest": "账号池拒绝了该请求",
			"row.poolErrNoMembers": "请先在账号池中勾选账号并保存，再点击签到或测试按钮。",
			"row.poolErrNoLiveMembers": "插件无法读取所选账号的有效登录凭据。请重新登录这些账号，或将它们移出账号池后保存。",
			"row.poolErrCheckinUnsupported": "本面板不提供每日签到",
			"row.poolErrTargetStale": "已保存的目标模型已下架",
			"row.poolErrNoFreeModel": "当前区域没有可用的免费模型，请刷新目录，或手动选择测试模型后再试。",
			"row.poolErrConflict": "账号池拒绝了该请求",
			"row.poolErrGeneric": "账号池请求失败（HTTP {status}）",
			"row.poolSettingsHint": "修改账号池设置后，请点击保存。插件会单独保存测试结果。",
			"row.poolLogSaved": "账号池设置已保存。",
			"row.poolLogSaveFailed": "无法保存账号池设置。",
			"row.poolLogNoMembers": "尚未勾选账号池成员，未执行操作。",
			"row.poolLogDiscarded": "已放弃未保存的账号池修改。",
			"row.poolLogGeneric": "账号池未返回可用的结果",
			"row.poolLogRowTesting": "正在测速 {accountName}…",
			"row.poolLogTargetCleared": "测速目标已改回自动。",
			"row.poolRowDelete": "删除",
			"row.poolRowDeleteAria": "删除 {accountName} 的插件副本，并将该账号从 Trae 应用中退出登录",
			"row.poolRowDeleting": "删除中…",
			"row.poolGhostDeleteAria": "从本机删除已保存但无法登录的账号 {accountName}",
			"row.poolRowDeleteError": "无法删除 {accountName}：{message}",
			"row.poolRowDeleteFailed": "删除未得到确认",
			"row.poolRowDeleted": "已删除 {accountName} 的凭据副本。",
			"row.poolDeleteStillSigned": "插件副本已删除，但 {accountName} 仍登录在 Trae 中；若要移除本机登录，请在 Trae 内退出该账号。",
			"row.poolRowDeletedSignedOut": "已删除 {accountName}，并将它从 {apps} 中退出登录。",
			"row.poolRowDeleteAppRunning": "{apps} 正在运行，可能覆盖登录文件修改；请完全退出这些应用后，再删除 {accountName}。",
			"row.poolDeleteAppRunning": "为避免 {apps} 覆盖登录文件修改，本次未改动任何文件；请完全退出这些应用后再删除。",
			"row.poolDeleteNoCopy": "{accountName} 仅保留在 Trae 的登录状态中，本次退出登录未生效，因此没有删除任何插件副本。",
			"row.poolRowDeleteStillSigned": "已删除副本，但 {accountName} 仍登录在 Trae 中",
			"row.poolRowDeleteNoCopy": "{accountName} 没有插件副本，仅保留在 Trae 应用登录状态中",
			"row.poolDeleteHint": "刷新账号时，插件会为新检测到的 Trae 登录保存副本，并保留已有副本。删除账号会移除副本、将账号从 Trae 退出登录，并为修改过的文件保留备份；操作前需完全退出相关 Trae 应用。如果退出登录未生效，插件会阻止该账号在保持登录期间再次导入。",
			"row.cheer": "鼓励一下",
			"nav.panel": "Trae",
			"row.pageBack": "返回会话",
			"row.sidebarPanelLabel": "在侧边栏显示 Trae",
			"row.sidebarPanelHint": "在侧边栏显示 Trae 设置入口，默认关闭。开关即时生效；关闭时，已打开的设置页会返回对话。"
		};
		//#endregion
		//#region src/client/TraeModelLabel.tsx
		/**
		* The HOST's model picker label: the catalog name, the upstream's activity
		* badge, and EXACTLY ONE multiplier.
		*
		* WHY A SLOT. The picker renders the model name as a plain string, so the only
		* thing a provider can put there is a character — and a character's colour is
		* the emoji font's business, not ours. The host therefore offers exactly one
		* seam for this: the `conversation.input.model.label` slot, whose contract is
		* "render non-interactive inline content such as a coloured name or badge"
		* while the picker keeps owning clicks, focus, check marks and the
		* accessibility text. The shipped example is the official DeepSeek "1017"
		* release badge — a coloured marker next to a model name — which is the same
		* job. (Ported from the sibling `dsh-connect-workbuddy` plugin, which solved
		* the same problem for the same host; the two must stay one presentation.)
		*
		* WHY THE BADGE BELONGS HERE AT ALL. The picker is where the choice is made,
		* and a time-boxed promotion is a choice criterion: "half price at night"
		* changes which row you click. The card already drew these badges, but the card
		* is the settings surface — by the time you read them there you have already
		* picked. This is the same upstream fact, moved to where it can still change a
		* decision.
		*
		* WHY ONE MULTIPLIER AND NOT TWO. `traeModelDisplayName` ALREADY ends the name
		* in the catalog multiplier (`Kimi-K2 · x0.55` — see `src/catalog.ts`), and the
		* host renders that string verbatim. Appending another rate here would print
		* `· x0.55 · x0.55`, which is precisely the defect the sibling plugin shipped
		* and had to fix (its #120 regression). The suffix is therefore pulled back OUT
		* of the name and re-drawn in the span that can carry the DISCOUNTED value, so
		* the row always shows exactly one number and it is the one that holds now.
		*
		* WHY A SEPARATE FETCH. The slot is rendered by the host, outside the plugin's
		* card, so it cannot read the card's React state (nor its injected `t`). It
		* asks the Host itself, over the SAME route the card polls
		* (`TRAE_USAGE_PATH`) — but with `detail=fast` (issue #77), the first-paint
		* document built from LOCAL state: the model roster, its `creditMultiplier` and
		* its unresolved `activityDiscount` are all known locally, so opening the
		* picker must not trigger an upstream read. The answer is cached briefly: a
		* picker that re-fetched on every re-render would be wasteful, and a level a few
		* seconds old is still true.
		*
		* WHY THE CLOCK IS RE-READ ON EVERY RENDER. A promotion's badge is a function
		* of the clock (an off-peak window opens and closes; a campaign expires).
		* Resolving it once at fetch time and holding it would leave "闲时 5 折" on the
		* picker the next morning — the exact overstatement `src/promo.ts` refuses to
		* make. The snapshot is fetched once and the BADGE is resolved at render time;
		* a shared one-minute ticker re-renders the mounted labels, so a window edge is
		* picked up without one timer per model row.
		*
		* WHY THE HOST STILL OWNS THE NAME. The contract says to keep `model.name` as
		* the text and render the addition beside it, so this component returns the name
		* first — it never replaces it. For a provider that is not ours it reproduces
		* the host's own label: the catalog name and, since 0.2.2, that model's optional
		* `badge` (see {@link HostModelBadge}).
		*
		* @module dsh-connect-trae/client/TraeModelLabel
		*/
		/**
		* Every provider id this plugin owns, in panel order.
		*
		* Exported because on a `keyed` host the label seat is one registration PER
		* provider id — the registration side needs the same list the component uses to
		* decide "is this row mine", and a second literal would drift from
		* `providerOfPanel`. Derived rather than typed out: `trae-enterprise` is the id
		* most easily forgotten, and forgetting it means that panel's rows silently fall
		* through to the host's plain fallback.
		*/
		const TRAE_MODEL_LABEL_PROVIDERS = TRAE_PANELS.map(providerOfPanel);
		/** How long a fetched snapshot is trusted, in milliseconds. */
		const CACHE_MS = 6e4;
		/** How often a mounted label re-reads the clock, in milliseconds. */
		const TICK_MS = 6e4;
		/** The snapshot per panel, plus when it was read. */
		const caches = /* @__PURE__ */ new Map();
		/**
		* The snapshot, read from the Host once and reused briefly.
		*
		* `undefined` means "not known" — the caller renders the plain name rather than
		* guessing, because a badge that claims a promotion the upstream never stated
		* is worse than no badge.
		*/
		async function statusNow(panel) {
			const cached = caches.get(panel);
			if (cached !== void 0 && Date.now() - cached.at < CACHE_MS) return cached.snapshot;
			try {
				const response = await fetch(withTraeRegionFastDetail(TRAE_USAGE_PATH, panel), {
					headers: { accept: "application/json" },
					credentials: "same-origin"
				});
				if (!response.ok) return void 0;
				const body = await response.json();
				const models = /* @__PURE__ */ new Map();
				for (const model of body.models ?? []) models.set(model.id, model);
				const snapshot = { models };
				caches.set(panel, {
					snapshot,
					at: Date.now()
				});
				return snapshot;
			} catch {
				return;
			}
		}
		/** One shared minute ticker, so N mounted labels cost one timer, not N. */
		const minuteTicker = {
			timer: void 0,
			listeners: /* @__PURE__ */ new Set()
		};
		/**
		* Re-render the caller once a minute while it is mounted.
		*
		* @param listener - The callback to run at each tick.
		* @returns The unsubscribe function, which stops the shared timer when the last
		*          listener leaves.
		*/
		function subscribeMinute(listener) {
			minuteTicker.listeners.add(listener);
			if (minuteTicker.timer === void 0) {
				minuteTicker.timer = setInterval(() => {
					for (const each of [...minuteTicker.listeners]) each();
				}, TICK_MS);
				minuteTicker.timer.unref?.();
			}
			return () => {
				minuteTicker.listeners.delete(listener);
				if (minuteTicker.listeners.size === 0 && minuteTicker.timer !== void 0) {
					clearInterval(minuteTicker.timer);
					minuteTicker.timer = void 0;
				}
			};
		}
		/**
		* The UI's language, as the browser reports it.
		*
		* The card formats dates and numbers with the browser's locale, so reading the
		* same signal here keeps the badge in the language the user reads. Read
		* defensively: this module is imported by tests that run in a plain Node
		* environment, where neither global exists.
		*/
		function uiLanguage() {
			if (typeof navigator !== "undefined" && typeof navigator.language === "string" && navigator.language !== "") return navigator.language;
			if (typeof document !== "undefined" && typeof document.documentElement?.lang === "string") return document.documentElement.lang;
			return "";
		}
		/** Whether the given language is an English one. */
		function isEnglish(language) {
			return language.toLowerCase().startsWith("en");
		}
		/** The copy table for one language, so the slot needs no injected `t`. */
		function copyFor(language) {
			return isEnglish(language) ? en : zh;
		}
		/**
		* Fill `{name}` placeholders in one locale string.
		*
		* The card's own `t` does this; the slot cannot use `t` (it is rendered by the
		* host, outside the card's injection), so the same substitution is done here on
		* the same table. Both phrasings are always passed: the zh locale spells a pay
		* ratio as "5 折" and needs `{zhe}`, the en one says "50% off" and needs
		* `{percent}` — each uses the placeholder it names, the other is ignored.
		*/
		function fillPlaceholders(template, vars) {
			return template.replace(/\{(\w+)\}/g, (whole, key) => vars[key] ?? whole);
		}
		/** Pay ratio as the "折" figure a Chinese price tag uses: 50 → "5", 25 → "2.5". */
		function promoZhe(discountPercent) {
			const zhe = Math.round(discountPercent * 10) / 100;
			return Number.isInteger(zhe) ? String(zhe) : zhe.toFixed(1);
		}
		/** The locale key that names each promotion kind. */
		const PROMO_LABELS = {
			limited: "row.promoLimited",
			subsidy: "row.promoSubsidy",
			offPeak: "row.promoOffPeak"
		};
		/**
		* The chip's colour per kind, mirroring `.dsm-trae-model-promo-*` in
		* `styles.ts`.
		*
		* Written inline because a slot component is rendered OUTSIDE the card: the
		* card's stylesheet is only mounted while the card is, so a picker opened on a
		* page where the card was never opened would otherwise get an uncoloured chip.
		* The tokens are the same ones the stylesheet uses, with the same fallbacks.
		*/
		const PROMO_TONES = {
			subsidy: {
				color: "var(--dsw-alias-state-error-primary,#d92d20)",
				border: "color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 40%,transparent)",
				background: "color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 10%,transparent)"
			},
			limited: {
				color: "var(--dsw-alias-state-warn-primary,#f59e0b)",
				border: "color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f59e0b) 45%,transparent)",
				background: "color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f59e0b) 12%,transparent)"
			},
			offPeak: {
				color: "var(--dsw-alias-brand-primary,#5686fe)",
				border: "color-mix(in srgb,var(--dsw-alias-brand-primary,#5686fe) 40%,transparent)",
				background: "color-mix(in srgb,var(--dsw-alias-brand-primary,#5686fe) 10%,transparent)"
			}
		};
		/**
		* Split the host's display name into "name" and "the multiplier to show".
		*
		* `traeModelDisplayName` builds `"<name> · x<multiplier>"` and the host renders
		* that string verbatim, so appending another rate next to it would print the
		* figure twice in the picker (`Kimi-K2 · x0.55 · x0.55`). The suffix is
		* therefore pulled back OUT of the string and re-drawn in the span that can
		* carry the discounted value — exactly one number, and it is the one that holds
		* right now.
		*
		* The suffix is recognised by SHAPE, not by comparing against the snapshot's
		* `creditMultiplier`: the two can disagree (a promotion can change the catalog
		* figure between the snapshot and this render), and leaving the suffix in place
		* then prints two numbers again — the very defect this function removes.
		*
		* @param name - The host's rendered name, possibly ending in ` · x<rate>`.
		* @param catalogRate - The catalog multiplier, as the snapshot reports it.
		* @param discounted - The rate to show instead, when a discount is running.
		* @returns The name without its rate suffix, and the single rate to draw.
		*          `undefined` means "draw no number" (the name had none and no discount
		*          is running).
		*/
		function splitCatalogRate(name, catalogRate, discounted) {
			const match = / · x(\d+(?:\.\d+)?)$/.exec(name);
			const fromName = match === null ? void 0 : Number(match[1]);
			return {
				base: match === null ? name : name.slice(0, match.index),
				rate: discounted ?? fromName ?? catalogRate
			};
		}
		/** The rate a live badge says the user pays, when it names one. */
		function discountedRateOf(badge) {
			return badge?.rate;
		}
		/**
		* The upstream's promotion chip, as the picker draws it.
		*
		* Same classes as the card's capsule so the two surfaces cannot drift apart,
		* plus the inline tone described in {@link PROMO_TONES}.
		*
		* @param props - The resolved badge and the copy table for the UI's language.
		* @returns The chip.
		*/
		function PromoChip(props) {
			const { badge, copy } = props;
			const zhe = promoZhe(badge.discountPercent);
			const label = fillPlaceholders(copy[PROMO_LABELS[badge.kind]], {
				zhe,
				percent: String(badge.percentOff)
			});
			const hints = [];
			if (badge.beforeRate !== void 0 && badge.rate !== void 0) hints.push(fillPlaceholders(copy["row.promoHintRate"], {
				before: String(badge.beforeRate),
				rate: String(badge.rate)
			}));
			if (badge.fromClock !== void 0 && badge.untilClock !== void 0 && badge.timeZone !== void 0) hints.push(fillPlaceholders(copy["row.promoHintWindow"], {
				from: badge.fromClock,
				until: badge.untilClock,
				zone: badge.timeZone
			}));
			if (badge.memberDiscountPercent !== void 0 && badge.memberRate !== void 0) hints.push(fillPlaceholders(copy["row.promoHintMember"], {
				rate: String(badge.memberRate),
				zhe: promoZhe(badge.memberDiscountPercent),
				percent: String(100 - badge.memberDiscountPercent)
			}));
			const tone = PROMO_TONES[badge.kind];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `dsm-trae-model-promo dsm-trae-model-promo-${badge.kind} dsm-trae-model-label-promo`,
				title: hints.length === 0 ? label : hints.join(" · "),
				style: {
					flex: "none",
					borderRadius: "999px",
					padding: "1px 7px",
					fontSize: "10px",
					fontWeight: 500,
					lineHeight: "15px",
					whiteSpace: "nowrap",
					border: `1px solid ${tone.border}`,
					color: tone.color,
					background: tone.background,
					maxWidth: "6em",
					overflow: "hidden",
					textOverflow: "ellipsis"
				},
				children: label
			});
		}
		/**
		* The label for one model row in the host's picker.
		*
		* @param props - The host's model identity and the placement of this label.
		* @returns The catalog name, followed by the promotion chip when one holds.
		*/
		/**
		* This plugin's seat in the HOST's model-label cell (issue #74).
		*
		* `conversation.input.model.label` is a `single` slot: `SlotCore.register()`
		* THROWS when a second registration claims the same priority, with
		* "single slot ... already has a registration at priority 0 ... register at a
		* different priority to shadow it (lowest renders)". Priority 0 is the DEFAULT,
		* so it is the one value that is guaranteed to be contested.
		*
		* WHY `-102` AND NOT `-0.25`, WHICH THIS USED TO BE. The old value was picked
		* from a reading of the siblings that was WRONG — and the comment said so with
		* confidence, which is how a wrong reading survives a code review. Re-measured
		* from the three plugins' sources:
		*
		*   dsh-connect-qoder-client     priority -101   (active — lowest renders)
		*   dsh-connect-workbuddy-client priority -100
		*   dsh-connect-trae-client      priority  -0.25  ← never rendered
		*
		* The previous note claimed qoder `-1` and workbuddy `-0.5`, i.e. that `-0.25`
		* sat "between them". Both numbers were stale: the siblings had each moved DOWN
		* a hundred while this file still described the arrangement they had left. The
		* consequence was exactly the report that started this change — "the model
		* picker has no capsule" — because `-0.25` is the HIGHEST of the three, and a
		* `single` slot renders the LOWEST.
		*
		* `-102` is chosen to sit just under qoder, not at some far negative number
		* like `-1000`: this only needs the one seat, and a needlessly extreme value
		* would push any future plugin that picks a reasonable number behind us forever.
		* qoder made the same call when it took `-101` under workbuddy's `-100`.
		*
		* WHAT THIS COSTS. Winning a `single` slot means the losers do not render at
		* all here: qoder's own capsule disappears from the picker the moment this
		* registers. That is the documented trade-off of the slot, not a bug — and it
		* is why {@link TraeModelLabel} must reproduce the host's presentation (catalog
		* name plus the model's own badge) for anything that is not this plugin's
		* model, rather than drawing nothing for foreign rows. A picker whose every row
		* lost its name because a connector won the cell would be a much worse outcome
		* than a lost promotion chip.
		*
		* WHAT WINNING/HOLDING COSTS. This cell is `single`, so the other registrants'
		* decorations on the rows this plugin claims are not composed. That is the
		* documented, accepted trade-off, and it is why the component reproduces the
		* host's own presentation — catalog name plus that model's optional badge — for
		* any provider that is not ours.
		*
		* WHAT CHANGES WHEN THE HOST KEYS THE SLOT — and why the number stays. On a host
		* that declares this slot `keyed`, the seat is registered once per provider id
		* (`./model-label-seat.ts`), each `key` is its own cell, and priority stops
		* deciding WHO IS VISIBLE: qoder's `-101` and workbuddy's `-105` no longer share
		* a cell with this `-102`, so none of the three can shadow another and the
		* armistice below stops being a race. Priority keeps exactly one meaning inside
		* a cell — the tie-breaker between two registrations claiming the SAME provider
		* id, where an equal value throws and the lowest renders. The value is therefore
		* kept as this plugin's rank for its own rows, not as a bid in an auction that
		* no longer happens.
		*
		* WHY A DISTINCT PRIORITY IS NOT ENOUGH ON ITS OWN. It removes the cross-plugin
		* collision, but issue #74's error was a SECOND registration of THIS plugin
		* against its own first one (the report's stack shows
		* "registered by dsh-connect-trae-client" colliding with priority 0). That is
		* the re-entrancy path `inject` allows: the callback runs again whenever the
		* slot's declaration lifetime collapses and re-declares, so a callback that
		* registers unconditionally double-registers. `index.tsx` therefore also
		* disposes its previous entry before every attempt. Priority alone would have
		* made the throw rarer and harder to read, not absent. (On a `keyed` host the
		* same rule applies per key: re-registering one provider's seat twice at one
		* priority throws just as loudly.)
		*/
		const MODEL_LABEL_PRIORITY = -102;
		/** The four tones the host understands, as a lookup for narrowing. */
		const HOST_BADGE_TONE_NAMES = [
			"neutral",
			"info",
			"success",
			"warning"
		];
		/**
		* The tone palette, transcribed from the host's `Tag.module.css` (0.2.2-rc.1).
		*
		* TWO TOKENS ARE EASY TO MISCOPY, AND BOTH WERE: `info` paints
		* `state-business-primary` (not `brand-primary`) and `warning` paints
		* `state-warn-primary` (not `state-warn-secondary`). A near-miss token still
		* "looks blue" or "looks amber", which is why this survived a review — but two
		* capsules on one row are compared directly, so the drift is visible.
		*
		* The fill is the tone's own colour mixed into transparent (10%, or 12% for
		* `warning`), and there is NO border: the host's capsule is a fill only.
		*/
		const HOST_BADGE_TONES = {
			neutral: {
				color: "var(--dsw-alias-label-secondary)",
				background: "var(--dsw-alias-bg-module-platform)"
			},
			info: {
				color: "var(--dsw-alias-state-business-primary)",
				background: "color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent)"
			},
			success: {
				color: "var(--dsw-alias-state-success-primary)",
				background: "color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent)"
			},
			warning: {
				color: "var(--dsw-alias-state-warn-primary)",
				background: "color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent)"
			}
		};
		/** Whether a value is one of the host's four tone literals. */
		function isHostBadgeTone(value) {
			return typeof value === "string" && HOST_BADGE_TONE_NAMES.includes(value);
		}
		/**
		* The one line a badge shows, in the reader's language.
		*
		* `text` is `unknown` because it comes off the wire. A literal is used as-is; a
		* table is looked up exactly the way the host's `resolveText` does it — active
		* language, then its base tag (`pt-BR` → `pt-br` → `pt`), then the required
		* `en`. Anything else (a number, an array, a nested object) is not text, so it
		* reads as absent rather than being stringified into `[object Object]`.
		*
		* A BLANK string is treated as absent, which is deliberately STRICTER than the
		* host: `resolveText` returns `''` untouched (it only fills in missing keys), so
		* `{ en: '' }` paints a real, empty capsule. Refusing that here means a
		* decoration never says nothing — a rule this component adds, not the host's.
		*/
		function resolveHostBadgeText(text) {
			if (typeof text === "string") return text.trim() === "" ? void 0 : text;
			if (typeof text !== "object" || text === null || Array.isArray(text)) return void 0;
			const table = text;
			const language = uiLanguage().toLowerCase();
			const base = language.split("-")[0] ?? "";
			const candidates = [
				table[language],
				base === "" ? void 0 : table[base],
				table["en"]
			];
			for (const candidate of candidates) {
				if (typeof candidate !== "string") continue;
				if (candidate.trim() !== "") return candidate;
			}
		}
		/**
		* Read one provider-authored badge, or `undefined` when there is nothing to say.
		*
		* THE WHOLE POINT IS THAT THIS DOES NOT THROW. `badge` arrives from another
		* plugin's catalog, so its shape is that plugin's business: a `null`, an unknown
		* tone, a missing `text` and a numeric `text` are all things a third party can
		* ship. A throw here does not lose the capsule — it retires THIS COMPONENT from
		* the `single` cell, which strips the name off every row in the picker. The
		* degradation is therefore total: anything unreadable becomes the plain name.
		*/
		function readHostBadge(badge) {
			if (typeof badge !== "object" || badge === null || Array.isArray(badge)) return void 0;
			const label = resolveHostBadgeText(badge.text);
			if (label === void 0) return void 0;
			const tone = badge.tone;
			return {
				tone: isHostBadgeTone(tone) ? tone : "neutral",
				label
			};
		}
		/**
		* One provider-authored selector badge, drawn where the host's own label draws it.
		*
		* Styled INLINE rather than by class, because a slot component renders OUTSIDE
		* the card: the card's stylesheet is only mounted while the card is, so a picker
		* opened on a page that never mounted it would otherwise get an uncoloured
		* capsule. The geometry is the host's `Tag` verbatim — `padding: 1px 8px`,
		* `font-size: 11px`, `line-height: 17px`, `border-radius: 999px`,
		* `corner-shape: round`.
		*
		* NO `max-width` / `text-overflow`, deliberately: the host does not truncate, so
		* truncating here would show "限时免…" at exactly the row width where the host
		* showed the whole thing — less consistent, not more.
		*/
		function HostBadge(props) {
			const tone = HOST_BADGE_TONES[props.badge.tone];
			const style = {
				display: "inline-flex",
				alignItems: "center",
				flex: "none",
				borderRadius: "999px",
				padding: "1px 8px",
				fontSize: "11px",
				lineHeight: "17px",
				fontWeight: 500,
				whiteSpace: "nowrap",
				color: tone.color,
				background: tone.background,
				cornerShape: "round"
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `dsm-trae-model-label-host-badge dsm-trae-model-label-host-badge-${props.badge.tone}`,
				style,
				children: props.badge.label
			});
		}
		function TraeModelLabel(props) {
			const { provider, model } = props;
			const panel = panelOfProvider(provider.id);
			if (panel === void 0) {
				const badge = readHostBadge(model.badge);
				if (badge === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: model.name });
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "dsm-trae-model-label",
					style: {
						display: "inline-flex",
						alignItems: "center",
						gap: "5px",
						whiteSpace: "nowrap",
						verticalAlign: "baseline"
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: model.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HostBadge, { badge })]
				});
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TraeModelLabelInner, {
				modelId: model.id,
				name: model.name,
				panel
			});
		}
		/** The stateful half: fetches the snapshot, then renders what holds right now. */
		function TraeModelLabelInner(props) {
			const { modelId, name, panel } = props;
			const [snapshot, setSnapshot] = (0, react.useState)(void 0);
			const [, setTick] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				let live = true;
				statusNow(panel).then((next) => {
					if (!live || next === void 0) return;
					setSnapshot(next);
				});
				return () => {
					live = false;
				};
			}, [modelId, panel]);
			(0, react.useEffect)(() => subscribeMinute(() => setTick((count) => count + 1)), []);
			const model = snapshot?.models.get(modelId);
			const badge = model === void 0 ? void 0 : selectTraePromoBadge(model.activityDiscount, /* @__PURE__ */ new Date());
			const { base, rate } = splitCatalogRate(name, model?.creditMultiplier, discountedRateOf(badge));
			const copy = copyFor(uiLanguage());
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "dsm-trae-model-label",
				style: {
					display: "inline-flex",
					alignItems: "center",
					gap: "5px",
					whiteSpace: "nowrap",
					verticalAlign: "baseline"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: base }),
					rate === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dsm-trae-model-label-rate",
						children: [" · x", rate.toFixed(2)]
					}),
					badge === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromoChip, {
						badge,
						copy
					})
				]
			});
		}
		//#endregion
		//#region src/client/model-label-seat.ts
		/**
		* Read the declared kind of a slot, or `undefined` when it cannot be read.
		*
		* `spec()` is the documented read-only accessor (`SlotRegistry.spec`), present
		* on 0.1.7 and on 0.2.2. It is also the only way to learn the kind: the
		* declaration lives in the host package, and a plugin's own `SlotMap`
		* augmentation says what this plugin HOPES the slot is, not what the running
		* host declared.
		*
		* Anything unexpected — no `spec` method on an older line, a throw from a
		* service that is not ready, a kind this build does not know — returns
		* `undefined`, and the caller falls back to the single-cell shape. That is the
		* conservative direction: it is what every released version of this plugin
		* already does.
		*
		* @param slots - The `slots` service (typed loosely: the accessor is optional).
		* @param key - The slot key to inspect.
		* @returns The declared kind, or `undefined`.
		*/
		function declaredSlotKind(slots, key) {
			const face = slots;
			if (face === void 0 || typeof face.spec !== "function") return void 0;
			let spec;
			try {
				spec = face.spec(key);
			} catch {
				return;
			}
			const kind = spec?.kind;
			if (kind === "single" || kind === "list" || kind === "keyed" || kind === "chain") return kind;
		}
		/**
		* The registrations this plugin should make for the model-label seat.
		*
		* `keyed` yields ONE seat per provider id: each is its own cell, each renders
		* only the rows whose owner props carry that provider id, and a provider this
		* plugin does not own falls through to the owner's own fallback (the catalog
		* name, plus that model's `badge` on hosts that have one).
		*
		* Every other kind — including `undefined`, i.e. a host that cannot be
		* inspected — yields the single historical seat. That is not a degraded mode:
		* it is what `single` requires, and on a not-yet-declared slot it is what the
		* inject callback is about to find.
		*
		* An empty provider list under `keyed` would silently disable the label, so it
		* falls back to the single seat instead: a wrong-shaped registration that still
		* draws something beats a correct-shaped registration that draws nothing.
		*
		* @param params - Slot key, declared kind, this plugin's provider ids, priority.
		* @returns One or more `register()` option objects, in registration order.
		*/
		function modelLabelSeats(params) {
			const { name, kind, providerIds, priority } = params;
			if (kind === "list" || kind === "chain") return [];
			if (kind === "keyed" && providerIds.length > 0) return providerIds.map((id) => ({
				name,
				key: id,
				priority
			}));
			return [{
				name,
				priority
			}];
		}
		/**
		* Claim every planned seat, atomically, and hand back ONE disposer.
		*
		* WHY ATOMIC. The seat list is 2-3 entries on a `keyed` host, and `register()`
		* can throw on any ONE of them — a rival plugin claiming the same provider id at
		* the same priority, or the declaration collapsing mid-loop. A plain `.map()`
		* would then leave the earlier seats landed on the ledger with their disposers
		* unreachable (they were only ever held by the array that the throw discarded),
		* which is worse than failing outright: the component stays mounted, the caller
		* believes registration failed, and nothing will ever release those cells. On a
		* `single` host it also means the identity keeps a live entry that the next
		* `inject` re-run cannot displace without a priority clash.
		*
		* So a partial failure is rolled back in reverse order before the error is
		* rethrown, exactly as if it had never been attempted. The rethrow is important:
		* each caller already has a catch that logs, and swallowing here would hide the
		* refusal from the diagnostics that exist to explain it.
		*
		* A disposal that itself throws must not mask the original error, hence the
		* inner catch — the registry treats a second dispose as a no-op, and a broken
		* one must not turn one failure into a crash.
		*
		* @param seats - The plan from {@link modelLabelSeats}, in registration order.
		* @param register - Claims one seat and returns its disposer.
		* @returns One disposer that releases every seat, in reverse registration order.
		*/
		function registerModelLabelSeats(seats, register) {
			const claimed = [];
			try {
				for (const seat of seats) claimed.push(register(seat));
			} catch (error) {
				for (const dispose of [...claimed].reverse()) try {
					dispose();
				} catch {}
				throw error;
			}
			return () => {
				for (const dispose of [...claimed].reverse()) try {
					dispose();
				} catch {}
			};
		}
		//#endregion
		//#region src/client/index.tsx
		/** Stable browser-plugin name. */
		const name = "dsh-connect-trae-client";
		/**
		* Client services required by the Plugin configuration contribution.
		*
		* Deliberately only the two services the 0.1.7 line provides unconditionally:
		* `slots` (card injection) and `locale` (copy). The settings surface is probed
		* through `ctx.get()` (which returns undefined, never throws, for an absent
		* service), so the card degrades to read-only rather than failing to load if
		* configForms is not served yet.
		*/
		const inject = ["slots", "locale"];
		const liveSlotEntries = /* @__PURE__ */ new Map();
		/**
		* Release this client's hold on `identity`, if it has one.
		*
		* `entryOnly` exists because of a subtle self-collision: the release is called
		* from INSIDE the `inject` callback as well as from `apply`, and disposing the
		* inject controller from within its own callback would tear down the effect
		* that is currently executing. Inside the callback only the ENTRY is released;
		* from `apply`, both.
		*/
		function releaseSlotEntry(identity, entryOnly = false) {
			const held = liveSlotEntries.get(identity);
			if (held === void 0) return;
			liveSlotEntries.delete(identity);
			if (held.disposeEntry !== void 0) try {
				held.disposeEntry();
			} catch {}
			if (!entryOnly && held.disposeInject !== void 0) try {
				held.disposeInject();
			} catch {}
		}
		/**
		* Register one slot entry, surviving EVERY way the registry can refuse it.
		*
		* WHY THE CATCH IS INSIDE THE CALLBACK, which is the whole point of issue #74.
		* `slots.inject()` does not necessarily run its callback now: when the slot is
		* not declared yet it subscribes and runs the callback LATER. A later throw is
		* re-thrown by the renderer's own `changed()` handler out of a `queueMicrotask`,
		* where no call-site try/catch can reach it — the user gets a renderer error
		* banner on the first paint after a restart, and a reload (which re-declares in
		* a different order) clears it. Moving the catch inside the callback turns every
		* refusal into a log line, matching this file's "degrade, never take the page
		* down" contract.
		*
		* WHY THE RELEASE COMES FIRST. A `single` slot rejects a second live entry at
		* the same priority. That refusal is OUR fault and we can fix it rather than
		* report it, so each run releases whatever this identity already holds.
		*
		* ONE DISPOSER PER CALL, HOWEVER MANY ENTRIES IT OWNS. A `keyed` host makes this
		* plugin claim one cell per provider id (see `./model-label-seat.ts`), and those
		* cells must live and die together — a partial teardown would leave a cell
		* occupied by a component whose siblings are gone, visible as some rows
		* decorated and others not. Folding them into one disposer is
		* `registerModelLabelSeats`'s job, so the contract here stays the simple one:
		* whatever `register` returns is the whole ownership of this identity, and
		* `SlotHold` keeps exactly one.
		*
		* @param ctx - The applying plugin's context (module scope has none).
		* @param identity - Stable key for this seat.
		* @param slotKey - The host slot to register into.
		* @param register - Performs the registration(s), returning ONE disposer for all.
		* @param describe - Names the seat in the failure log.
		*/
		function registerSlotEntry(ctx, identity, slotKey, register, describe) {
			const hold = {};
			const fail = (error) => {
				console.error(`[dsh-connect-trae] ${describe} failed to register (host provider unaffected):`, error);
			};
			const run = () => {
				releaseSlotEntry(identity, true);
				try {
					const disposeEntry = register();
					hold.disposeEntry = disposeEntry;
					const current = liveSlotEntries.get(identity);
					if (current === void 0) liveSlotEntries.set(identity, hold);
					else current.disposeEntry = disposeEntry;
					return disposeEntry;
				} catch (error) {
					fail(error);
					return () => {};
				}
			};
			try {
				const result = ctx.slots.inject(slotKey, () => {
					try {
						return run();
					} catch (error) {
						fail(error);
						return () => {};
					}
				});
				hold.disposeInject = result;
				const current = liveSlotEntries.get(identity);
				if (current === void 0) liveSlotEntries.set(identity, hold);
				else current.disposeInject = result;
			} catch (error) {
				releaseSlotEntry(identity);
				fail(error);
			}
		}
		function apply(ctx) {
			try {
				const namespace = "settings.trae";
				ctx.effect(() => ctx.locale.register(namespace, {
					zh,
					en
				}), "dsh-connect-trae: settings copy");
				const t = ctx.locale.bind(namespace);
				const softGet = (name) => ctx.get(name);
				/**
				* The composer panel's route to this plugin's own settings page.
				*
				* Deliberately a CLOSURE over `softGet` rather than a resolved service: the
				* seam it uses (the settings shell's `sidebar.settings` store seat) belongs
				* to another bundle whose apply order is not ours to assume, so the probe
				* happens on every press and a shell that appears later is still found. See
				* `settings-route.ts` for the finding that established which seam this is.
				*/
				const onOpenSettings = () => openPluginSettingsPage(softGet, { label: () => t("nav.panel") });
				const forms = softGet("configForms");
				/**
				* The card's settings scope, bound to whichever namespace the Host actually
				* serves — resolved from the describe mirror, and RE-BOUND whenever the
				* mirror changes.
				*
				* The mirror answers asynchronously relative to this plugin's `apply()`
				* (and, on a profile reload, may gain namespaces that did not exist at
				* boot — this plugin's entry is exactly such a case). Resolving the
				* namespace ONCE at apply time and falling back to the declared constant
				* is a real failure: the form controller is bound to its namespace forever,
				* so a card whose entry appeared after the mirror's first load writes to
				* `trae` — a namespace the host does not serve — and every write is
				* refused (`No configurable plugin entry "trae"`), while the controls stay
				* enabled (the mirror reports global `writable` even when the namespace is
				* missing).
				*
				* The scope therefore forwards every read/write to the CURRENT controller:
				* once the mirror lists the trae namespace (any name matching `/trae/i`,
				* e.g. `dsh-connect-trae` or `include:dsh-connect-trae`), the card lands on
				* the right namespace and re-renders through its own subscription. Before
				* the mirror answers, the scope reports `writable: false` so the card is
				* read-only rather than offering controls that cannot save.
				*/
				const settingsScope = (() => {
					let current;
					let currentOff;
					let refreshedOnce = false;
					const listeners = /* @__PURE__ */ new Set();
					const notify = () => {
						for (const listener of [...listeners]) listener();
					};
					const scope = {
						getSnapshot: () => current?.getSnapshot() ?? {
							status: "unavailable",
							value: void 0,
							writable: false
						},
						subscribe: (listener) => {
							listeners.add(listener);
							return () => {
								listeners.delete(listener);
							};
						},
						set: (field, value) => current !== void 0 ? current.set(field, value) : Promise.resolve(false)
					};
					const rebind = () => {
						let served;
						try {
							served = (forms?.describe().getSnapshot().view?.namespaces ?? []).find((entry) => entry.ns === "trae" || /trae/i.test(entry.ns));
						} catch {}
						const next = served === void 0 || forms === void 0 ? void 0 : forms.get(served.ns);
						if (next !== current) {
							currentOff?.();
							current = next;
							currentOff = current?.subscribe(notify);
							notify();
						}
						if (next === void 0 && !refreshedOnce) {
							refreshedOnce = true;
							try {
								(forms?.describe()).load?.();
							} catch {}
						}
					};
					rebind();
					forms?.describe().subscribe?.(rebind);
					return scope;
				})();
				/**
				* The configuration card, now drawn as its own `settings.section` page.
				*
				* WHY THE SEAT MOVED. It used to register into the Plugins page's
				* `plugins.bundle.config` / `plugins.row.config` slots, which put the whole
				* configuration inside the plugin's market detail page, below its README.
				* That page's job is to describe and install a package; a page that both
				* advertises and configures makes the user scroll past marketing to reach a
				* checkbox. `settings.section` is the shell's seat for "this plugin owns a
				* settings page", addressed by the same id the nav row uses.
				*
				* WHY `id` AND `order: 30`. The id is this plugin's package name, and it is
				* the SAME string the nav glyph below registers under, because the shell
				* renders `settings.section.icon` filtered by `{ only: section.id }` — an
				* icon whose id does not match never appears and the shell's default glyph
				* silently stays. `order: 30` places this page after the shipped sections
				* (account -10, general 0, models 10, plugins 15, agent-presets 20) and
				* alongside the other third-party pages, without colliding with a built-in.
				*
				* WHY NO CAPABILITY PROBE. `slots.inject()` already IS the probe: it runs
				* the callback now when the slot is declared and subscribes otherwise,
				* doing nothing at all on a host that never declares `settings.section`.
				* Wrapping it in a `typeof` test on some accessor is how a page ends up
				* never registering anywhere, silently — the failure mode this plugin's
				* sibling shipped twice. Let the host answer.
				*
				* The page and its glyph are registered from ONE `inject` callback and both
				* disposers are returned as a pair: the glyph is only meaningful while the
				* page's id exists, so the pairing is structural rather than a convention,
				* and Cordis disposes both with this fiber.
				*/
				const traeSettingsId = TRAE_SETTINGS_ID;
				const registerSettingsPage = () => {
					registerSlotEntry(ctx, "settings.section#dsh-connect-trae", "settings.section", () => {
						const disposers = [];
						try {
							disposers.push(ctx.slots.register({
								name: "settings.section",
								id: traeSettingsId,
								order: 30,
								label: () => t("nav.panel"),
								locale: namespace,
								inject: () => ({
									t,
									settingsScope,
									surface: "section"
								})
							}, TraeUsageCard));
							/**
							* The nav glyph, addressed by the SAME id as the page.
							*
							* The host renders this cell with `{ size, active }` inside its own
							* button and label, so only the picture belongs here. Same shape as
							* the sidebar row's glyph (a brand-mark `<img>`), because it is the
							* same identity in a second place.
							*
							* Its own `inject`: `settings.section.icon` is a SEPARATE slot that a
							* host line may not declare, and the page must still appear when only
							* `settings.section` exists. A missing glyph is the shell's default
							* gear — a degraded look, not a missing page.
							*/
							try {
								disposers.push(ctx.slots.inject("settings.section.icon", () => ctx.slots.register({
									name: "settings.section.icon",
									id: traeSettingsId,
									locale: namespace
								}, SettingsSectionIcon)));
							} catch (error) {
								console.error("[dsh-connect-trae] settings nav icon failed to register (page unaffected):", error);
							}
						} catch (error) {
							for (const dispose of disposers) try {
								dispose();
							} catch {}
							throw error;
						}
						return () => {
							for (const dispose of disposers) try {
								dispose();
							} catch {}
						};
					}, "settings section page");
				};
				registerSettingsPage();
				/**
				* Credit readout in the composer row (`conversation.input.right`, a
				* session-scope list slot rendered immediately before the model picker).
				*
				* Provider-scoped on purpose: it renders only while the session's selected
				* model belongs to this plugin. That is what keeps two connector plugins
				* from competing for one shared row — the sidebar foot, where this line used
				* to live, is a single root row, and the observed result beside
				* dsh-connect-workbuddy's two rows was this plugin's line squeezed down to a
				* clipped "Tr".
				*
				* Registration is unconditional; the gate reads the Host's modelSelection
				* projection and returns null for every other provider, so nothing is drawn
				* and no fetch loop starts while another provider is selected.
				*
				* THE SAME READOUT IS REGISTERED IN TWO SEATS (learned from workbuddy issue
				* #62), and BOTH registrations are unconditional too. Which one actually
				* draws is decided inside the gate by the per-region `creditPosition`
				* setting, so changing the setting is a settings write rather than a slot
				* re-registration — this file's own header records how fragile rebinding a
				* slot is across DSH lines (the rc.6→rc.7 `id`/`order` → `key`/`priority`
				* rename). The composer row is a LIST seat shared with every other bundle,
				* so a third party parking something there can crowd this readout out of
				* existence; the second seat is what keeps one plugin's presence from
				* deciding another's.
				*/
				const registerPointsSlot = (slotName, id, order, position) => {
					registerSlotEntry(ctx, `${slotName}#${id}`, slotName, () => ctx.slots.register({
						name: slotName,
						id,
						order,
						locale: namespace,
						inject: () => ({
							t,
							settingsScope,
							position,
							onOpenSettings
						})
					}, ComposerPointsGate), `points slot "${slotName}"`);
				};
				registerPointsSlot("conversation.input.right", "dsh-connect-trae-composer-points", 4, "composer");
				registerPointsSlot("conversation.composer.dock", "dsh-connect-trae-stats-points", 10, "stats");
				/**
				* The upstream's activity badge in the HOST's model picker (ported from the
				* sibling `dsh-connect-workbuddy` plugin, whose #120 shipped the same fix).
				*
				* The picker renders the model name as a plain string, so a provider can
				* only put a CHARACTER there — and a character's colour is the emoji font's
				* business, not ours. The host therefore offers exactly one seam for this:
				* the `conversation.input.model.label` slot, whose contract is "render
				* non-interactive inline content such as a coloured name or badge" while the
				* picker keeps owning clicks, focus and check marks.
				*
				* HOW MANY SEATS, AND WHY THAT IS READ AT MOUNT. On a `single` host this slot
				* holds ONE cell: a second registration at the same priority throws, a second
				* registration at any other priority is silently discarded, and whoever holds
				* the cell must draw EVERY provider's rows. On a `keyed` host each
				* `options.key` is its own cell, so one seat per provider id gives this
				* plugin exactly its own rows and leaves every other provider to the owner's
				* own fallback. Which shape is legal is the HOST's declaration, so the kind
				* is read from `ctx.slots.spec(...)` at mount and the seat list is derived
				* from it (`./model-label-seat.ts`). One build serves both lines.
				*
				* Registered unconditionally: the component renders the plain name for a
				* provider that is not ours, so there is nothing to gate on. Its own
				* try/catch keeps a host that does not serve this slot from taking the card
				* down with it.
				*/
				const registerModelLabel = () => {
					registerSlotEntry(ctx, "conversation.input.model.label", "conversation.input.model.label", () => {
						const registry = ctx.slots;
						return registerModelLabelSeats(modelLabelSeats({
							name: "conversation.input.model.label",
							kind: declaredSlotKind(ctx.slots, "conversation.input.model.label"),
							providerIds: TRAE_MODEL_LABEL_PROVIDERS,
							priority: MODEL_LABEL_PRIORITY
						}), (seat) => registry.register(seat, TraeModelLabel));
					}, "model label slot");
				};
				registerModelLabel();
				/**
				* The sidebar glyph for the optional panel row.
				*
				* The host renders `sidebar.panellist` registrants with `{ size, active }`
				* inside a `currentColor`-themed glyph cell, so the brand mark is drawn as a
				* small `<img>` — the PNG's own colours read as the plugin's identity, and
				* the row's selection state is the host's to paint around it.
				*/
				function TraePanelIcon(props) {
					const edge = typeof props.size === "number" && props.size > 0 ? props.size : 16;
					return (0, react.createElement)(PluginIcon, {
						className: "dsm-trae-panel-icon",
						size: edge
					});
				}
				/**
				* The nav glyph for the `settings.section` page.
				*
				* A separate component from {@link TraePanelIcon} even though it draws the
				* same picture, because the two slots pass DIFFERENT owner props and a shared
				* component would have to paper over that: `sidebar.panellist` sends
				* `{ size, active }` on a row the shell paints, `settings.section.icon` sends
				* `{ size, active }` inside the shell's own nav button, and the second one
				* also has to survive `size` being absent (the shell always sends it, but a
				* host line that renames the prop must degrade to the default rather than
				* divide by `undefined`).
				*
				* `active` is applied as a slight opacity step instead of a colour: the
				* brand PNG carries its own colours, and recolouring someone else's mark to
				* show selection would misrepresent the product. The shell already paints
				* the selected row.
				*/
				function SettingsSectionIcon(props) {
					const edge = typeof props.size === "number" && props.size > 0 ? props.size : 16;
					return (0, react.createElement)(PluginIcon, {
						className: "dsm-trae-section-icon",
						size: edge,
						style: { opacity: props.active === false ? .75 : 1 }
					});
				}
				/**
				* Back to the conversation, for the page's header.
				*
				* Soft-probed: `layout` is a host service this entry deliberately does not
				* declare in `inject` (an absent service keeps `apply` from running at all,
				* and the page is useful without the back affordance). `selectPanel(null)` is
				* the host's own way of handing the centre column back.
				*/
				const backToConversation = () => {
					const layout = softGet("layout");
					if (layout !== void 0 && typeof layout.selectPanel === "function") layout.selectPanel(null);
				};
				/**
				* The Trae panel in the sidebar (`sidebar.panellist` row + `main` keyed
				* page), mirroring the sibling `dsh-connect-workbuddy` panel and the host's
				* own Plugins row.
				*
				* OPT-IN (`Config.sidebarPanel`, default false). Registering it is NOT the
				* same as showing it: the host's sidebar builds the nav row from the slot's
				* ENTRY METADATA, so a component returning `null` leaves a blank but still
				* clickable button rather than no button. The row therefore has to be
				* registered only while the switch is on, which is what
				* {@link syncPanelRegistration} owns. See `panel-switch.ts` for the store
				* that decision rides on.
				*/
				const PANEL_ID = "dsh-connect-trae";
				const registerPanel = () => {
					registerSlotEntry(ctx, "sidebar.panellist#dsh-connect-trae", "sidebar.panellist", () => ctx.slots.register({
						name: "sidebar.panellist",
						id: PANEL_ID,
						order: 2,
						label: () => t("nav.panel"),
						locale: namespace
					}, TraePanelIcon), "sidebar panel row");
					registerSlotEntry(ctx, `main#${PANEL_ID}`, "main", () => ctx.slots.register({
						name: "main",
						key: PANEL_ID,
						locale: namespace,
						inject: () => ({
							t,
							settingsScope,
							surface: "page",
							backToConversation
						})
					}, TraeUsageCard), "sidebar panel page");
					return [() => {
						releaseSlotEntry("sidebar.panellist#dsh-connect-trae");
					}, () => {
						releaseSlotEntry(`main#${PANEL_ID}`);
					}];
				};
				/**
				* The live panel registrations, kept SEPARATE from the settings slots.
				*
				* They are the only slots in this plugin that come and go while the page is
				* open (the opt-in switch), so owning them apart means flipping the switch
				* does not dispose and re-create the card, the composer readout and the
				* model label — which would be a visible flicker for a change that has
				* nothing to do with them.
				*/
				let panelDisposers = [];
				/**
				* Bring the panel registrations in line with the opt-in switch.
				*
				* Dispose FIRST, then register: a live `key`/`id` cannot be registered
				* twice (the ledger is keyed), and the throw would be swallowed into "no
				* entry at all".
				*/
				const syncPanelRegistration = () => {
					if (panelDisposers.length > 0) {
						const layout = softGet("layout");
						try {
							if (layout?.panelInfo?.getSnapshot?.()?.activePanelId === PANEL_ID) layout.selectPanel?.(null);
						} catch {}
					}
					for (const dispose of panelDisposers) try {
						dispose();
					} catch {}
					panelDisposers = [];
					if (!sidebarPanelWanted()) return;
					panelDisposers = registerPanel();
				};
				/**
				* Follow the switch, and SEED it from the Host.
				*
				* The seed is a status read rather than the settings scope on purpose: this
				* namespace's browser mirror is documented as stale on the affected 0.1.7
				* deployments, and here a stale `false` would mean the row never appears —
				* with no later event to correct it, because the mirror reports namespace
				* edges, not value changes.
				*
				* A failed read is NOT an error to show: OFF is the documented default
				* answer, so a plugin whose status route is unreachable simply gets no row.
				*
				* The SUBSCRIPTION is what makes the switch live: the card calls
				* `setSidebarPanelWanted` after a verified write, so the row appears and
				* disappears without a reload. The host's layout service drops an
				* `activePanelId` whose `main` key has gone, so switching off while the page
				* is open returns the centre column to the conversation on its own.
				*/
				ctx.effect(() => subscribeSidebarPanelWanted(syncPanelRegistration), "dsh-connect-trae: sidebar panel opt-in");
				syncPanelRegistration();
				(async () => {
					try {
						const response = await fetch(withTraeRegion(TRAE_USAGE_PATH, "cn"), { headers: { accept: "application/json" } });
						if (!response.ok) return;
						if ((await response.json()).sidebarPanelEnabled === true) setSidebarPanelWanted(true);
					} catch {}
				})();
			} catch (error) {
				console.error("[dsh-connect-trae] client card failed to load (host provider unaffected):", error);
			}
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
