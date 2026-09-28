# AROMA DAIAMOND｜AI自動電話受付システム（Twilio ＋ Claude 自作版）

電話で「問い合わせ・予約」をAIが受け付ける仕組みです。
**サイトのAIチャットと同じ頭脳（Google Apps Script ＋ Claude）を電話にも使い回す**
のがこの構成のポイントです。予約は Web予約・AIチャット・電話の3経路すべてが
**同じ予約スプレッドシート・同じ予約ロジック**に集約されます。

```
 お客様の電話
    │
    ▼
 Twilio（電話番号・通話）
    │  ConversationRelay が音声認識(STT)と音声合成(TTS)を担当
    ▼
 このNodeサーバー（voice-agent/server.js）  ← Render / Railway / Fly などにデプロイ
    │  お客様の発話を中継
    ▼
 Google Apps Script（?action=chat）＝サイトのAIチャットと同一
    │  Claude が応答を生成し、#BOOK 指示で予約を確定
    ▼
 予約スプレッドシート（希望日・予約時間などを書き込み）
```

- このサーバーは **Anthropic APIキーを持ちません**。キーは Apps Script の
  スクリプトプロパティ（`ANTHROPIC_API_KEY`）にのみ存在するので、電話用サーバーを
  外部にデプロイしても鍵は露出しません。
- 使うClaudeモデルや予約の判定ロジックは **Apps Script 側で一元管理**。
  チャットの改善がそのまま電話にも反映されます（メンテナンス箇所が1つ）。

---

## 必要なもの

1. **Twilio アカウント**（電話番号＋ConversationRelay）
2. **Node が動くホスティング**（Render / Railway / Fly.io など。常時起動・WebSocket対応）
3. **Apps Script の /exec URL**（`data/chat-config.json` の `endpoint` と同じ値）
4. **電話番号**（新規取得。日本の番号は本人確認/住所確認が必要 → 下記「日本の番号」参照）

> 事前準備：サイトのAIチャットが正常に予約できる状態（＝修正版 Apps Script を
> デプロイ済み）であることを確認してください。電話はその頭脳をそのまま使います。

---

## セットアップ手順

### 1. サーバーをデプロイする

このフォルダ（`voice-agent/`）を Node ホスティングにデプロイします。

**環境変数**（`.env.example` 参照）
| 変数 | 必須 | 内容 |
|---|---|---|
| `CHAT_ENDPOINT` | ✅ | Apps Script の `/exec` URL |
| `PORT` | － | ホスティングが自動注入（ローカルは 8080） |
| `TTS_LANG` / `STT_LANG` | － | 既定 `ja-JP` |
| `TTS_VOICE` | － | 例 `Google.ja-JP-Neural2-B`（空でTwilio既定） |
| `GREETING` | － | 最初の挨拶。未設定なら既定文言 |
| `SHOP_TEL` | － | トラブル時の案内番号（読み上げ表示用） |

**ローカルでの起動確認**
```bash
cd voice-agent
npm install
CHAT_ENDPOINT="https://script.google.com/macros/s/XXXX/exec" npm start
# → http://localhost:8080/health が OK を返せば起動成功
```

**デプロイ例（Render の場合）**
- New → Web Service → このリポジトリを接続
- Root Directory: `voice-agent`
- Build Command: `npm install`
- Start Command: `npm start`
- Environment に `CHAT_ENDPOINT` を設定
- 払い出された公開URL（例 `https://xxxx.onrender.com`）を控える

> WebSocket（`/ws`）を使うため、WebSocket対応・常時起動のプランを選んでください。
> 無料枠のスリープがあるプランは初回応答が遅れることがあります。

### 2. Twilio 側の設定

1. Twilio コンソールで**電話番号を取得**（後述の日本番号の注意も参照）。
2. その電話番号の **Voice Configuration → "A call comes in"** を **Webhook** にし、
   URL に **`https://＜あなたの公開URL＞/twiml`**（HTTP GET または POST）を設定。
