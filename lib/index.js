/**
 * dsh-model-accordion — host half.
 *
 * The feature lives entirely in the browser: the client bundle decorates the
 * composer's model menu so every provider group collapses to a single label.
 * This half exists only so the Loader mounts a row for the package; the
 * client-modules service discovers the browser bundle from `dsh.client`.
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
