#!/bin/sh
# Install dsh-model-accordion into a DSH profile.
#
#   ./install.sh [profile]     (default: $DSH_PROFILE, else "desktop")
#
# The desktop profile is owned by the Electron app, so `dsh plugin add` refuses;
# this script links the package into the profile and appends the patch entry.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
profile="${1:-${DSH_PROFILE:-desktop}}"
home="${DSH_HOME:-$HOME/.dsh}"
dir="$home/profiles/$profile"

[ -d "$dir" ] || { echo "no such profile: $dir" >&2; exit 1; }

mkdir -p "$dir/node_modules"
link="$dir/node_modules/dsh-model-accordion"
if [ -L "$link" ]; then rm "$link"; elif [ -e "$link" ]; then
  echo "$link already exists and is not a symlink; remove it first" >&2; exit 1
fi
ln -s "$here" "$link"
echo "linked $link -> $here"

patch="$dir/cordis.patch.yml"
if [ -f "$patch" ] && grep -q "dsh-model-accordion" "$patch"; then
  echo "patch already mentions dsh-model-accordion; nothing to do"
else
  cp "$patch" "$patch.bak-model-accordion" 2>/dev/null || true
  cat >> "$patch" <<'YAML'
- insert:
    - id: dsh-model-accordion
      name: dsh-model-accordion
YAML
  echo "appended the plugin entry to $patch"
fi

echo
echo "Restart DSH (or reload the web GUI) to pick up the plugin."
