# Research: 家計簿ダッシュボード

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-29

plan.md の Technical Context で未確定だった点の調査結果と、技術選定の理由をまとめる。

---

## R-001: バックエンドの実行環境

- **Decision**: AWS Lambda（マネージドランタイム `nodejs22.x`）＋ 関数 URL（認証 NONE）
- **Rationale**:
  - 講座（シラバス・Day1 ハンズオン）が Lambda 前提で、講師のサポートを受けやすい。
  - LINE の Webhook は HTTPS の公開エンドポイントが必要。関数 URL なら API Gateway なしで HTTPS を得られる。
  - Day1 の Lambda 作成手順で `Node.js 22.x` が指定されており、チーム全員の既存関数と揃う。
- **Alternatives considered**:
  - `nodejs24.x`: 新しいが講座手順と異なり、トラブル時の切り分けが増えるため不採用。
  - API Gateway: ルーティングや CORS 設定が増える。関数 URL で要件を満たせるため不採用。
  - Vercel / Render: 講座のサポート外。

## R-002: HTTP クライアント（sunabar API の呼び出し）

- **Decision**: Node.js 標準の `fetch` を使う（Day1 で使った `request` モジュールは使わない）
- **Rationale**: `request` は開発終了（非推奨）のライブラリ。`fetch` は Node.js 18 以降に標準搭載で、依存パッケージが減り、`await` でそのまま書ける（Day1 の `callApi` ラッパーが不要）。
- **Alternatives considered**: `request` ＋ Lambda レイヤー（Day1 方式）— レイヤー管理が増え、非推奨ライブラリのため不採用。`axios` — 標準 `fetch` で足りるため不採用（Constitution IV）。

## R-003: sunabar 入出金明細照会 API

- **Decision**: `GET https://api.sunabar.gmo-aozora.com/personal/v1/accounts/transactions` を使い、`accountId`・`dateFrom`・`dateTo`（`YYYY-MM-DD`）を指定する。レスポンスの `hasNext` が真の間、`nextItemKey` を付けて再取得する。
- **Rationale**: 月単位の集計に必要な全明細を取得できる唯一の API。
- **確認結果（2026-09-30、Postman の実レスポンスと API 仕様書 個人・個人事業主口座編 p.14〜17）**: 実レスポンスは `backend/tests/fixtures/sunabar-transactions.sample.json`（fixture の中の口座 ID は仕様書の例の値、振込先名は架空の名前に置き換えている。アプリが照会に使う口座 ID は `.env` の `SUNABAR_ACCOUNT_ID`）
  - 明細は `transactions` 配列。各項目は `transactionDate`・`valueDate`・`transactionType`（`"1"`: 入金 / `"2"`: 出金）・`amount`・`remarks`・`balance`・`itemKey`。金額・件数はすべて文字列
  - ページングは `hasNext` と `nextItemKey`。`hasNext` が真のとき、返ってきた `nextItemKey` を次のリクエストのクエリに付ける（`hasNext` が偽のときは `nextItemKey` 自体がない）。1 回の取得上限は 500 件（仕様書 p.17）
  - ⚠️ **`hasNext` は仕様書では真偽値（`true`）だが、sunabar の実レスポンスは文字列（`"false"`）**。`if (data.hasNext)` だと `"false"` も真になり取得が止まらないため、`true` と `"true"` の両方を真として扱う
  - `remarks` と `itemKey` は、該当データがない場合は項目ごと省略される（つかいわけ口座の明細は `itemKey` なし）。`amount` はマイナスを含むことがある
  - 並び順は古い順（取引日・`itemKey` の昇順）
  - 摘要の例: `ATM セブン`（入金・出金の両方に出る）、`振込 スナバ　タロウ`（振込先名の間は全角スペース）。店舗名は出ない（R-004 のとおり）
  - **つかいわけ口座間の振替は、照会に使う口座 ID によって出方が変わる**（口座 ID は 2 種類ある。仕様書 p.8・p.14）
    | `accountId` | 振替の明細 | `itemKey` | 残高 |
    |---|---|---|---|
    | 12 桁の口座 ID（例 `3020…`） | 出ない | あり | 親口座と子口座の合計 |
    | つかいわけ口座 ID（例 `SP3020…`。親口座にも子口座にもある） | 出る（例: 出金 `"2"`、摘要 `振替 貯蓄用`＝子口座の名前） | なし | その口座だけ |
  - **Decision（FR-004）**: 12 桁の口座 ID（`SUNABAR_ACCOUNT_ID`）で照会する。つかいわけ口座間の振替は明細に出ないので、振替の除外を自前で判定する必要がない。sunabar の明細の `isInternalTransfer` は常に `false`。`itemKey` も必ずあるので、Transaction の `id`（`sunabar:{itemKey}`）がそのまま作れる
    - つかいわけ口座 ID で照会する場合は、摘要の先頭が `振替 ` の明細を振替として除外し、`itemKey` がないため `id` を別の方法で作る必要がある（今回は採らない）
  - **Lambda での応答時間（2026-09-30、`kakeibo-webhook`・東京リージョン、CloudWatch の REPORT）**: 起動直後の 1 回目は約 3.75 秒（Init 0.3 秒 ＋ 処理 3.45 秒。メモリ 128 MB でも 512 MB でもほぼ同じ）、温まった状態は 0.5〜0.8 秒。遅いのは sunabar との最初の接続で、CPU では縮まない
  - **Decision（タイムアウト）**: sunabar の打ち切りを 4 秒から **8 秒**に延ばす。4 秒では起動直後の 1 回目に余裕がなく「銀行とつながりませんでした」になりうるため、SC-001（5 秒以内）をわずかに超えても返信が届く方を優先する
