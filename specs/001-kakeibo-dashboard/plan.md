# Implementation Plan: 家計簿ダッシュボード（LINE で見る、銀行明細の自動家計簿）

**Branch**: `001-kakeibo-dashboard` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-kakeibo-dashboard/spec.md`

## Summary

sunabar（GMO あおぞらネット銀行の API 実験場）の入出金明細を月単位で取得・集計し、LINE Bot（Flex Message）と LIFF で開く React 製ダッシュボードで表示する。支出のカテゴリ判定・予算・他の金融機関の明細統合は、「銀行が提供してくれたらいいのに」という自作 API として同じバックエンドに実装し、Day5 に発表する。

バックエンドは AWS Lambda（Node.js 22）＋ 関数 URL、フロントエンドは React（Vite）を AWS Amplify Hosting で公開する。ローカル開発は Docker Compose で統一する。

## 全体構成

```text
[スマホの LINE アプリ]
   │ ① メッセージ / リッチメニュー            │ ③ リッチメニュー「ダッシュボード」
   ▼                                        ▼
[LINE Platform] ──Webhook──▶ [Lambda: kakeibo-webhook]      [LIFF 画面（React / Amplify Hosting）]
                                   │  ② Flex Message で返信             │ ④ fetch（HTTPS, CORS）
                                   │                                    ▼
                                   │                        [Lambda: kakeibo-api]
                                   │                                    │
                                   └──────────┬─────────────────────────┘
                                              ▼  共通モジュール（backend/src/services）
                          ┌───────────────────┼─────────────────────────┐
                          ▼                   ▼                         ▼
                 [sunabar 入出金明細 API]   [自作: カテゴリ判定 / 予算]   [自作: 統一 ID 他行明細（ダミー）]
                   ※本物の API              ※JSON ルール・固定値          ※ダミーデータ
```

- 2 つの Lambda は**同じ zip（同じソースコード）**を使い、ハンドラー名だけ変える。
- 集計処理（`services/summary.js`）を LINE Bot とダッシュボードで共有し、表示金額の一致（FR-027 / SC-004）を担保する。

## Technical Context

**Language/Version**: JavaScript。バックエンド Node.js 22（Lambda `nodejs22.x`）、フロントエンド Node.js 22 上の Vite ビルド（出力は静的ファイル）

**Primary Dependencies**:
- バックエンド: `@line/bot-sdk`（Webhook 署名検証・返信）。HTTP は標準 `fetch`（[research R-002](./research.md#r-002-http-クライアントsunabar-api-の呼び出し)）
- フロントエンド: `react`, `vite`, `@line/liff`, `@line/liff-mock`（開発時のみ）, `recharts`

**Storage**: なし。予算・カテゴリ判定ルール・ダミー明細はリポジトリ内 JSON（[R-010](./research.md#r-010-データ保存)）

**Testing**: バックエンド `node --test`、フロントエンド Vitest（[R-012](./research.md#r-012-テスト)）

**Target Platform**: AWS Lambda（関数 URL）/ AWS Amplify Hosting / スマートフォンの LINE アプリ（LIFF）

**Project Type**: Web アプリケーション（frontend + backend）

**Performance Goals**: LINE 応答・ダッシュボード表示とも 5 秒以内（SC-001, SC-002）

**Constraints**:
- Lambda のタイムアウトは 30 秒に設定する（初期値 3 秒では sunabar API が間に合わないことを Day1 で確認済み）。
- LIFF のエンドポイントは HTTPS 必須。
- sunabar のトークンはバックエンドのみで保持（Constitution II）。

**Scale/Scope**: 利用者 1 人、1 口座、画面 1 つ（ダッシュボード）、LINE コマンド 3 つ（今月・先月・ダッシュボード）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. デモファースト・段階的リリース | ✅ | P1（LINE サマリー）だけで発表可能。フェーズを P1→P4 で区切る（下記「実装フェーズ」） |
| II. 秘密情報をコード・リポジトリに置かない | ✅ | トークンは `.env`（Git 管理外）と Lambda 環境変数のみ。フロントに sunabar トークンを渡さない構成（kakeibo-api 経由） |
| III. 本物の API と自作 API の境界 | ✅ | sunabar 入出金明細 API を使用。自作 API は `backend/src/mock/` に分離し `contracts/api.md` に明記。明細に `source` を持たせる |
| IV. シンプルさ優先 | ✅ | DB なし、Lambda 2 つ（同一 zip）、HTTP は標準 `fetch` |
| V. Docker で再現できる開発環境 | ✅ | Compose で frontend / backend を起動。`node:22` で Lambda と一致 |
| VI. レビューを通してから main に入れる | ✅ | `github-workflow` スキルに従う（PR 必須・レビュー 1 名＋`@aitutor-review review` による AI チューターレビュー） |

**Post-Design Re-check（Phase 1 後）**: ✅ 違反なし。Complexity Tracking への記載不要。

## Project Structure

### Documentation (this feature)

```text
specs/001-kakeibo-dashboard/
├── spec.md              # 仕様（何を・なぜ）
├── plan.md              # この計画（どう作るか）
├── research.md          # 技術調査・選定理由
├── data-model.md        # データ構造
├── quickstart.md        # Docker での起動・動作確認・デプロイ手順
├── contracts/
│   ├── api.md           # ダッシュボード API・自作 API の仕様
│   └── line-bot.md      # LINE Bot のコマンドと応答仕様
├── checklists/
│   └── requirements.md  # 仕様の品質チェック
└── tasks.md             # /speckit-tasks で生成（未作成）
```

### Source Code (repository root)

```text
compose.yaml                     # Docker Compose（frontend / backend）
.env.example                     # 環境変数のキー一覧（値は書かない）

