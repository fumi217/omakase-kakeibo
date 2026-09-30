# Tasks: 家計簿ダッシュボード（LINE で見る、銀行明細の自動家計簿）

**Input**: Design documents from `/specs/001-kakeibo-dashboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 外部 API に依存しない純粋な関数（月の変換・集計・カテゴリ判定・予算判定）だけテストを書く（constitution IV / research R-012）。

**Organization**: ユーザーストーリーごとにフェーズを分け、各タスクを **PR グループ（= GitHub Issue 1 つ = ブランチ 1 つ = PR 1 つ、差分 500 行以内）**にまとめる。

## Format: `[ID] [P?] [Story] 【担当】説明 ファイルパス`

- **[P]**: 並行して進められる（別ファイル・未完了タスクに依存しない）
- **[Story]**: 対応するユーザーストーリー（US1〜US4）
- **【担当】**: 【A】@fumi217 ／【B】@masuda-yu1019 ／【A+B】2 人で
- **PR グループ見出し**: `### <グループ ID> …（Issue #__）`。Issue 番号は Issue 作成後に書き戻す

## Path Conventions

- backend: `backend/src/`, `backend/tests/`
- frontend: `frontend/src/`

---

## コンフリクトを防ぐ約束（必ず守る）

1. **土台 PR（Phase 2）が先**。マージされるまで、A も B も共有ファイルに手を付けない
2. **1 ファイル 1 担当**（担当表は [plan.md「ファイル単位の担当」](./plan.md#ファイル単位の担当)）。相手のファイルを直したいときは Issue / PR コメントで依頼する
3. **API の処理は `backend/src/routes/*.js` に書く**。`backend/src/handlers/api.js` のルート表は土台で全部登録し、以後は変えない（変えるなら 2 人で合意）
4. **依存の追加は単独の小さな PR** にしてすぐマージする。相手は `git pull` → `docker compose down -v && docker compose build`。ロックファイルは `node_modules` のない使い捨てコンテナで生成する（CLAUDE.md・#17）。**backend の依存は A、frontend の依存は B** が追加する
5. **データの形（data-model.md / contracts / Monthly Summary）を変えるときは、spec の PR を先に**出して 2 人で合意する
6. **作業開始時と PR を出す前に `main` を pull**。PR は小さく（500 行以内）、その日のうちにレビュー・マージする

---

## Phase 1: Setup（完了済み）

- [x] T001 【B】Docker 開発環境（compose.yaml・backend/frontend の Dockerfile・ローカルサーバー）（#10）
- [x] T002 【B】package-lock.json の追加と全プラットフォーム対応（#13・#17）
- [x] T003 【A+B】Claude Code / GitHub の共有設定・秘密情報ガード・pre-commit（#5・#6・#9）
- [x] T004 【B】LIFF を LINE ミニアプリで作る方針に仕様書を更新（#15）

---

## Phase 2: Foundational — 土台（スケルトン）

**Purpose**: 共有ファイルを「最終的な関数の形＋仮の実装（スタブ）」で先に作り、以後は 1 ファイル 1 担当にする

**⚠️ CRITICAL**: この PR がマージされるまで Phase 3 以降に着手しない

### S0 土台（Issue #21）【B】作成・【A】レビュー

- [x] T005 【B】`POST /webhook` を webhook ハンドラー、それ以外を api ハンドラーに振り分ける backend/local/server.js
- [x] T006 [P] 【B】200 を返すだけの Webhook スタブ（以後の担当 A）backend/src/handlers/webhook.js
- [x] T007 【B】ルート表に `/api/health`・`/api/summary`・`/api/transactions`・`/mock/categorize`・`/mock/budget`・`/mock/unified-accounts` を全部登録し、処理は routes に委譲 backend/src/handlers/api.js
- [x] T008 [P] 【B】各ルートのスタブ（501 `NOT_IMPLEMENTED`、`/api/summary` だけ fixture を返す）backend/src/routes/{summary,transactions,mockCategorize,mockBudget,mockUnifiedAccounts}.js
- [x] T009 [P] 【B】`parseMonth("YYYY-MM")` → 日本時間の `{ from, to }`（形式不正は `INVALID_MONTH`）、`currentMonth(now)`・`previousMonth(month)`（Lambda は UTC なので日本時間で計算。月初 0〜9 時のずれに注意）（本実装＋テスト。以後の担当 A）backend/src/lib/month.js・backend/tests/unit/month.test.js
- [x] T010 [P] 【B】`buildMonthlySummary(month, transactions, budgets, now = new Date())`（純粋関数）と、**集計の入口を 1 つにまとめた `getMonthlySummary(month, now = new Date())`**（明細の取得 → 予算の取得 → 集計。Webhook と `routes/summary.js` の両方がこれだけを呼ぶ）のスタブ（fixture を返す。以後の担当 A）backend/src/services/summary.js・backend/tests/fixtures/summary.sample.json
- [x] T011 [P] 【B】`fetchTransactions(accountId, from, to)` のスタブ（空配列。以後の担当 A）backend/src/services/sunabar.js
- [x] T012 [P] 【B】`getTransactions(month)` = sunabar の結果を返すだけ（以後の担当 B）backend/src/services/transactions.js
- [x] T013 [P] 【B】スタブ: `categorize()` は常に `{ category: "その他", merchant: null, matchedKeyword: null }`（担当 B）、`getBudgets()` は空（担当 A）、`getUnifiedAccounts(unifiedId, month)` は空（担当 B）backend/src/mock/{categorize,budget,unifiedAccounts}.js
- [x] T014 【B】画面の骨組み（`SummaryCards`・`MonthSwitcher`・`CategoryPieChart`・`DailyBarChart`・**`BudgetList`**・`TransactionList` を配置。各コンポーネントは空のスタブ。`BudgetList.jsx` の担当は A）frontend/src/App.jsx・frontend/src/components/*.jsx
- [x] T015 [P] 【B】`getSummary(month)`・`getTransactions(month, category)` frontend/src/api/client.js
- [x] T016 【B】Project Structure に `backend/src/routes/` を追加、ファイル単位の担当表と整合を確認 specs/001-kakeibo-dashboard/plan.md

### A0 公式アカウント「家計簿」と Messaging API（Issue #43）【A】— **土台と並行してよい**

- [x] T056 [P] 【A】@fumi217 のプロバイダーに公式アカウント「家計簿」を作成し、Messaging API を有効化（応答メッセージはオフ）— コードの変更なし
- [x] T057 [P] 【A】Messaging API とミニアプリの両チャネルの権限設定に @masuda-yu1019 を追加 — コードの変更なし
- [x] T058 【A】ミニアプリのチャネルと公式アカウントを連携（友だち追加の案内）— コードの変更なし

> 土台（S0）を待つ間、A は **A0** と **T017**（Postman で sunabar の実レスポンスを fixture に保存）を進めてよい。どちらも共有ファイルに触れない。

**Checkpoint**: `docker compose up` で両方起動、登録済みのルートが 501（`/api/summary` は fixture）を返し、画面に骨組みが出る → A と B が並行開発を開始

---

## Phase 3: User Story 1 - LINE で今月の支出サマリー（Priority: P1）🎯 MVP 【A】

**Goal**: LINE で「今月」「先月」と送ると、入金・支出合計とカテゴリ上位 3 つのカードが返る

**Independent Test**: sunabar に入出金がある状態で「今月」と送り、金額が sunabar の明細と一致する（spec US1 シナリオ 1〜4）

### A1 sunabar の入出金明細を取得する（Issue #22）

- [x] T017 【A】sunabar の入出金明細 API の実レスポンスを Postman で確認し、口座番号をダミーにして保存（research R-003 の「要確認」を確定）backend/tests/fixtures/sunabar-transactions.sample.json
- [x] T018 【A】`fetch`・`res.ok` の確認・`hasNext` / `nextItemKey` で続きを取得（最大 5 回で打ち切りログ）、Transaction への変換（`id`=`sunabar:{itemKey}`、`transactionType` "1"→income / "2"→expense、金額は `Number()`、`categorize()` でカテゴリ、`isInternalTransfer`）、タイムアウト / エラーを `BANK_API_UNAVAILABLE` / `BANK_API_ERROR` に変換。入金（income）は `categorize()` を呼ばずカテゴリ `"入金"`（data-model）。sunabar の呼び出しは `AbortSignal.timeout(8000)`（起動直後の 1 回目の実測にもとづき 4 秒から変更。research R-003）（LINE への応答 5 秒以内 SC-001 のため）backend/src/services/sunabar.js
- [x] T019 [P] 【A】fixture を使った変換のテスト backend/tests/unit/sunabar.test.js

### A2 月次サマリーを集計する（Issue #23）

- [x] T020 【A】data-model.md どおりに実装: 振替（`isInternalTransfer`）を除外、`totalIncome` / `totalExpense`、カテゴリ別は支出の多い順、`ratio` は小数第 3 位で四捨五入、`daily` は 0 円の日も含む（今月は今日まで）、`sources`、`generatedAt`（+09:00）。「今日」は引数の `now` を使う。`getMonthlySummary` は `getTransactions(month)` → `getBudgets(month)` → `buildMonthlySummary(...)` の順に呼ぶ backend/src/services/summary.js
- [x] T021 [P] 【A】集計のテスト（0 件の月・振替除外・並び順・ratio・daily。`now` を固定して日付に依存しない）backend/tests/unit/summary.test.js

### A3 backend に @line/bot-sdk を追加する（Issue #24）

- [x] T022 【A】`@line/bot-sdk` を追加し、ロックを使い捨てコンテナで生成 backend/package.json・backend/package-lock.json

### A4 Webhook と Flex Message（Issue #25）

- [x] T023 【A】署名検証（失敗は 401）、`message`/`text` イベントのみ処理、検証リクエストは 200、コマンド「今月・今月の支出・先月・ダッシュボード・その他（使い方）」、エラー時の返信（contracts/line-bot.md）。集計は `getMonthlySummary(currentMonth(now) / previousMonth(...))` だけを呼ぶ。⚠️ 関数 URL では `event.body` が base64（`isBase64Encoded: true`）で届くことがあるので、署名検証はデコードした**生の本文**で行う backend/src/handlers/webhook.js
- [x] T024 [P] 【A】Monthly Summary → Flex Message（上位 3 件、0 件の本文、`altText`、`LIFF_URL` のボタン）backend/src/services/flexMessage.js

### A5 Bot のデプロイ（Issue #26）

- [x] T025 【A】Lambda 用 zip を作るスクリプトと `npm run package`（B の `kakeibo-api` でも使う）backend/scripts/package.sh・backend/package.json
- [x] T026 【A】Lambda `kakeibo-webhook`（Node.js 22.x・タイムアウト 30 秒・環境変数）、Webhook URL の設定と検証、リッチメニュー 3 ボタン（quickstart 4-1・4-3）— コードの変更なし

**Checkpoint**: LINE で「今月」「先月」「あいうえお」に正しく返信（quickstart P1・P2）

---

## Phase 4: User Story 2 - LINE 内のダッシュボード（Priority: P2）【B】

**Goal**: リッチメニューから LINE 内で画面が開き、カテゴリ別の円グラフ・日別グラフ・明細一覧を見られる。月切替・カテゴリ絞り込みができる

**Independent Test**: ダッシュボードの金額が US1 の LINE カードと一致し、月切替・絞り込みが動く（spec US2 シナリオ 1〜5）

### B1 frontend に LIFF を追加する（Issue #29）

- [x] T027 【B】`@line/liff`（dependencies）・`@line/liff-mock`（devDependencies）を追加し、ロックを使い捨てコンテナで生成 frontend/package.json・frontend/package-lock.json

### B2 LIFF を初期化して表示名を出す（Issue #19）

- [x] T028 【B】LIFF の初期化（Mock 切替・二重初期化防止・未ログイン時の案内・エラー表示）frontend/src/liff.js
- [x] T029 【B】「○○さんの家計簿」のヘッダーを骨組みに組み込む frontend/src/components/LiffHeader.jsx・frontend/src/App.jsx

### B3 Amplify に公開して LINE で開く（Issue #30）

- [x] T030 【B】本番ビルド → zip → Amplify（東京）に公開 → ミニアプリ「開発用」のエンドポイント URL を差し替え → LINE で開いて表示名を確認（quickstart 4-2）— コードの変更なし

### B4 支出カテゴリ判定 API（Issue #31）

- [x] T031 【B】判定ルール（data-model.md の Category Rule。上から評価・全角/半角カナと大文字小文字を正規化）backend/src/mock/data/category-rules.json・backend/src/mock/categorize.js
- [x] T032 [P] 【B】`GET /mock/categorize?description=`（`x-mock-api: true` ヘッダー）backend/src/routes/mockCategorize.js
- [x] T033 [P] 【B】判定のテスト backend/tests/unit/categorize.test.js

### B5 ダッシュボード API（Issue #32）

- [x] T034 【B】`GET /api/summary?month=`（`parseMonth` で検証 → `getMonthlySummary(month)` を呼ぶだけ。集計の手順は書かない。エラーは contracts の形式）backend/src/routes/summary.js
- [x] T035 [P] 【B】`GET /api/transactions?month=&category=`（新しい順・カテゴリ絞り込み）backend/src/routes/transactions.js

### B6 frontend にグラフライブラリを追加する（Issue #33）

- [x] T036 【B】`recharts` を追加し、ロックを使い捨てコンテナで生成 frontend/package.json・frontend/package-lock.json

### B7 合計と月切替（Issue #34）

- [x] T037 【B】月次サマリーの取得（読み込み中・エラー）frontend/src/hooks/useMonthlySummary.js
- [x] T038 [P] 【B】入金・支出合計 frontend/src/components/SummaryCards.jsx
- [x] T039 [P] 【B】前の月 / 次の月 frontend/src/components/MonthSwitcher.jsx

### B8 グラフ（Issue #35）

- [ ] T040 【B】カテゴリ別の円グラフ（選択で絞り込み）frontend/src/components/CategoryPieChart.jsx
- [ ] T041 [P] 【B】日別の支出グラフ frontend/src/components/DailyBarChart.jsx

### B9 明細一覧（Issue #36）

- [ ] T042 【B】明細一覧（日付・内容・金額・カテゴリ・出どころ、新しい順、絞り込み・解除、0 件の表示）frontend/src/components/TransactionList.jsx

### B10 ダッシュボード API のデプロイ（Issue #37）

- [ ] T043 【B】Lambda `kakeibo-api`（A5 の `npm run package` を使う、関数 URL の CORS を Amplify に限定）→ `VITE_API_BASE_URL` を設定して Amplify を再公開（quickstart 4-1・4-2）— コードの変更なし

**Checkpoint**: リッチメニューからダッシュボードが開き、金額が LINE カードと一致（quickstart P3）

---

## Phase 5: User Story 3 - 予算と使いすぎ（Priority: P3）【A】

**Goal**: カテゴリごとの予算に対する使用率を表示し、80% 以上は注意・100% 超は超過として目立たせる

**Independent Test**: 食費予算 30,000 円で支出 27,000 円 →「注意（90%）」、31,000 円 →「超過（103%）」（spec US3）

### A6 予算 API と集計への反映（Issue #27）

- [x] T044 【A】予算データと `getBudgets(month)`（`default` と月ごとの上書き）backend/src/mock/data/budgets.json・backend/src/mock/budget.js
- [x] T045 [P] 【A】`GET /mock/budget?month=`（`x-mock-api: true`）backend/src/routes/mockBudget.js
- [x] T046 【A】`buildMonthlySummary` でカテゴリ別の `budget` / `usage` / `status`（usage < 0.8 → normal、0.8 ≤ usage ≤ 1.0 → warning、1.0 < usage → over、予算なしは null）＋テスト backend/src/services/summary.js・backend/tests/unit/summary.test.js

### A7 予算の表示（Issue #28）

- [ ] T047 【A】Flex Message に超過額の行（FR-032）backend/src/services/flexMessage.js
- [ ] T048 [P] 【A】予算の使用率の一覧（注意・超過の表示）frontend/src/components/BudgetList.jsx

**Checkpoint**: 画面と LINE カードに予算の超過が出る（quickstart P4）

---

## Phase 6: User Story 4 - 統一 ID で他の金融機関も合算（Priority: P4）【B】

**Goal**: ダミーの他の金融機関の明細を sunabar と合算し、出どころを表示する

**Independent Test**: `UNIFIED_ID_ENABLED=true` でダミーのカード明細が合算され、出どころのラベルが付く（spec US4）

### B11 統一 ID 他行明細 API と合算（Issue #38）

- [ ] T049 【B】ダミー明細（`{{MONTH}}` を対象月に置換。実在の会社名は使わない）と取得関数 backend/src/mock/data/unified-accounts.json・backend/src/mock/unifiedAccounts.js
- [ ] T050 [P] 【B】`GET /mock/unified-accounts?unifiedId=&month=`（`x-mock-api: true`）backend/src/routes/mockUnifiedAccounts.js
- [ ] T051 【B】`UNIFIED_ID_ENABLED` のとき他行明細を Transaction に変換して合算（`categorize()`・`source`）backend/src/services/transactions.js

### B12 出どころの表示（Issue #39）

- [ ] T052 【B】明細一覧に出どころのラベル frontend/src/components/TransactionList.jsx

**Checkpoint**: quickstart P5

---

## Phase 7: Polish & 発表準備【A+B】

### X1 デモの準備と最終確認（Issue #40）

- [ ] T053 【A+B】sunabar でデモ用の入出金を 10〜20 件作成（入金シミュレーター・振込。振込先名はカテゴリ判定ルールに合わせる）— コードの変更なし
- [ ] T054 【A+B】quickstart の L1〜L7・P1〜P5 を通しで確認し、デモ台本（3 分）を作る specs/001-kakeibo-dashboard/quickstart.md

### X2 README と発表資料（Issue #41）

- [ ] T055 【A+B】起動方法・構成・自作 API（カテゴリ判定・予算・統一 ID）の説明と「本番では必要なこと」（本人確認など）README.md

**Deadline**: Day5 12:00 コードフリーズ

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2（土台）**: Phase 1 完了済み → すぐ着手。**Phase 3 以降のすべてをブロック**（例外: A0 と T017 は共有ファイルに触れないので土台と並行してよい）
- **Phase 3（A）と Phase 4（B）**: 土台マージ後に**完全に並行**
- **Phase 5（A）**: A2（集計）完了後。A7 の `BudgetList.jsx` は B7 の画面ができてから確認しやすい
- **Phase 6（B）**: B5（API）完了後
- **Phase 7**: 各ストーリー完了後

### グループ間の依存

- A0（土台と並行）→ A5、A1 → A2 → A4（A3 は A4 の前ならいつでも）→ A5
- B1 → B2 → B3（Amplify 公開は B2 の後ならいつでも）
- B4 は土台の後ならいつでも（A1 の `categorize()` はスタブのままで進められる）
- B5 → B7 → B8・B9（B6 は B8 の前）→ B10（**A5 の `npm run package` が必要**）
- A6 → A7、B11 → B12

### 相手を待たずに進めるための仮置き

| 待ちたくなる相手の成果 | 仮に使うもの |
|---|---|
| B が A の集計（A2）を待つ | 土台の `summary.js` スタブが返す fixture（contracts/api.md の例） |
| A が B のカテゴリ判定（B4）を待つ | 土台の `categorize()` スタブ（すべて「その他」） |
| A7 の `BudgetList.jsx` が B の画面（B7）を待つ | 土台の骨組みで `App.jsx` に組み込み済み。fixture の `categories[].budget` で表示確認 |

---

## Parallel Example: 土台マージ直後

```text
A: A1 sunabar の明細取得（services/sunabar.js）
B: B1 → B2 LIFF（frontend/）、並行して B4 カテゴリ判定（mock/categorize.js）
→ 触るファイルが重ならないので同時に PR を出せる
```

---

## Implementation Strategy

### MVP First（US1）

1. 土台（Phase 2）をマージ
2. A: US1（A1〜A5）→ LINE で「今月」が動けば、画面が間に合わなくても発表できる
3. B: 並行して US2（B1〜B10）

### Incremental Delivery

- US1 → US2 → US3 → US4 の順に、各ストーリーの Checkpoint で動作確認してから次へ
- 期限（Day5 12:00）を超えそうなら、途中まで作らず次の優先度ごと切り捨てる（constitution I）

---

## Notes

- T056〜T058（A0）はレビューで追加したため番号が後ろにある
- 1 PR グループ = 1 Issue = 1 ブランチ = 1 PR。差分は 500 行以内が目安、1,000 行を超えない（依存追加の PR はロックファイルのため超えることがあり、PR 本文にその旨を書く）
- コミットと PR のタイトルに Issue 番号を入れる。PR を出したら `@aitutor-review review`
- 「コードの変更なし」のタスクも Issue で管理し、完了したら動作確認の結果を Issue にコメントして閉じる