- **Alternatives considered**: 残高照会 API の差分から支出を推計 — 明細の内容が分からずカテゴリ判定できないため不採用。

## R-004: sunabar の明細データの性質とカテゴリ判定

- **Decision**: 摘要（`remarks`）のキーワード一致でカテゴリを判定する自作 API「支出カテゴリ判定 API」を実装する。sunabar 由来の支出は主に「振込」「現金（ATM）」になる前提で、店舗名を含む支出（食費・日用品など）は User Story 4 のダミー明細で補う。
- **Rationale**:
  - sunabar の明細は振込先名（半角カナ）や ATM 等が中心で、コンビニ等の店舗名はほとんど出ない。キーワード判定だけでは食費などが「その他」に偏る。
  - 「銀行が加盟店情報つきの明細を提供すればカテゴリ判定は正確になる」という提案自体を発表のネタにする（Constitution III）。
  - 振込先名によるルール（例: `ﾔﾁﾝ` → 住居）を追加すれば、sunabar の振込も住居・通信などに振り分けられる。デモ用の振込先名を事前に決めておく。
- **Alternatives considered**: 生成 AI による分類 — 精度は高いが、API キー管理・コスト・応答時間が増えるため今回は不採用（発展案として発表で触れる）。

## R-005: フロントエンドの構成

- **Decision**: React（Vite）＋ `@line/liff` ＋ グラフライブラリ Recharts。言語は JavaScript（JSX）。
- **Rationale**:
  - React はチームで選定済み。月切替・カテゴリ絞り込みなど状態に応じて表示が変わる画面に向く。
  - LIFF は React と競合せず、`liff.init()` を呼ぶだけで組み込める。
  - Recharts は React コンポーネントとして円グラフ・棒グラフを書ける。
- **Alternatives considered**: 素の HTML ＋ Chart.js — ビルド不要で軽いが、チーム選定により React を採用。TypeScript — 型の恩恵はあるが、学習コストと期間を考え不採用。

## R-006: フロントエンドの公開先

- **Decision**: AWS Amplify Hosting（手動デプロイ: `dist` を zip でアップロード）
- **Rationale**:
  - LIFF のエンドポイント URL は **HTTPS 必須**。S3 の静的ウェブサイトホスティングは HTTP のみで、CloudFront の追加設定が必要になる。
  - Amplify Hosting は GitHub 連携なしでも zip のドラッグ＆ドロップで HTTPS の URL が得られる。
- **Alternatives considered**: S3 ＋ CloudFront — 設定項目が多い。Lambda の関数 URL で HTML を返す — Vite のビルド成果物（複数ファイル）の配信が煩雑。

## R-007: LIFF の開発方法（ローカル）