backend/
├── Dockerfile                   # node:22-bookworm-slim + zip
├── package.json
├── src/
│   ├── handlers/
│   │   ├── webhook.js           # Lambda: kakeibo-webhook（LINE Webhook）
│   │   └── api.js               # Lambda: kakeibo-api（ダッシュボード API・/mock/* ルーティング）
│   ├── services/
│   │   ├── sunabar.js           # sunabar API 呼び出し（fetch・ページング）
│   │   ├── transactions.js      # 明細の取得・正規化・統合（sunabar + 他行）
│   │   ├── summary.js           # 月次サマリーの集計（Bot とダッシュボードで共有）
│   │   └── flexMessage.js       # 月次サマリー → Flex Message 変換
│   ├── mock/                    # 自作 API（発表対象）
│   │   ├── categorize.js        # 支出カテゴリ判定 API
│   │   ├── budget.js            # 予算 API
│   │   ├── unifiedAccounts.js   # 統一 ID 他行明細 API
│   │   └── data/
│   │       ├── category-rules.json
│   │       ├── budgets.json
│   │       └── unified-accounts.json
│   └── lib/
│       ├── month.js             # "YYYY-MM" ⇔ 期間（日本時間）
│       └── http.js              # 関数 URL 用のレスポンス・エラー整形
├── local/
│   └── server.js                # ローカル用: HTTP リクエスト → 関数 URL 形式のイベントに変換してハンドラーを呼ぶ
├── scripts/
│   └── package.sh               # Lambda 用 zip の作成
└── tests/
    ├── fixtures/                # sunabar レスポンス例（口座番号はダミーに置換）
    └── unit/                    # summary / categorize / budget / month のテスト

frontend/
├── Dockerfile                   # node:22-bookworm-slim
├── package.json
├── vite.config.js
├── index.html
├── src/
│   ├── main.jsx                 # LIFF 初期化（開発時は LIFF Mock）→ App 描画
│   ├── App.jsx
│   ├── api/
│   │   └── client.js            # kakeibo-api 呼び出し
│   ├── components/
│   │   ├── MonthSwitcher.jsx
│   │   ├── SummaryCards.jsx     # 入金・支出合計
│   │   ├── CategoryPieChart.jsx
│   │   ├── DailyBarChart.jsx
│   │   ├── BudgetList.jsx       # 予算使用率（P3）
│   │   └── TransactionList.jsx  # 明細一覧・カテゴリ絞り込み
│   └── hooks/
│       └── useMonthlySummary.js
└── tests/
```

**Structure Decision**: frontend / backend の 2 プロジェクト構成（Web アプリケーション）。バックエンドは 1 つのコードベースから 2 つの Lambda を作る。自作 API は `backend/src/mock/` に隔離し、本物の API（`services/sunabar.js`）と混ぜない。

## 環境変数

値は**絶対にコミットしない**。`.env.example` にはキー名だけを書く。

| キー | 使う場所 | 内容 |
|---|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | backend（webhook） | LINE Messaging API のチャネルアクセストークン（長期） |
| `LINE_CHANNEL_SECRET` | backend（webhook） | LINE Messaging API のチャネルシークレット（署名検証用） |
| `SUNABAR_ACCESS_TOKEN` | backend | sunabar 個人口座のアクセストークン |
| `SUNABAR_ACCOUNT_ID` | backend | sunabar 個人口座の口座 ID（12 桁） |
| `UNIFIED_ID_ENABLED` | backend | `true` で他行ダミー明細を合算（FR-042） |
| `ALLOWED_ORIGIN` | backend（api） | CORS で許可するフロントの URL（開発時 `http://localhost:5173`） |
| `LIFF_URL` | backend（webhook） | Flex Message の「ダッシュボードを開く」ボタンのリンク先 |
| `VITE_LIFF_ID` | frontend | LIFF ID（公開情報だが環境ごとに変わるため変数化） |
| `VITE_API_BASE_URL` | frontend | kakeibo-api の関数 URL（開発時 `http://localhost:3000`） |
| `VITE_LIFF_MOCK` | frontend | `true` で LIFF Mock を使う（ローカル開発用） |

