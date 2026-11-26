#!/bin/sh
# Install dsh-model-accordion into a DSH profile — self-contained (0.8.0+).
#
#   ./install.sh [profile]     (default: $DSH_PROFILE, else "desktop")
#
# The desktop profile is owned by the Electron app, so `dsh plugin add` refuses;
# this script links the package into the profile and wires the patch entries.
#
# Since 0.8.0 the three connector hosts (WorkBuddy / Trae / OpenCode) are
# vendored inside this package. The script therefore also:
#   * creates a small node_modules shim so the vendored hosts' bare imports
#     (schemastery, pi-ai, dsh-llm, undici, ...) resolve from the workspace real
#     path — these all come from DSH's own install / profile node_modules, so they
#     survive `pnpm remove` of the original connector npm packages;
#   * inserts three loader rows pointing at the vendored host entry files, plus
#     the accordion's own row, into cordis.patch.yml;
#   * removes the standalone connector bundles from dsh.profile.bundles so
#     the client graph does not see the same package name from two sources
#     (their dependencies stay, so the GUI still lists them as uninstallable).
#
# Idempotent: safe to run again. A FULL app quit/reopen is required afterwards
# (the profile's package.json / linked roots changed — a GUI reload is not enough).
set -eu

here=$(cd "$(dirname "$0")" && pwd)
profile="${1:-${DSH_PROFILE:-desktop}}"
home="${DSH_HOME:-$HOME/.dsh}"
dir="$home/profiles/$profile"

[ -d "$dir" ] || { echo "no such profile: $dir" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "node is required (DSH runs on Node >= 22)" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Link this package into the profile so the vendored file: URLs resolve.
# ---------------------------------------------------------------------------
mkdir -p "$dir/node_modules"
link="$dir/node_modules/dsh-model-accordion"
if [ -L "$link" ]; then rm "$link"; elif [ -e "$link" ]; then
  echo "$link already exists and is not a symlink; remove it first" >&2; exit 1
fi
ln -s "$here" "$link"
echo "linked $link -> $here"

# ---------------------------------------------------------------------------
# 2. Build the workspace node_modules shim for the vendored hosts' bare imports.
#    Targets are DSH-owned dependency trees, never the connector packages, so
#    uninstalling the original plugins cannot remove them.
# ---------------------------------------------------------------------------
stable_root="$(dirname "$dir")/node_modules"          # ~/.dsh/profiles/node_modules (global-backed)
[ -d "$stable_root/@deepseek-ai/dsh-llm" ] || stable_root="$dir/node_modules"

# schemastery >= 3.18.4 is required (opencode's Config uses .volatile()); prefer
# the copy vendored with workbuddy (3.19.0), else the desktop profile's own copy.
sc="$here/vendored/workbuddy/node_modules/@deepseek-ai/schemastery"
ck="$here/vendored/workbuddy/node_modules/@deepseek-ai/cosmokit"
[ -d "$sc" ] || sc="$dir/node_modules/@deepseek-ai/schemastery"
[ -d "$ck" ] || ck="$dir/node_modules/@deepseek-ai/cosmokit"

link_dep() {
  spec="$1"; target="$2"; l="$here/node_modules/$spec"
  mkdir -p "$(dirname "$l")"
  if [ ! -e "$target" ] && [ ! -L "$target" ]; then
    echo "warning: dependency $target not found; skipping $spec shim" >&2; return 0
  fi
  if [ -L "$l" ]; then rm "$l"; elif [ -e "$l" ]; then
    echo "warning: $l exists and is not a symlink; leaving it" >&2; return 0
  fi
  ln -s "$target" "$l"
}

link_dep "@deepseek-ai/schemastery"       "$sc"
link_dep "@deepseek-ai/cosmokit"          "$ck"
for spec in \
  "@deepseek-ai/dsh-llm" "@deepseek-ai/dsh-llm-pi-ai" \
  "@deepseek-ai/dsh-atomic-write" "@deepseek-ai/dsh-home-paths" \
  "@earendil-works/pi-ai" "undici" "yaml"; do
  link_dep "$spec" "$stable_root/$spec"
done
echo "prepared the vendored hosts' dependency shim in $here/node_modules"

# ---------------------------------------------------------------------------
# 3. Wire cordis.patch.yml + dsh.profile.bundles (done in Node for safe
#    JSON/text editing). Env vars carry the paths into the helper.
# ---------------------------------------------------------------------------
tmp=$(mktemp "${TMPDIR:-/tmp}/dsh-model-accordion-wire.$$.XXXXXX.mjs")
cat > "$tmp" <<'NODE'
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const here = process.env.DSH_PLUGIN_DIR;
const profileDir = process.env.DSH_PROFILE_DIR;
const patchPath = join(profileDir, "cordis.patch.yml");
const manifestPath = join(profileDir, "package.json");
const MARKER = "# >>> dsh-model-accordion self-contained connectors";

// 3a. Stop the standalone connector *bundles* from also declaring their
//     bare-name rows (same package name from two sources -> client-modules throws).
//     `dsh-opencode-go` is included too: since 0.9.2 its host is vendored here,
//     so the npm bundle is no longer needed and may be uninstalled in the GUI.
//     The set must cover every connector the user may have installed through the
//     GUI, not just the ones present the first time this ran: a later
//     `dsh-connect-trae` install would otherwise collide with the vendored
//     `dsh-connect-trae` row below (duplicate entry id -> boot failure).
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const bundles = manifest?.dsh?.profile?.bundles;
  if (Array.isArray(bundles)) {
    const drop = new Set([
      "dsh-connect-workbuddy",
      "dsh-connect-trae",
      "@opencode2dsh/dsh-plugin",
      "dsh-opencode-go",
    ]);
    const next = bundles.filter((n) => !drop.has(n));
    if (next.length !== bundles.length) {
      manifest.dsh.profile.bundles = next;
      copyFileSync(manifestPath, manifestPath + ".bak-model-accordion");
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
      console.log("removed the standalone connector bundles from dsh.profile.bundles");
    }
  }
}

