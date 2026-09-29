#!/bin/bash
# git commit の直前に、.env 系ファイルとトークンらしき値がステージされていないか確認する。
# 見つかったら exit 2 でコミットをブロックする（github-workflow スキルのチェック 2・3 と同じ内容）。
# ホストに python3 / jq / node がなくても動くよう、標準入力の JSON は grep で判定する。

input=$(cat)

echo "$input" | grep -qE 'git[[:space:]]+commit' || exit 0

staged=$(git diff --cached --name-only)
blocked_files=$(echo "$staged" | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$')

if [ -n "$blocked_files" ]; then
  echo ".env 系のファイルがステージされています。コミットをブロックしました: $blocked_files" >&2
  exit 2
fi

token_lines=$(git diff --cached -U0 \
  | grep -E '^\+' \
  | grep -iE '(access[_-]?token|channel[_-]?secret|sunabar[_-]?token|x-access-token|aws_secret|AKIA[0-9A-Z]{16})[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9+/=_-]{16,}')

if [ -n "$token_lines" ]; then
  echo "トークンらしき値がステージされた差分に含まれています。コミットをブロックしました。" >&2
  echo "値をコードから取り除き、環境変数（.env / Lambda の環境変数）から読むようにしてください。" >&2
  exit 2
fi

exit 0
