#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONT_DIR="$ROOT_DIR/spsfront"
ZIP_PATH="$ROOT_DIR/spsfront.zip"

cd "$ROOT_DIR"

npm run build --workspace=apps/web

rm -rf "$FRONT_DIR"
mkdir -p "$FRONT_DIR"

rsync -av --delete "$ROOT_DIR/apps/web/dist/" "$FRONT_DIR/"

cat > "$FRONT_DIR/.htaccess" <<'EOF'
Options -MultiViews
RewriteEngine On

<IfModule mod_headers.c>
  <Files "index.html">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
  </Files>
</IfModule>

RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

RewriteRule ^ index.html [L]
EOF

rm -f "$ZIP_PATH"
(
  cd "$FRONT_DIR"
  zip -r "$ZIP_PATH" . -x "*.DS_Store"
)

BUILD_ID="$(grep -o 'content="index-[^@]*' "$FRONT_DIR/index.html" | head -1 | cut -d'"' -f2 || true)"
echo "Created $ZIP_PATH"
echo "Build id: ${BUILD_ID:-unknown}"
echo "Upload the CONTENTS of this zip directly into public_html (not the spsfront folder)."
