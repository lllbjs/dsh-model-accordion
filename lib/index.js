/**
 * dsh-model-accordion — host half.
 *
 * Everything this plugin does lives in the browser: the client bundle
 * decorates the composer's model menu and registers the unified connector
 * settings card (a `plugins.item` slot). The host half is intentionally a
 * no-op — it only exists so the Loader mounts a row for the package.
 *
 * It deliberately does NOT import any bare npm package (e.g.
 * "@deepseek-ai/schemastery") or export a `Config`. The profile resolves this
 * package through a symlink whose realpath sits outside the profile's
 * node_modules tree, and Node's ESM resolver would fail to find a bare import
 * from that realpath. The settings card is driven purely by the
 * `plugins.item` slot registration, so no host Config is required.
 */

/** Stable package name, mirrored by the client bundle's loader id. */
export const name = "dsh-model-accordion";

/** No host services are required. */
export const inject = [];

/**
 * Mount the row. Nothing to do on the host side.
 * @param ctx - the plugin context.
 */
export function apply(ctx) {
	ctx.logger?.debug?.("dsh-model-accordion: host half loaded");
}
