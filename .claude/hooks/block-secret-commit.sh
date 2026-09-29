#!/bin/bash
# Claude が git commit を実行する直前に、.githooks/pre-commit で .env 系ファイルとトークンらしき値を確認する。
# 判定のルールは .githooks/pre-commit の 1 か所だけに置く（ここには書かない）。
# ホストに python3 / jq / node がなくても動くよう、標準入力の JSON は grep で判定する。

input=$(cat)

echo "$input" | grep -qE 'git[[:space:]]+commit' || exit 0

cd "$CLAUDE_PROJECT_DIR" || exit 0

# core.hooksPath が .githooks なら、git 自身が pre-commit を実行するので二重に動かさない
case "$(git config core.hooksPath)" in
  .githooks | .githooks/ | */.githooks | */.githooks/) exit 0 ;;
esac

# pre-commit はブロック時に exit 1 を返すが、Claude の hook は exit 2 でないとコマンドを止めない
sh .githooks/pre-commit || exit 2

exit 0
