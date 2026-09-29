# API Contract: kakeibo-api（ダッシュボード API ＋ 自作 API）

**Feature**: [spec.md](../spec.md) | **Data Model**: [data-model.md](../data-model.md)

Lambda `kakeibo-api` の関数 URL で公開する HTTP API。フロントエンド（LIFF 画面）と、発表時のデモから呼ばれる。

- **Base URL**: 本番 `https://xxxxxxxx.lambda-url.ap-northeast-1.on.aws` ／ ローカル `http://localhost:3000`
- **認証**: なし（講座のグランドルールにより省略。本番では LIFF の ID トークンを検証する想定で、発表で言及する）
- **CORS**: `ALLOWED_ORIGIN` のオリジンのみ許可。メソッドは `GET` のみ
- **形式**: レスポンスは `application/json; charset=utf-8`
- **金額**: 整数（円）。**日付**: 日本時間

## 共通エラー形式

```json
{ "error": { "code": "BANK_API_UNAVAILABLE", "message": "銀行とつながりませんでした。少し時間をおいて試してください" } }
```

| HTTP | code | 発生条件 |
|---|---|---|
| 400 | `INVALID_MONTH` | `month` が `YYYY-MM` 形式でない |
| 400 | `INVALID_PARAMETER` | その他のパラメータ不正 |
| 404 | `NOT_FOUND` | 存在しないパス |
| 502 | `BANK_API_ERROR` | sunabar がエラーを返した（認証エラー含む。詳細はログのみに出力し、レスポンスにトークン等を含めない） |
| 504 | `BANK_API_UNAVAILABLE` | sunabar がタイムアウト |

---

## 1. ダッシュボード API（本体）

### GET `/api/summary`

月次サマリーを返す（US1・US2・US3）。LINE Bot も内部で同じ処理を使う。

| Query | 必須 | 例 | 説明 |
|---|---|---|---|
| `month` | ✅ | `2026-10` | 対象月 |

**200 OK**

```json
{
  "month": "2026-10",
  "totalIncome": 300000,
  "totalExpense": 45000,
  "transactionCount": 7,
  "categories": [
    { "category": "住居", "amount": 30000, "ratio": 0.667, "budget": 30000, "usage": 1.0, "status": "warning" },
    { "category": "食費", "amount": 12000, "ratio": 0.267, "budget": 30000, "usage": 0.4, "status": "normal" },
    { "category": "その他", "amount": 3000, "ratio": 0.067, "budget": null, "usage": null, "status": null }
  ],
  "daily": [
    { "date": "2026-10-01", "expense": 0 },
    { "date": "2026-10-02", "expense": 30000 }
  ],
  "sources": [ { "id": "sunabar", "name": "sunabar", "kind": "bank" } ],
  "generatedAt": "2026-10-02T10:00:00+09:00"
}
```

明細 0 件の月は `totalIncome: 0`, `totalExpense: 0`, `categories: []`, `transactionCount: 0` を返す（エラーにしない）。

### GET `/api/transactions`

明細一覧を新しい順で返す（US2）。

| Query | 必須 | 例 | 説明 |
|---|---|---|---|
| `month` | ✅ | `2026-10` | 対象月 |
| `category` | | `食費` | 指定時はそのカテゴリのみ（URL エンコードする） |

**200 OK**

```json
{
  "month": "2026-10",
  "items": [
    {
      "id": "sunabar:0000000123",
      "date": "2026-10-02",
      "type": "expense",
      "amount": 30000,
      "description": "ﾌﾘｺﾐ ﾔﾁﾝ",
      "category": "住居",
      "source": { "id": "sunabar", "name": "sunabar", "kind": "bank" },
      "isInternalTransfer": false
    }
  ]
}
```

---

## 2. 自作 API（「銀行がこういう API を提供してくれたら」という提案）

`/mock/*` 配下。**実在の銀行 API ではない**ことをレスポンスの `x-mock-api: true` ヘッダーでも明示する。Day5 の発表で実際に呼び出して見せる。

### GET `/mock/categorize`

支出カテゴリ判定 API。明細の内容からカテゴリと店舗名を推定する。

| Query | 必須 | 例 |
|---|---|---|
| `description` | ✅ | `ｾﾌﾞﾝｲﾚﾌﾞﾝ ｼﾌﾞﾔ` |

```json
{ "description": "ｾﾌﾞﾝｲﾚﾌﾞﾝ ｼﾌﾞﾔ", "category": "食費", "merchant": "コンビニ", "matchedKeyword": "ｾﾌﾞﾝ" }
```

一致しない場合は `"category": "その他", "merchant": null, "matchedKeyword": null`。

**発表での提案ポイント**: 本来は銀行・カード会社が加盟店コードを持っており、明細に「業種」を付けて返せば、利用者側での推測は不要になる。

### GET `/mock/budget`

予算 API。

| Query | 必須 | 例 |
|---|---|---|
| `month` | ✅ | `2026-10` |

```json
{ "month": "2026-10", "budgets": { "食費": 30000, "住居": 30000, "交通": 10000 } }
```

**発表での提案ポイント**: 銀行アプリで設定した予算を API で取得できれば、どの家計簿アプリでも同じ予算を使える。

### GET `/mock/unified-accounts`

統一 ID 他行明細 API（US4）。統一 ID に紐づくすべての金融機関の明細を返す。

| Query | 必須 | 例 |
|---|---|---|
| `unifiedId` | ✅ | `demo-user-0001` |
| `month` | ✅ | `2026-10` |

```json
{
  "unifiedId": "demo-user-0001",
  "month": "2026-10",
  "accounts": [
    {
      "institutionId": "card-a",
      "institutionName": "○○カード",
      "kind": "card",
      "transactions": [
        { "id": "card-a:1", "date": "2026-10-05", "amount": 680, "description": "ｾﾌﾞﾝｲﾚﾌﾞﾝ" }
      ]
    }
  ]
}
```

**発表での提案ポイント**: 国主導の統一 ID があれば、利用者が銀行・カードごとに連携設定をしなくても、全資産・全支出を 1 か所で把握できる。
