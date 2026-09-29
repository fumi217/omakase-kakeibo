# CLAUDE.md

家計簿ダッシュボード（sunabar × LINE）のチーム開発リポジトリ。Claude Code は作業を始める前にこのファイルの前提に従うこと。

## プロジェクトの前提

- Fintech 講座（Day2〜Day5）で作るアプリ。**Day5 12:00 がコードフリーズ**、午後に発表。
- 講座のグランドルール
  - sunabar（銀行 API のサンドボックス）の API を 1 本以上使う。
  - 厳密な本人確認などは実装しなくてよい（省いた点は発表で「本番では必要」と説明する）。
  - 「こんな API があったらいい」という API は自作してよく、Day5 に発表する。
- 講座の配布資料（CONFIDENTIAL 表記のスライド等）はリポジトリに入れない・内容を転記しない。

## まず読むもの

1. `specs/001-kakeibo-dashboard/plan.md` の「チームでの分担」— 誰がどのファイルを担当するか
2. `specs/001-kakeibo-dashboard/contracts/` と `data-model.md` — 2 人の境界になる API・データの形
3. `specs/001-kakeibo-dashboard/spec.md` — 作るもの（ユーザーストーリー P1〜P4）
4. `.specify/memory/constitution.md` — チームの原則

仕様を変えるときは、コードより先に `specs/` を更新する（Spec Kit: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`）。

## チームと分担

| 担当 | GitHub | 範囲 |
|---|---|---|
| A: LINE Bot ＋ 予算 | @fumi217 | US1・US3。sunabar の明細取得・集計、Webhook、Flex Message、予算 API、`BudgetList.jsx` |
| B: ダッシュボード ＋ 統一 ID | @masuda-yu1019 | US2・US4。React の画面、LIFF、Amplify、`kakeibo-api`、カテゴリ判定 API、統一 ID API |

- 相手の担当ファイルは直接変更しない。Issue か PR コメントで相談する。
- `services/summary.js` の出力形式（Monthly Summary）は 2 人で合意してから変える（LINE と画面の金額を一致させるため）。

## 技術の前提

- バックエンド: Node.js 22（AWS Lambda `nodejs22.x`）＋ 関数 URL。フロントエンド: React（Vite）＋ LIFF。
- 開発環境は Docker（`docker compose up`）。ホストの Node.js のバージョンには依存しない。
- sunabar は**個人口座**の API（`/personal/v1/...`）を使う。
- HTTP 通信は標準の **`fetch`** を使う（`request` モジュールは開発終了のため使わない）。`fetch` はエラー応答でも例外を投げないので、必ず `res.ok` を確認する。

  ```js
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`sunabar API エラー: ${res.status}`);
  const data = await res.json();
  ```

- sunabar は金額を文字列（`"30000"`）で返す。取得直後に `Number()` で数値にする。
- 依存を追加・更新したら、`package-lock.json` に全 CPU 向けのバイナリ（例: `@rolldown/binding-linux-x64-gnu` と `-linux-arm64-gnu`）が残っているか確認する。Mac（arm64）と WSL（x86_64）で開発しているため、片方しか記録されないと相手の環境で起動しない（npm/cli#4828。#17）。消えていたら、`node_modules` のない使い捨てコンテナで `npm install --package-lock-only` を実行して作り直す。
- Lambda の注意点（Day1 のハンズオンで確認済み）
  - タイムアウトは **30 秒**にする（初期値 3 秒では sunabar API が間に合わない）。
  - コードを変えたら **Deploy（zip の再アップロード）を忘れない**。反映されていないことが原因のトラブルが多い。
  - API の結果を使う処理は `await` で待ってから行う。待たずに LINE へ返信すると空のメッセージになる。
  - 原因調査は CloudWatch ログ（モニタリング →「CloudWatch ログを表示」）で行う。

## 秘密情報（最重要）

- **`.env` は絶対にコミットしない。中身を読まない・表示しない・チャットに貼らない。** トークン類は環境変数から読む。
- `.claude/settings.json` で `.env` の読み取りと危険な git 操作を禁止し、`.env` 系のファイルやトークンらしき値がステージされた状態の `git commit` を hook（`.claude/hooks/block-secret-commit.sh`）で止めている。
- 人が直接コミットする場合に備えて Git の pre-commit フック（`.githooks/pre-commit`）がある。clone したら最初に一度だけ有効化する: `git config core.hooksPath .githooks`
- GitHub のプラン上、ブランチ保護と Secret scanning は使えない。`main` への直接 push 禁止・レビュー必須はチームの約束と上記の仕組みで守る。
- 漏れた場合は、履歴を消すより先にキーを再発行する（手順は `github-workflow` スキル）。

## Git / GitHub

- コミット・Issue・PR・マージは `.claude/skills/github-workflow/SKILL.md` に従う。
  - 1 Issue = 1 ブランチ = 1 PR。`main` への直接 push は禁止。
  - コミットと PR のタイトルに Issue 番号を入れる（例: `feat(backend): #12 明細の集計を追加`）。
  - `git add .` / `git add -A` は使わず、ファイル名を指定する。
- PR を作ったら `@aitutor-review review` とコメントして AI チューターのレビューを依頼する。
- AI チューターは差分が約 1,000 行を超えると読み切れない。**1 PR は 500 行以内を目安、1,000 行を超えない**。

## 個人の設定

- 自分だけの許可設定などは `.claude/settings.local.json` に書く（Git 管理外）。
