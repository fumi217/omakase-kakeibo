# Quickstart: 家計簿ダッシュボード

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

チームメンバーが、手元の Docker で開発を始め、Lambda / Amplify にデプロイして動作確認するまでの手順。

> ⚠️ **`.env` は絶対にコミットしない。** トークン類はチャット・Issue・PR・スクリーンショットにも貼らない。詳しくは `.claude/skills/github-workflow/SKILL.md`。

---

## 0. 前提

| 必要なもの | 確認方法 |
|---|---|
| Docker Desktop | `docker compose version` が表示される |
| Git | `git --version` |
| sunabar のアカウント（個人口座のトークン） | sunabar ポータルにログインできる |
| LINE Developers（@fumi217 さんのプロバイダーのチャネルに権限を追加済み） | コンソールで Bot とミニアプリのチャネルが見える |
| AWS アカウント（デプロイ担当のみ） | コンソールに MFA でログインできる |

ホストに Node.js は不要（Docker 内の Node.js 22 を使う）。

## 1. 初回セットアップ

```bash
git clone <リポジトリURL>
cd <リポジトリ>
cp .env.example .env        # .env に各自のトークンを記入（.env は Git 管理外）
git check-ignore .env       # 「.env」と表示されれば、コミット対象外になっている
docker compose build
docker compose run --rm backend npm install
docker compose run --rm frontend npm install
```

ローカル開発時の `.env` の主な値:

```dotenv
SUNABAR_ACCESS_TOKEN=（sunabar ポータルの個人口座トークン）
SUNABAR_ACCOUNT_ID=（個人口座の口座 ID 12 桁）
UNIFIED_ID_ENABLED=false
ALLOWED_ORIGIN=http://localhost:5173
VITE_API_BASE_URL=http://localhost:3000
VITE_LIFF_MOCK=true
VITE_LIFF_ID=（LIFF ID。Mock 時はダミーでも可）
```

## 2. 起動

```bash
docker compose up
```

| サービス | URL | 用途 |
|---|---|---|
| frontend | http://localhost:5173 | ダッシュボード（LIFF Mock で LINE なしで表示） |
| backend | http://localhost:3000 | ダッシュボード API・自作 API |

## 3. 動作確認（ローカル）

API の仕様は [contracts/api.md](./contracts/api.md)。

| # | 確認内容 | 手順 | 期待結果 |
|---|---|---|---|
| L1 | sunabar から明細を取得・集計できる | `curl "http://localhost:3000/api/summary?month=$(date +%Y-%m)"` | `totalIncome` / `totalExpense` が sunabar の入出金明細の合計と一致 |
| L2 | 明細 0 件の月 | `curl "http://localhost:3000/api/summary?month=2020-01"` | `200` で `totalExpense: 0` |
| L3 | 月の形式エラー | `curl "http://localhost:3000/api/summary?month=abc"` | `400` / `INVALID_MONTH` |
| L4 | カテゴリ判定 API | `curl "http://localhost:3000/mock/categorize?description=ATM"` | `category: "現金"` |
| L5 | ダッシュボード表示 | ブラウザで http://localhost:5173 | 円グラフ・日別グラフ・明細一覧が表示され、合計が L1 と一致 |
| L6 | 月切替・絞り込み | 画面で「前の月」、円グラフの「食費」を押す | 表示が切り替わり、明細が絞り込まれる |
| L7 | ユニットテスト | `docker compose run --rm backend npm test`、`docker compose run --rm frontend npm test` | すべて pass |

## 4. デプロイ（担当者のみ）

### 4-1. バックエンド（Lambda）

1. zip を作る: `docker compose run --rm backend npm run package` → `backend/dist/backend.zip`（`*.zip` は Git 管理外）
2. AWS コンソールで Lambda 関数を 2 つ作る（東京リージョン、ランタイム **Node.js 22.x**）
   | 関数名 | ハンドラー |
   |---|---|
   | `kakeibo-webhook` | `src/handlers/webhook.handler` |
   | `kakeibo-api` | `src/handlers/api.handler` |