3. 保存。これだけで、着信時にサーバーが ConversationRelay 用の TwiML を返し、
   Twilio がこのサーバーの `/ws`（WebSocket）へ接続します。

> ConversationRelay は Twilio 側で日本語のSTT/TTSを行います。`/twiml` は
> `language=ja-JP`・`ttsLanguage=ja-JP`・`transcriptionLanguage=ja-JP`・
> `interruptible=true`（お客様が話し始めたら読み上げを止める）で応答します。

### 3. テスト通話

取得した番号に電話 → 挨拶が流れる → 「予約したい」「料金を教えて」等と話す →
AIが応答。予約が確定すると Apps Script が予約表に書き込みます（Webチャットと同じ動作）。

---

## しくみ（server.js）

- `/twiml` … Twilio の着信Webhook。`<Connect><ConversationRelay .../></Connect>` を返す。
- `/ws` … ConversationRelay の WebSocket。
  - `setup`：通話開始。`callSid` ごとに会話履歴を初期化。
  - `prompt`：お客様の発話テキスト。**サイトのAIチャットと同じ**
    `?action=chat&q=<発話>&h=<履歴>` で Apps Script に中継し、返答を音声で読み上げる。
  - 読み上げ前に `sanitizeForSpeech()` でURL・Markdown記号・絵文字を除去して自然な話し言葉に整える。
- `/health` … 稼働確認用。

会話履歴は AIチャット（`app/_components/AiChat.jsx`）と同じ「直近12件・`U:`/`A:` 形式・
1500文字上限」で組み立てるため、チャットと同じ品質で文脈をつなげます。

---

## 費用の目安（変動あり・要確認）

概算です。正確な金額は各社の最新料金をご確認ください。

- **Twilio 電話番号**：月額（番号種別・国で異なる）
- **Twilio 通話（着信）**：分単位課金
- **ConversationRelay（STT/TTS）**：利用分に応じた従量課金
- **Claude API**：Apps Script 側で消費（1通話あたりのやり取り回数×トークン）
- **ホスティング**：Render/Railway/Fly の常時起動プラン（月額）

小規模な受電であれば、無人の一次受付として人件費より安価に運用できる規模感です。
本格運用の前に、想定通話数で1件あたりの単価を試算してください。

---

## 日本の電話番号について（重要）

- Twilio で**日本（+81）の番号**を取得するには、**本人確認書類・日本国内の住所確認**などの
  審査（バンドル/規制対応）が必要で、承認に数日かかることがあります。
- すぐに試したい場合は、まず**米国番号などで動作確認**し、日本番号は審査と並行して
  準備するのがスムーズです。
- 既存の店舗番号からの**転送**でこのAI番号に着信させる運用も可能です。

---

## 注意・制限

- このサーバーは予約表を直接触りません。予約の可否判定・希望日/時間の検証・
  スプレッドシート書き込みはすべて **Apps Script 側**（修正版の `#BOOK` ロジック）が担当します。
  予約表に問題があるときは Apps Script を確認してください。
- ホスティングがスリープ/コールドスタートすると初回応答が遅れます。常時起動を推奨。
- 個人情報（通話内容）が Twilio・Google（Apps Script）・Anthropic を経由します。
  プライバシーポリシー（`/privacy/`）に電話AI受付の記載を追加するか検討してください。
- APIキー・URL・番号などの秘密情報はコミットしないでください（`.env` は `.gitignore` 済み）。

---

## 応用（任意）

- **SMS自動返信**：予約確定後に Twilio SMS で確認を送る（サーバーに Twilio 資格情報を追加して拡張可能）。
- **営業時間外のみAI受付**：時間帯で `/twiml` の応答を切り替える分岐を追加。
- **有人転送**：特定の発話やDTMF（番号入力）で `<Dial>` に切り替えるTwiMLへ分岐。