// 3b. Insert the self-contained loader rows at the TOP of the patch, i.e. after
//     the leading comment block and BEFORE any `- id:` config-override rows —
//     applyEntryPatches resolves overrides against entries already in its map,
//     so the saved workbuddy/trae config must come after our insert rows.
let text = existsSync(patchPath) ? readFileSync(patchPath, "utf8") : "[]\n";
if (!text.includes(MARKER)) {
  if (existsSync(patchPath)) copyFileSync(patchPath, patchPath + ".bak-model-accordion");

  // Upgrade leftovers from 0.7.0: a `name:` on a config-override row would make
  // applyEntryPatches skip that row (name no longer matches the file: URL), and
  // `disabled: true` rows would switch our new entries off. Drop both.
  text = text.replace(/^[ \t]*name:[ \t]*(dsh-connect-workbuddy|dsh-connect-trae)[ \t]*\r?\n/gm, "");
  text = text.replace(/^- id: dsh-connect-trae\r?\n[ \t]+disabled: true\r?\n?/gm, "");

  const f = (k) => "file://" + join(here, "vendored", k, "lib", "index.js");
  // A 0.7.0 install already has its own accordion `- insert:` row further down;
  // only add one here for a fresh install, so the two never duplicate the id.
  const hasAccordion = /^[ \t]*- id: dsh-model-accordion\b/m.test(text);
  const block = [
    MARKER + ". The three connector hosts are vendored inside",
    "# dsh-model-accordion, so models, login state and settings keep working",
    "# after the original npm packages are uninstalled. Entry ids are unchanged:",
    "# they are the settings namespace, the /plugins/<id>/... route prefix and",
    "# the key for saved config (accounts / regions / lastCatalog / enabledModelIds).",
    "- insert:",
    ...(hasAccordion ? [] : [
      "    - id: dsh-model-accordion",
      "      name: dsh-model-accordion",
    ]),
    "    - id: dsh-connect-workbuddy",
    "      name: " + f("workbuddy"),
    "    - id: dsh-connect-trae",
    "      name: " + f("trae"),
    "    - id: opencode2dsh",
    "      name: " + f("opencode"),
    "",
  ].join("\n");

  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && (lines[i].startsWith("#") || lines[i].trim() === "" || lines[i].trim() === "[]")) i++;
  const head = lines.slice(0, i).filter((l) => l.trim() !== "[]").join("\n").replace(/\s+$/, "");
  const rest = lines.slice(i).join("\n");
  const out = (head ? head + "\n" : "") + block + (rest ? rest : "[]\n");
  writeFileSync(patchPath, out);
  console.log("wired the self-contained connector rows into " + patchPath);
} else {
  console.log("patch already carries the self-contained connector rows; nothing to do");
}

