# LINE 自動応答＋自動予約 bot 設定手順

`line-booking.gs` を Google Apps Script に貼り付けて、LINE のトーク上で
**自動応答・自動予約**（予約は既存の出勤スプレッドシートと同じブックに記録）を
動かすための手順です。サイト（GitHub Pages）とは独立して動作します。

## 全体像

```
LINE公式アカウント（Messaging API）
   │ Webhook（メッセージ/ボタン操作）
   ▼
Google Apps Script（line-booking.gs / ウェブアプリ）
   │ 出勤情報を読む＋予約を書き込む
   ▼
Googleスプレッドシート（出勤情報／「LINE予約」タブ）
```

## 1. Messaging API チャネルを用意（既存のLINE公式アカウントに紐付け）

1. [LINE Developers Console](https://developers.line.biz/console/) にログイン
2. プロバイダーを作成（無ければ）→ **Messaging API チャネル**を作成し、既存の公式アカウントに紐付け
   - すでに公式アカウントがある場合は「LINE Official Account Manager → 設定 → Messaging API」から有効化でもOK
3. 取得するもの：
   - **チャネルアクセストークン（長期）**：Messaging API 設定タブで発行
   - **チャネルシークレット**：チャネル基本設定タブ
4. LINE Official Account Manager → **応答設定** で
   - 「応答メッセージ」＝オフ、「Webhook」＝オン、「あいさつメッセージ」＝任意

## 2. スプレッドシートID を確認

出勤情報が入っているスプレッドシートを開き、URL の `/d/` と `/edit` の間の文字列がID：
`https://docs.google.com/spreadsheets/d/【ここがID】/edit`

## 3. Apps Script を作成

1. 同じスプレッドシートから **拡張機能 → Apps Script**（または script.google.com で新規プロジェクト）
2. `line-booking.gs` の中身を貼り付けて保存
3. **プロジェクトの設定 → スクリプト プロパティ** に以下を追加：

| プロパティ名 | 値 |
| --- | --- |
| `LINE_CHANNEL_ACCESS_TOKEN` | 手順1のアクセストークン |
| `LINE_CHANNEL_SECRET` | 手順1のシークレット |
| `SHEET_ID` | 手順2のスプレッドシートID |
| `OWNER_EMAIL` | 予約通知の送り先メール（任意・空でも可） |

## 4. ウェブアプリとしてデプロイ

1. **デプロイ → 新しいデプロイ → 種類「ウェブアプリ」**
2. 説明：任意／実行するユーザー：**自分**／アクセスできるユーザー：**全員**
3. デプロイ → 権限を承認 → 発行された **ウェブアプリURL（/exec）** をコピー

## 5. Webhook URL を設定

1. LINE Developers Console → Messaging API 設定 → **Webhook URL** に手順4のURLを貼る
2. **「検証」** を押して成功すること／**「Webhookの利用」をON**

## 6. 動作確認

公式アカウントを友だち追加し、トークで送信：

- 「予約」 → 日付 → セラピスト → 時間 → コース → お名前 → 確認 → 完了
- 「料金」「本日」「アクセス」「電話」でも自動応答
- 予約するとスプレッドシートに **「LINE予約」タブ**が自動作成され、内容が記録されます
  （`OWNER_EMAIL` 設定時は通知メールも届きます）

## カスタマイズ

- **コース内容**：`line-booking.gs` 上部の `COURSES` を編集（サイトの `data/reserve-config.json` と揃える）
- **予約の重複防止**：現状は「LINE予約」タブ内で同一セラピスト・日時をチェック。
  WEB予約とLINE予約を**同じタブ**に統一したい場合は `RESERVE_SHEET` をWEB側の予約タブ名に変更し、
  列順（受付/経路/…/セラピスト/…/状態）を合わせてください。
- **リッチメニュー**（画面下の固定メニュー）：LINE Official Account Manager から画像付きで作成し、
  各ボタンのアクションを「テキスト送信：予約」等にすると、タップで各機能に繋がります。

## 注意

- **業種審査／規約**：メンズエステ業態は LINE公式アカウント・Messaging API の利用規約で
  制限・審査対象となる場合があります。開設前にLINE側の規約をご確認ください。
- 無料プランはメッセージ通数に上限があります（超過分は有料 or 上位プラン）。
- 署名検証（なりすまし対策）を厳格に行いたい場合は、Apps Script ではなく
  Cloud Functions / Vercel 等のサーバーでの運用を推奨します（本スクリプトは簡易運用向け）。