- **Decision**: ローカル開発では LIFF Mock（`@line/liff-mock` プラグイン）を使い、LINE アプリなしでブラウザで画面を開発する。LINE 実機での確認は Amplify にデプロイした URL で行う。
- **Rationale**: LIFF は HTTPS かつ LINE Developers に登録した URL でしか本来動かない。毎回デプロイすると開発が遅くなる。
- **Alternatives considered**: ngrok でローカルを HTTPS 公開して LIFF に登録 — 可能だが URL が毎回変わり、LIFF 設定の更新が必要。必要な場合のみ使う。
- **前提（チャネル）**: LIFF は **LINE ミニアプリのチャネル**で作る。
  - LINE の公式方針で LIFF は LINE ミニアプリに統合され、新規の LIFF はミニアプリとして作ることが推奨されている（LINE ログインチャネルに LIFF アプリを追加する方式は採らない）。SDK（`@line/liff`）とコードは同じ。
  - ミニアプリのチャネルを作ると「開発用」「審査用」「本番用」の 3 つの内部チャネルが作られ、それぞれに LIFF ID とエンドポイント URL（「ウェブアプリ設定」タブ）がある。講義中は**開発用**だけを使う（未認証ミニアプリのため審査は不要。開発用はチャネルの権限を持つメンバーだけが開ける）。
  - Messaging API のチャネル（Bot）とミニアプリのチャネルは、**同じプロバイダー（@fumi217 さんのプロバイダー）にそろえる**。プロバイダーが違うと、同じ人でも LINE のユーザー ID が別になるため。

## R-008: LINE Bot の応答形式

- **Decision**: 月次サマリーは Flex Message（カード）で返す。リッチメニューは LINE Official Account Manager の画面から作成する（API ではなく GUI）。
- **Rationale**: Flex Message はテキストより見やすく、ダッシュボードを開くボタン（LIFF URL）を付けられる。リッチメニューは GUI で数分で作れる。
- **Alternatives considered**: テキストのみ — 実装は最短だがデモの見栄えが弱い（時間がなければテキストにフォールバックする）。

## R-009: 自作 API（モック）の提供方法

- **Decision**: ダッシュボード API と同じ Lambda に `/mock/*` のルートとして実装する。集計処理からは HTTP を経由せず関数として直接呼ぶ。
- **Rationale**: Lambda と関数 URL を増やさずに済む。HTTP でも公開しておくことで、発表で「こういう API です」と実際に叩いて見せられる。
- **Alternatives considered**: 自作 API ごとに Lambda を分ける — 設定・デプロイの手間が増えるため不採用。

## R-010: データ保存

- **Decision**: データベースは使わない。予算・カテゴリ判定ルール・ダミー明細はリポジトリ内の JSON ファイルで持つ。明細は毎回 sunabar から取得する。
- **Rationale**: 利用者 1 人・予算は固定値という前提（spec の Assumptions）で、永続化が必要なデータがない（Constitution IV）。
- **Alternatives considered**: DynamoDB — 予算の編集機能などが必要になった時点で検討する。

## R-011: 開発環境（Docker）

- **Decision**: Docker Compose で `frontend`（Vite 開発サーバー）と `backend`（Lambda ハンドラーをローカル HTTP サーバーで包んだもの）の 2 サービスを起動する。イメージは `node:22-bookworm-slim` で統一する。
- **Rationale**:
  - Lambda の `nodejs22.x` とメジャーバージョンを揃えられる（Constitution V）。
  - ホストの Node.js バージョン（リポジトリ直下の `.node-version` は 24）に依存しない。
  - ローカルサーバーは Lambda の関数 URL と同じ形式のイベントをハンドラーに渡すため、同じコードをそのまま Lambda にデプロイできる。
- **Alternatives considered**: AWS SAM CLI の `sam local` — Docker in Docker 相当の構成になり、チームの環境差でつまずきやすい。
- **Note**: `.node-version` は、ホストで直接 Node.js を使う人向けの設定。Docker 利用が前提になったため、実装開始時に `22` へ揃えることを推奨する。

## R-012: テスト

- **Decision**: バックエンドは Node.js 組み込みのテストランナー（`node --test`）。テスト対象は月の変換・集計・カテゴリ判定・予算判定など、外部 API に依存しない純粋な関数。フロントエンドは純粋な関数が少なく期間も短いため、自動テストは書かず手動の動作確認（quickstart）で代替する（PR #42 のレビューで決定）。
- **Rationale**: 追加の依存が少なく、Docker 内でそのまま動く。銀行 API を呼ぶ部分は、sunabar のレスポンス例（fixture）を使ってテストする。
- **Alternatives considered**: フロントエンドに Vitest — 画面側の純粋な関数が少なく効果が小さいため見送り。E2E テスト（Playwright）— 期間内では手動のデモ確認で代替する。
