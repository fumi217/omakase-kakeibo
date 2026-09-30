#!/bin/sh
# Lambda 用の zip を作る【担当 A】（quickstart 4-1）
# kakeibo-webhook と kakeibo-api の両方に同じ zip をアップロードする（ハンドラー名だけ変える。plan.md）
# 使い方: docker compose run --rm backend npm run package → backend/dist/backend.zip（Git 管理外）
set -eu

cd "$(dirname "$0")/.."
OUT="$PWD/dist/backend.zip"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# 必要なものだけを別の場所にコピーする（tests・local・.env は入れない）
cp -R src package.json package-lock.json "$WORK"/

# 本番用の依存だけを、ロックファイルどおりに入れ直す（開発用の node_modules は使わない）
(cd "$WORK" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null)

mkdir -p dist
rm -f "$OUT"
(cd "$WORK" && zip -qr "$OUT" src node_modules package.json)

echo "作成しました: backend/dist/backend.zip（$(du -h "$OUT" | cut -f1)）"