3. 両方に同じ zip をアップロードする（「アップロード元」→「.zip ファイル」）
4. 設定 → 一般設定 → **タイムアウトを 30 秒**にする
5. 設定 → 環境変数に、[plan.md の環境変数表](./plan.md#環境変数)の backend 用の値を入れる
6. 設定 → 関数 URL を作成（認証タイプ NONE）
   - `kakeibo-api` は「その他の設定」で **CORS を有効化**し、許可オリジンに Amplify の URL を入れる
7. LINE Developers の Messaging API 設定で、Webhook URL に `kakeibo-webhook` の関数 URL を設定し、「Webhook の利用」をオン →「検証」で成功を確認

### 4-2. フロントエンド（LINE ミニアプリ ＋ Amplify Hosting）

LIFF は **LINE ミニアプリのチャネル**（@fumi217 さんのプロバイダー）の**開発用**内部チャネルを使う（[research R-007](./research.md#r-007-liff-の開発方法ローカル)）。デプロイを 1 回で済ませるため、「LIFF ID を先に確認 → ビルド → Amplify に公開 → エンドポイント URL を差し替え」の順に進める。

1. **LIFF ID を確認する**: LINE Developers → ミニアプリのチャネル →「ウェブアプリ設定」タブ →「開発用」の **LIFF ID** と **LIFF URL**（`https://miniapp.line.me/xxxx` または `https://liff.line.me/xxxx`）を控える。エンドポイント URL が空なら、仮に `https://example.com` を入れておく
   - 開発用を開けるのは、チャネルの「権限設定」に追加されたメンバーだけ。2 人とも追加されていることを確認する
2. **`.env` を設定する**（本番ビルド用）
   ```dotenv
   VITE_LIFF_ID=（1 の開発用 LIFF ID）
   VITE_LIFF_MOCK=false
   VITE_API_BASE_URL=（kakeibo-api の関数 URL。未デプロイなら空のままでよい）
   ```
3. **ビルドする**: `docker compose run --rm frontend npm run build` → `frontend/dist/`
4. **zip にする**（`dist` フォルダではなく**中身**を zip にする）: `(cd frontend/dist && zip -r ../../kakeibo-frontend.zip .)`（`*.zip` は Git 管理外）
5. **Amplify に公開する**: AWS コンソール（東京リージョン）→ Amplify →「新しいアプリを作成」→「Git なしでデプロイ」→ アプリ名 `kakeibo-dashboard` → 4 の zip をドラッグ＆ドロップ → `https://main.xxxx.amplifyapp.com` のような HTTPS の URL が発行される
6. **エンドポイント URL を差し替える**: ミニアプリのチャネル →「ウェブアプリ設定」→「開発用」のエンドポイント URL を 5 の Amplify の URL に変更する
7. **LINE で開く**: 1 の LIFF URL を自分宛てに LINE で送ってタップする →「○○さんの家計簿」と表示されれば完了
8. **ローカル開発に戻す**: `.env` の `VITE_LIFF_MOCK=true`、`VITE_API_BASE_URL=http://localhost:3000` に戻す（または空にして compose の既定値を使う）

コードを変えたら 3〜5 をやり直す（Amplify に再アップロードしないと反映されない）。

### 4-3. Bot とリッチメニュー

1. `kakeibo-webhook` の環境変数 `LIFF_URL` に、4-2 の 1 の LIFF URL を設定する
2. LINE Official Account Manager → リッチメニューで 3 ボタンを作成（[contracts/line-bot.md](./contracts/line-bot.md)）。Bot（Messaging API のチャネル）は、ミニアプリと同じ @fumi217 さんのプロバイダーのものを使う

## 5. 動作確認（本番・スマホの LINE）

| # | 確認内容 | 手順 | 期待結果 |
|---|---|---|---|
| P1 | US1 | LINE で「今月」 | 5 秒以内にサマリーカードが届く。金額が L1 と一致 |
| P2 | US1 | 「先月」「あいうえお」 | 先月のカード / 使い方メッセージ |
| P3 | US2 | リッチメニュー「ダッシュボード」 | LINE 内で画面が開き、表示名とグラフが出る。金額が P1 と一致 |
| P4 | US3 | 予算を超える支出がある月を表示 | 画面と LINE カードに超過表示 |
| P5 | US4 | `UNIFIED_ID_ENABLED=true` で再表示 | ダミーのカード明細が合算され、出どころが表示される |

## 6. トラブルシューティング

| 症状 | 確認すること |
|---|---|
| LINE で返事がない | CloudWatch ログ。`Task timed out` ならタイムアウト 30 秒、エラーなら内容を確認。**コード変更後に Deploy / zip 再アップロードしたか** |
| 画面で `CORS` エラー | `kakeibo-api` の関数 URL の CORS 設定と `ALLOWED_ORIGIN` が Amplify の URL と一致しているか（末尾の `/` に注意） |
| LIFF が開かない | ミニアプリの「開発用」エンドポイント URL が HTTPS の Amplify URL か。`VITE_LIFF_ID` が「開発用」の LIFF ID か。自分がチャネルの権限設定に入っているか |
| sunabar が 401 | `SUNABAR_ACCESS_TOKEN` の値と、個人口座のトークンか（法人ではない） |
