# Data Model: 家計簿ダッシュボード

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

データベースは使わない（[research R-010](./research.md#r-010-データ保存)）。ここでは、バックエンド内部とAPIレスポンスで扱うデータの形を定義する。金額はすべて**整数（円）**で扱う（sunabar は文字列で返すため、取得直後に数値へ変換する）。日付は**日本時間**の `YYYY-MM-DD`。

---

## Transaction（明細）

sunabar と他の金融機関（ダミー）の明細を、この形にそろえてから集計する。

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | string | ✅ | 明細を一意に識別する ID。sunabar は `sunabar:{itemKey}`、他行は `{institutionId}:{元ID}` |
| `date` | string | ✅ | 取引日 `YYYY-MM-DD` |
| `type` | `"income"` \| `"expense"` | ✅ | 入金 / 支出。sunabar の `transactionType` が `1` なら income、`2` なら expense |
| `amount` | number | ✅ | 金額（正の整数、円） |
| `description` | string | ✅ | 内容（摘要）。sunabar の `remarks` |
| `category` | string | ✅ | カテゴリ（下記 Category の値）。income の場合は `"入金"` |
| `source` | object | ✅ | 出どころ `{ id: "sunabar" \| institutionId, name: "sunabar" \| 金融機関名, kind: "bank" \| "card" \| "qr" }` |
| `isInternalTransfer` | boolean | ✅ | 自分の口座間の振替なら true（集計から除外。FR-004） |

**Validation**
- `amount` > 0
- `date` は対象月の範囲内
- `isInternalTransfer === true` の明細は Monthly Summary の合計・内訳・日別に含めない（明細一覧には「振替」として表示してよい）

**sunabar レスポンスからの変換**（項目名は research R-003 の「要確認」を参照）

```text
sunabar                 → Transaction
transactionDate         → date
transactionType "1"/"2" → type "income"/"expense"
amount "30000"          → amount 30000
remarks                 → description（＋ category 判定の入力）
itemKey                 → id "sunabar:{itemKey}"
```

---

## Category（カテゴリ）

固定の列挙値。表示順もこの順。

```text
食費 / 日用品 / 交通 / 住居 / 通信 / 娯楽 / 振込 / 現金 / その他
```

- `振込`: 振込先名からルールで判定できなかった振込
- `現金`: ATM 出金など
- `その他`: どのルールにも一致しない支出（FR-006）

---

## Category Rule（カテゴリ判定ルール）

`backend/src/mock/data/category-rules.json`。上から順に評価し、最初に一致したルールのカテゴリを採用する。

| フィールド | 型 | 説明 |
|---|---|---|
| `keywords` | string[] | 摘要に含まれていれば一致とみなす文字列。**全角・半角カナ、大文字小文字の違いは正規化してから比較**する |
| `category` | Category | 割り当てるカテゴリ |
| `merchant` | string（任意） | 表示用の店舗名（例: `ｾﾌﾞﾝ` → `セブン-イレブン`） |

例:

```json
[
  { "keywords": ["ｾﾌﾞﾝ", "ﾛｰｿﾝ", "ﾌｧﾐﾘｰﾏｰﾄ"], "category": "食費", "merchant": "コンビニ" },
  { "keywords": ["ﾔﾁﾝ", "ｶﾝﾘﾋ"], "category": "住居" },
  { "keywords": ["ATM"], "category": "現金" },
  { "keywords": ["ﾌﾘｺﾐ", "振込"], "category": "振込" }
]
```

---

## Budget（予算）

`backend/src/mock/data/budgets.json`。月ごとの指定がなければ `default` を使う。

| フィールド | 型 | 説明 |
|---|---|---|
| `default` | `{ [category]: number }` | 毎月共通の予算 |
| `months` | `{ ["YYYY-MM"]: { [category]: number } }`（任意） | 特定の月だけ上書きする予算 |

---

## Monthly Summary（月次サマリー）

`services/summary.js` が作る。LINE Bot とダッシュボードの**両方がこの同じ結果を表示する**（FR-027）。

| フィールド | 型 | 説明 |
|---|---|---|
| `month` | string | `YYYY-MM` |
| `totalIncome` | number | 入金合計 |
| `totalExpense` | number | 支出合計 |
| `categories` | CategoryBreakdown[] | 支出額の多い順 |
| `daily` | `{ date: string, expense: number }[]` | 月の 1 日〜末日（今月は今日まで）。支出 0 の日も含める |
| `transactionCount` | number | 集計対象の明細件数 |
| `sources` | `{ id, name, kind }[]` | 集計に含めた出どころの一覧 |
| `generatedAt` | string | 集計した日時（ISO 8601, +09:00） |

## CategoryBreakdown（カテゴリ別内訳）

| フィールド | 型 | 説明 |
|---|---|---|
| `category` | Category | カテゴリ名 |
| `amount` | number | 支出合計 |
| `ratio` | number | `amount / totalExpense`（0〜1、小数第 3 位で四捨五入） |
| `budget` | number \| null | 予算。未設定なら null |
| `usage` | number \| null | `amount / budget`（予算なしは null） |
| `status` | `"normal"` \| `"warning"` \| `"over"` \| null | usage < 0.8 → normal、0.8 ≤ usage ≤ 1.0 → warning、1.0 < usage → over。予算なしは null（FR-031） |

**状態遷移（status）**

```text
normal ──(使用率 80% 以上)──▶ warning ──(使用率 100% 超)──▶ over
```

---

## Linked Account（連携口座・統一 ID 構想）

`backend/src/mock/data/unified-accounts.json`（ダミーデータ）。

| フィールド | 型 | 説明 |
|---|---|---|
| `unifiedId` | string | 統一 ID（ダミー） |
| `accounts[].institutionId` | string | 金融機関 ID（例: `card-a`） |
| `accounts[].institutionName` | string | 表示名（例: `○○カード`）。**実在の会社名は使わない** |
| `accounts[].kind` | `"bank"` \| `"card"` \| `"qr"` | 種類 |
| `accounts[].transactions[]` | `{ id, date, amount, description }` | 支出明細。`date` は `"{{MONTH}}-05"` のように書き、取得時に対象月へ置き換えてどの月でもデモできるようにする |
