# Googleビジネスプロフィールへの自動投稿（設定手順）

お知らせの記事が公開された日の17時以降に、その記事の「Google投稿用の文章」（`data/news.json` の `gbp`）を、Googleビジネスプロフィールの「最新情報」として1回だけ投稿します。

- スクリプト：`apps-script/gbp-autopost.gs`
- 予約管理システムとは**別の** Apps Script プロジェクトで動かします（予約・管理画面の権限設定は変えません）。
- APIキーや秘密の文字列は使いません。ビジネスプロフィールのオーナー（または管理者）の Google アカウントで実行し、そのアカウントの権限で投稿します。
- 記事のページがサイトに出ていることを確かめてから投稿します。出ていなければ1時間後にもう一度確かめます。
- 失敗した場合は1時間ごとに最大3回まで試します。3回とも失敗したら、その記事は自動では投稿しません（メールで知らせます）。

## 先に知っておくこと（Googleの承認）
ビジネスプロフィールのAPIは、Googleの利用承認がないと使えません。承認の条件（Google公式の案内）は次のとおりです。

- 確認済み（オーナー確認済み）のビジネスプロフィールを、**60日以上**運営していること
- Google Cloud のプロジェクトと、その「プロジェクト番号」
- お店のウェブサイト

申請の審査は、Googleの案内では14日以内です。承認されると、APIの割り当て（quota）が 0 から 300 QPM に変わります（0 のままなら未承認）。
承認されるまでは、この仕組みを設定しても投稿はできません。それまでは、毎日の投稿案を手作業でGoogleに投稿してください。

## 1. Google Cloud の準備
1. [Google Cloud コンソール](https://console.cloud.google.com/) で新しいプロジェクトを作ります。ダッシュボードの「プロジェクト情報」にある**プロジェクト番号**を控えます。
2. 「APIとサービス」→「OAuth 同意画面」を設定します（アプリ名・サポートメール）。
   公開ステータスは「本番環境」にしてください。「テスト」のままだと、承認（ログイン許可）が7日ほどで切れて投稿が止まることがあります。自分だけで使うので、Googleの審査（確認）は不要です。実行時に「確認されていないアプリ」と表示された場合は、「詳細」→「（アプリ名）に移動」で進めます。
3. [Business Profile API の申請フォーム](https://developers.google.com/my-business/content/prereqs) から、「Application for Basic API Access」を選んで申請します。ビジネスプロフィールのオーナーか管理者のメールアドレスで申請してください。
4. 承認されたら、「APIとサービス」→「ライブラリ」で次の3つを有効にします。
   - My Business Account Management API
   - My Business Business Information API
   - Google My Business API（投稿に使います）

## 2. Apps Script のプロジェクトを作る
ビジネスプロフィールのオーナー（または管理者）の Google アカウントで操作します。

1. [Apps Script](https://script.google.com/) で「新しいプロジェクト」を作ります（名前の例：GBP自動投稿）。
2. `コード.gs` の中身をすべて消して、`apps-script/gbp-autopost.gs` の内容を貼り付けます。
3. 左の「プロジェクトの設定」（歯車）で「『appsscript.json』マニフェスト ファイルをエディタで表示する」をオンにし、`appsscript.json` を次の内容に置き換えます。

```json
{
  "timeZone": "Asia/Tokyo",
  "runtimeVersion": "V8",
  "exceptionLogging": "STACKDRIVER",
  "oauthScopes": [
    "https://www.googleapis.com/auth/business.manage",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.scriptapp",
    "https://www.googleapis.com/auth/script.send_mail"
  ]
}
```

4. 同じ「プロジェクトの設定」の「Google Cloud Platform（GCP）プロジェクト」で「プロジェクトを変更」を押し、1で控えたプロジェクト番号を入れます。

## 3. 投稿先を決めて試運転する
1. エディタで関数 `gbpListLocations` を選んで「実行」します。初回は許可を求められるので許可します。
   実行ログに `accounts/数字/locations/数字　店名` が出ます。
2. 「プロジェクトの設定」→「スクリプト プロパティ」に次を追加します。

| プロパティ | 値 |
|---|---|
| GBP_LOCATION | 1で出た `accounts/…/locations/…`（AROMA DIAMOND の行） |
| GBP_NOTIFY_EMAIL | 結果を知らせるメールアドレス（任意） |

3. 記事を公開した日に `gbpPreview` を実行すると、投稿する予定の内容が実行ログに出ます（投稿はしません）。

## 4. 自動投稿を始める
1. スクリプト プロパティに `GBP_AUTOPOST` = `true` を追加します（これが無いと試運転のままで、投稿しません）。
2. 関数 `setupGbpAutoPost` を1回実行します。1時間ごとに確認し、17時以降にその日の記事を投稿します。
3. やめるときは `stopGbpAutoPost` を実行します（または `GBP_AUTOPOST` を消す）。

## 投稿の結果の見方
- 成功・失敗は、GBP_NOTIFY_EMAIL にメールで届きます（設定した場合）。
- 投稿した記事の記録は、スクリプト プロパティ `GBP_POSTED` に入ります。同じ記事は2回投稿しません。
- Googleの審査で投稿が公開されないこともあります（メールの「投稿の状態」が `LIVE` 以外の場合）。ビジネスプロフィールの画面で確認してください。

## 投稿文のルール（記事を作るときに守ること）
- 1500字以内。電話番号は入れません（電話番号を含む投稿はGoogleに断られます）。サイトの検証（validate-data）でも確認しています。
- 料金・割引・出勤など、確認できない内容は書きません。