> Day1 ハンズオンの Lambda では `channelAccessTokenLINE` / `channelSecretLINE` / `sunabarToken` という名前を使ったが、本プロジェクトの新しい Lambda では上記の名前に統一する。

## Docker 開発環境

- `compose.yaml` のサービス
  - `backend`: `node local/server.js`（`--watch` で自動再起動）。ポート `3000`。`env_file: .env`
  - `frontend`: `vite --host 0.0.0.0`。ポート `5173`。`env_file: .env`（`VITE_` で始まる変数のみ画面に埋め込まれる）
  - `node_modules` は名前付きボリュームにして、ホスト（macOS）とコンテナ（Linux）で共有しない
- LINE の Webhook だけはインターネットから届く必要があるため、ローカルでは確認しない（Lambda にデプロイして確認）。どうしてもローカルで受けたい場合のみ ngrok を使う。
- 具体的な起動・確認手順は [quickstart.md](./quickstart.md)。

## 実装フェーズ（スケジュール）

| フェーズ | 期間の目安 | 内容 | 完了の定義 |
|---|---|---|---|
| 0. 準備 | Day2 14:30〜15:30 | Docker 環境、`.env`、LINE ログインチャネル＋LIFF 登録、Amplify に空の React を公開、sunabar でデモ用明細を作成 | 全員が `docker compose up` でき、スマホの LINE で空の LIFF 画面が開く |
| 1. P1: LINE サマリー | Day2 15:30〜Day3 午前 | `sunabar.js` / `summary.js` / `categorize.js` / `webhook.js` / `flexMessage.js`、リッチメニュー | LINE で「今月」「先月」にカードが返る（spec US1 の受け入れシナリオ 1〜4） |
| 2. P2: ダッシュボード | Day3 午後〜Day4 午前 | `api.js`、React の各コンポーネント、Amplify デプロイ | リッチメニューからグラフ・明細・月切替・絞り込みが動く（US2） |
| 3. P3: 予算 | Day4 午後 | `budget.js`、`BudgetList.jsx`、Flex Message に超過表示 | US3 の受け入れシナリオ 1〜3 |
| 4. P4: 統一 ID | Day4 夕方（余裕があれば） | `unifiedAccounts.js`、`source` 表示 | US4 の受け入れシナリオ 1〜2 |
| 5. 仕上げ | Day5 午前（12:00 コードフリーズ） | デモデータ最終調整、README、発表用の自作 API 説明 | デモ台本どおりに 3 分で通る（SC-007） |

## チームでの分担

2 人とも**フロントエンドとバックエンドの両方**を担当する。層（フロント／バック）ではなく**ユーザーストーリー（機能）ごとに縦に分け**、1 人で「API → 画面 → 動作確認」まで完結できるようにする。**境界は `contracts/` と `data-model.md`** で、ここを Day2 に 2 人で合意すれば、相手の実装を待たずにダミーデータで並行開発できる。

