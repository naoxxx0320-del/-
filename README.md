# Aroma Jewels — メンズエステ サイト（TOPページ）

men's esthetic「Aroma Jewels（アロマジュエルズ）」の TOP ページを、参考デザイン（PDF）と
参考コンテンツ（ハンバーガーメニューの写真）に合わせて忠実に再現したものです。
**まずはレイアウト・デザインの再現を最優先**に構築しています。

## 技術構成

- Next.js 14 (App Router) / React 18
- スタイルは `app/globals.css` に集約したデザインシステム
- 実写真は使用せず、プレースホルダー（CSS グラデーション／装飾）で再現
- エレガントな明朝体・セリフ体は Google Fonts を段階的読み込み（未取得時はシステム明朝にフォールバック）

## 実装済み（TOPページ）

- ヘッダー：薔薇背景・Aroma Jewels エンブレム・エリア表記・ハンバーガーボタン
- ナビグリッド（8ボタン：和文＋英字サブ）
- ヒーローコラージュ（「宝石のように美しいセラピスト達」／ロゴ／キャッチ）
- キャンペーンバナー横スクロール帯
- NEWS 装飾フレーム（金の角飾り）
- セクションバンド（Today's Therapist）
- セラピストカード（写真＋ハート／出勤リボン／新人バッジ／SNSバッジ／
  ステータス／2×2スペック／出勤時間パネル／空き状況バー）×2名
- 固定フッターバー（Tel／LINE予約／WEB予約）・AiChat・トップへ戻る
- ハンバーガー展開メニュー（メニュー一覧／CREDIT・PayPay決済／各SNS／電話・営業時間）

## 開発

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 本番ビルド
```

## GitHub Pages 公開

`main` ブランチへの push で、GitHub Actions が静的書き出し（`out/`）を
GitHub Pages へ自動デプロイします（`.github/workflows/deploy.yml`）。

- 公開URL: **https://naoxxx0320-del.github.io/-/**
- 手動実行: リポジトリの **Actions** タブ → 「Deploy to GitHub Pages」→ Run workflow
- 初回は Actions が Pages を自動で有効化します（Source は「GitHub Actions」）。
  自動有効化されない場合は **Settings → Pages → Build and deployment → Source = GitHub Actions** を選択。

> リポジトリ名が `-` のため、公開は URL サブパス `/-/` 配下になります。
> `next.config.mjs` は CI（`GITHUB_PAGES=true`）でのみ `basePath` を付与するため、
> ローカルの `npm run dev` はそのままルートで動作します。

ローカルで公開版と同じ静的出力を確認する場合:

```bash
GITHUB_PAGES=true npm run build   # ./out に生成
npx serve out                     # 例: 簡易サーバーで確認
```

## 今後

トップ以外のページ（出勤情報・セラピスト・料金システム・アクセス・外国人の方へ・各求人）、
実写真・実データの反映は次フェーズで対応予定。
