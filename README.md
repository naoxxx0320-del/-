# AROMA DAIAMOND — メンズエステ サイト（TOPページ）

men's esthetic「AROMA DAIAMOND（アロマ ダイアモンド）／亀戸」の TOP ページを、
参考デザインに合わせて構築したものです。
**まずはレイアウト・デザインの再現を最優先**に構築しています。

## 技術構成

- Next.js 14 (App Router) / React 18
- スタイルは `app/globals.css` に集約したデザインシステム
- 実写真は使用せず、プレースホルダー（CSS グラデーション／装飾）で再現
- エレガントな明朝体・セリフ体は Google Fonts を段階的読み込み（未取得時はシステム明朝にフォールバック）

## 実装済み（TOPページ）

- ヘッダー：店舗バナー画像（public/hero-banner.jpg）・ハンバーガーボタン
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

## SEO・発見されやすさ（実装済み）

検索・SNSからの流入を増やすための土台を実装しています。

- **メタデータ**：`app/layout.jsx` に OGP（Open Graph）・Twitter カード・
  canonical・robots・keywords を集約。各ページはタイトルテンプレートで
  `ページ名｜AROMA DAIAMOND 亀戸` に統一。
- **構造化データ（JSON-LD）**：`app/_components/StructuredData.jsx`。
  店舗情報（`HealthAndBeautyBusiness`）＋サイト情報（`WebSite`）を出力。
  営業時間・エリア（東京都江東区亀戸）・コース料金（`data/reserve-config.json`
  から自動生成）を検索エンジンに認識させます。住所は方針によりエリアレベルまで。
- **sitemap.xml / robots.txt**：`app/sitemap.js` / `app/robots.js` で自動生成。
  `/secret` はクロール対象外。
- **サイト定数**：`app/_lib/site.js` に集約。独自ドメイン導入時は
  `ORIGIN` と `BASE_PATH` を書き換えれば全体（OGP・canonical・sitemap）に反映されます。

> 【注意】GitHub のプロジェクトページ（`/-/` 配下）では `robots.txt` を
> サイト直下に置けないため、検索エンジンには読まれません。生成物は
> 独自ドメイン導入後に有効になります。それまでは **sitemap.xml を
> Google Search Console から手動送信**してください
> （URL: `https://naoxxx0320-del.github.io/-/sitemap.xml`）。

## アクセス解析（GA4）

Google Analytics 4 のタグは `app/_components/Analytics.jsx` に実装済みで、
**測定ID が設定されているときだけ**出力されます（未設定時は無害）。

有効化の手順：

1. [Google アナリティクス](https://analytics.google.com/) でプロパティを作成し、
   測定ID（`G-XXXXXXXXXX`）を取得。
2. GitHub Actions のデプロイに環境変数として渡す
   （`.github/workflows/deploy.yml` のビルドステップに `NEXT_PUBLIC_GA_ID` を追加）。
   ローカル確認時は `NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX npm run dev` でも可。
3. 再デプロイすると計測が始まります。

## 運用・データ健全性（CI）

デプロイ前に `scripts/validate-data.mjs` が `data/*.json` を検証します
（GitHub Actions の「Validate data (health check)」ステップ）。

- **致命的な問題**（JSON構文エラー／`roster`・`courses` が空／必須配列欠落など）は
  ビルドを停止し、**直前の公開を維持**します（壊れたデータで上書き公開しない）。
- **警告**（写真未設定・名簿にない名前・案内状況の日付が古い等）はデプロイを止めず、
  Actions の**ジョブサマリー**に健全性レポートとして表示されます。

ローカルでも確認できます:

```bash
npm run validate-data
```

## 今後

アクセスページ、実写真・実データの反映、
予約・顧客体験の強化（予約カレンダーUI 等）は次フェーズで対応予定。
