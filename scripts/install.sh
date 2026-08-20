#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1
  pwd -P
)"
REPO_DIR="${SCRIPT_DIR}/.."

THEMES_DIR="${HOME}/.pi/agent/themes"
EXTENSIONS_DIR="${HOME}/.pi/agent/extensions"

FORCE=0
INSTALL_EXTENSION=1
INSTALL_THEMES=1

for arg in "$@"; do
  case "$arg" in
    --force|-f)
      FORCE=1
      ;;
    --themes-only)
      INSTALL_EXTENSION=0
      ;;
    --extension-only)
      INSTALL_THEMES=0
      ;;
    --help|-h)
      cat <<'EOF'
Usage: ./scripts/install.sh [options]

Options:
  -f, --force          Overwrite existing theme and extension files
  --themes-only        Install only the JSON themes
  --extension-only     Install only the UI extension
  -h, --help           Show this help message
EOF
      exit 0
      ;;
  esac
done

echo "==> Installing Pi Grok Build suite..."

# 1. Install Themes
if [[ ${INSTALL_THEMES} -eq 1 ]]; then
  mkdir -p "${THEMES_DIR}"
  for theme in grok-build grok-build-coding; do
    src="${REPO_DIR}/themes/${theme}.json"
    dst="${THEMES_DIR}/${theme}.json"

    if [[ -e "${dst}" && ${FORCE} -eq 0 ]]; then
      echo "  [theme] skip: ${dst} already exists (use --force to overwrite)"
    else
      cp "${src}" "${dst}"
      echo "  [theme] installed: ${dst}"
    fi
  done
fi

# 2. Install Extension
if [[ ${INSTALL_EXTENSION} -eq 1 ]]; then
  mkdir -p "${EXTENSIONS_DIR}"
  ext_dst="${EXTENSIONS_DIR}/pi-grok-build"

  if [[ -e "${ext_dst}" && ${FORCE} -eq 0 ]]; then
    echo "  [extension] skip: ${ext_dst} already exists (use --force to overwrite)"
  else
    rm -rf "${ext_dst}"
    mkdir -p "${ext_dst}"
    cp -r "${REPO_DIR}/extension/"* "${ext_dst}/"
    echo "  [extension] installed: ${ext_dst}"
  fi
fi

cat <<'EOF'

✓ Pi Grok Build installed successfully.

Activation:
1. Open Pi and run `/settings` -> Theme -> Select `grok-build-coding`
2. Or add to ~/.pi/agent/settings.json:
   {
     "theme": "grok-build-coding"
   }

Enjoy the Grok Build experience!
EOF