// 3b-2. Migration (0.11.0): remove any Qoder host row left in an existing patch.
//       Qoder is no longer vendored here; a stale `file:` row would point at a
//       deleted path and fail to load. Runs unconditionally so an old install
//       (where MARKER already exists) is repaired too. Idempotent.
{
  const p = existsSync(patchPath) ? readFileSync(patchPath, "utf8") : "[]\n";
  const lines = p.split("\n");
  const out = [];
  let removed = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // Top-level config-override row: `- id: dsh-connect-qoder` plus its indented body.
    if (/^-\s*id:\s*dsh-connect-qoder\s*$/.test(l)) {
      removed++;
      while (i + 1 < lines.length && /^[ \t]/.test(lines[i + 1]) && lines[i + 1].trim() !== "") i++;
      continue;
    }
    // Nested insert row inside our `- insert:` block: 4-space `- id:` + its `name:`.
    if (/^[ \t]{4}-\s*id:\s*dsh-connect-qoder\s*$/.test(l)) {
      removed++;
      if (i + 1 < lines.length && /^[ \t]{6}name:/.test(lines[i + 1])) i++;
      continue;
    }
    out.push(l);
  }
  if (removed > 0) {
    writeFileSync(patchPath, out.join("\n"));
    console.log("removed " + removed + " stale Qoder host row(s) from " + patchPath);
  }
}

// 3c. Vendor `dsh-opencode-go` (since 0.9.2).
//     The npm bundle exposes its host under entry id `opencode-go`, whose
//     settings namespace (`PROFILE_ENTRY_ID`) and credential refs live in the
//     profile. We keep that id so saved appkeys stay readable, but point the
//     entry at our vendored copy via a file: URL. That makes the GUI work after
//     the standalone `dsh-opencode-go` package is uninstalled.
//
//     The npm installer writes a *config-override* row (`- id: opencode-go`
//     with `name: dsh-opencode-go`) further down the patch. We convert that row
//     into an `- insert:` carrying our file: URL, preserving its `config` block
//     byte-for-byte (only re-indented). Idempotent: skip when already converted.
{
  const OG_MARKER = "# >>> vendored opencode-go host (dsh-model-accordion)";
  const ogUrl = "file://" + join(here, "vendored", "opencode-go", "lib", "index.js");
  let patch = existsSync(patchPath) ? readFileSync(patchPath, "utf8") : "[]\n";

  // Already converted? (either by us, or a fresh insert row we add below)
  const alreadyVendored = patch.includes(ogUrl);

  if (!alreadyVendored) {
    if (existsSync(patchPath)) copyFileSync(patchPath, patchPath + ".bak-opencode-go");

    // Find the override row by line, then consume every following indented
    // line until the next TOP-LEVEL `- ` row (column 0) or EOF. A line-based
    // scan is used deliberately: a regex lookahead stops at nested
    // `accounts: - id:` lines or an earlier `- insert:` row and leaves half
    // the config behind, which breaks YAML parsing.
    const lines = patch.split("\n");
    const start = lines.findIndex((l) => /^-\s*id:\s*opencode-go\s*$/.test(l));
    const converted = start >= 0;
    let config = "";
    if (start >= 0) {
      let end = start + 1;
      while (end < lines.length) {
        const l = lines[end];
        if (l.trim() !== "" && /^-\s/.test(l)) break;  // next top-level row
        end++;
      }
      const body = lines.slice(start + 1, end)
        .filter((l) => !/^\s*name:\s*dsh-opencode-go\s*$/.test(l))
        .join("\n");
      // The override row's children sit at 2 spaces; under an insert item
      // (`    - id:`) that level must be 6, so add 4 to every non-empty line.
      config = body.split("\n").map((line) => {
        if (line.trim() === "") return "";
        const m2 = /^([ \t]*)(.*)$/.exec(line);
        return "    " + (m2 ? m2[1] + m2[2] : line);
      }).join("\n").replace(/\s+$/, "");
      lines.splice(start, end - start);
      patch = lines.join("\n");
    }

    const block = [
      OG_MARKER,
      "- insert:",
      "    - id: opencode-go",
      "      name: " + ogUrl,
      ...(config ? [config] : []),
      "",
    ].join("\n");
    // Append at the end: insert rows can appear anywhere after the leading
    // bundle layers; config overrides for OTHER entries are unaffected.
    patch = patch.replace(/\s*$/, "") + "\n" + block;
    writeFileSync(patchPath, patch);
    console.log("vendored the opencode-go host into " + patchPath +
      (converted ? " (converted the npm override row)" : " (fresh insert)"));
  } else {
    console.log("opencode-go host already points at the vendored copy");
  }
}
NODE
DSH_PLUGIN_DIR="$here" DSH_PROFILE_DIR="$dir" node "$tmp"
rm -f "$tmp"

echo
echo "Done. You MUST fully quit and reopen DeepSeek Harness now (a web GUI reload"
echo "is NOT enough): profile package.json / linked roots changed at startup."
echo "After restart:\n  * the model-menu accordion (favorites / sorting / search / refresh) works;"
echo "  * WorkBuddy / Trae / OpenCode models, login and settings work even"
echo "    after you uninstall the original connector plugins in the GUI."