| | **A: LINE Bot ＋ 予算**（@fumi217） | **B: ダッシュボード ＋ 統一 ID**（@masuda-yu1019） |
|---|---|---|
| 担当ストーリー | US1（LINE サマリー）、US3（予算） | US2（ダッシュボード）、US4（統一 ID） |
| バックエンド | `services/sunabar.js`, `services/summary.js`, `lib/month.js`, `handlers/webhook.js`, `services/flexMessage.js`, `mock/budget.js` | `handlers/api.js`, `services/transactions.js`, `mock/categorize.js`, `mock/unifiedAccounts.js`, `lib/http.js`, `local/server.js` |
| フロントエンド | `components/BudgetList.jsx` | `main.jsx`, `App.jsx`, `api/client.js`, `hooks/`, `MonthSwitcher` / `SummaryCards` / `CategoryPieChart` / `DailyBarChart` / `TransactionList` |
| LINE / AWS 設定 | Messaging API（Webhook）、リッチメニュー、Lambda `kakeibo-webhook` | LINE ログインチャネル・LIFF、Amplify Hosting、Lambda `kakeibo-api` |
| 発表する自作 API | 予算 API | 支出カテゴリ判定 API、統一 ID 他行明細 API |
| PR レビュアー | @masuda-yu1019 | @fumi217 |

### ぶつからないための約束

1. **ファイルの担当者が変更する。** 相手の担当ファイルを直したいときは、自分で直さず Issue か PR コメントで相談する。
2. **先にダミーで作る。**
   - B は `contracts/api.md` の `/api/summary` レスポンス例を固定データとして画面を先に作る。
   - A は `categorize()` を仮に「すべて その他」を返す関数として集計を先に作り、B の実装ができたら差し替える。
3. **共有ファイルは持ち主が統合する。** `App.jsx` は B が持つ。A の `BudgetList.jsx` を画面に組み込む変更は、A が PR を出し B がレビューする。
4. **`summary.js` の出力形式（Monthly Summary）を変えるときは、2 人で合意してから** `data-model.md` → コードの順に変更する（LINE とダッシュボードの金額一致 FR-027 のため）。
5. **共通の基盤は 2 人で一緒に通す。** Phase 0 の「Docker 起動」「sunabar の明細を 1 回取得」「空の React 画面を LINE で開く」は、2 人とも自分の手で一度動かす。

### 日ごとの目安

| 時間 | A（@fumi217） | B（@masuda-yu1019） |
|---|---|---|
| Day2 午後 | 2 人で: Docker 環境、contracts / data-model の確認、デモ用明細の作成 | ← 同じ |
| 〜Day3 午前 | sunabar 明細の取得・集計 → LINE で「今月」にテキストで返す | React の土台、LIFF で空の画面を LINE で開く、カテゴリ判定 |
| Day3 午後〜Day4 午前 | Flex Message、リッチメニュー、「先月」・使い方 | `/api/summary`・`/api/transactions` と画面の接続、グラフ、明細一覧、月切替・絞り込み |
| Day4 午後 | 予算（API → LINE の超過表示 → `BudgetList.jsx`） | 統一 ID（ダミー明細の合算、出どころ表示） |
| Day5 午前 | 2 人で: 通しのデモ確認、発表資料 | ← 同じ |

## リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| sunabar 明細の項目名・ページングが想定と違う | P1 が遅れる | Phase 0 で Postman の実レスポンスを `tests/fixtures/` に保存（口座番号はダミー化）し、A（@fumi217）が最初に確認 |
| LIFF / LINE ログインチャネル / CORS の設定で詰まる | P2 が遅れる | Phase 0 で「空の画面を LINE で開く」「API を 1 本叩く」まで先に通す |
| デモ用の明細が少なくグラフが寂しい | 発表の見栄え | Phase 0 で入金・振込を 10〜20 件作成。店舗系の支出は P4 のダミー明細で補う |
| トークンの漏洩（コミット・スクショ） | 重大 | `.gitignore`、`github-workflow` スキルのコミット前チェック、PR テンプレートの確認項目 |
| Lambda のタイムアウト | 無反応 | タイムアウト 30 秒、ページングは最大 5 回で打ち切りログを出す |

## 未確定事項（チームで決めること）

- デプロイ先 AWS アカウント: 代表者 1 名のアカウントに集約するか（推奨: 発表用に 1 つに集約し、他のメンバーは Docker のローカル環境で開発）。
- LINE の Bot / LIFF: 代表者のチャネルに集約するか（推奨: 同上）。メンバーは LINE Developers の「権限設定」で招待してもらう。
- 各メンバーの sunabar トークン: ローカル開発では各自の sunabar 口座を使ってよい（デモは代表者の口座）。

## Complexity Tracking

Constitution Check に違反はないため記載なし。
