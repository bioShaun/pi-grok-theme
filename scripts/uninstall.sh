#!/usr/bin/env bash

set -euo pipefail

THEMES_DIR="${HOME}/.pi/agent/themes"
EXTENSIONS_DIR="${HOME}/.pi/agent/extensions"

echo "==> Uninstalling Pi Grok Build suite..."

# 1. Remove Themes
for theme in grok-build grok-build-coding; do
  dst="${THEMES_DIR}/${theme}.json"
  if [[ -f "${dst}" ]]; then
    rm -f "${dst}"
    echo "  [theme] removed: ${dst}"
  else
    echo "  [theme] not found: ${dst}"
  fi
done

# 2. Remove Extension
ext_dst="${EXTENSIONS_DIR}/pi-grok-build"
if [[ -d "${ext_dst}" || -L "${ext_dst}" ]]; then
  rm -rf "${ext_dst}"
  echo "  [extension] removed: ${ext_dst}"
else
  echo "  [extension] not found: ${ext_dst}"
fi

echo "✓ Pi Grok Build suite uninstalled."
