// =============================================================================
// AROMA DAIAMOND｜AI自動電話受付システム（Twilio ConversationRelay ブリッジ）
// -----------------------------------------------------------------------------
// 役割：
//   Twilio の音声通話（電話）を受け、ConversationRelay（Twilio側でSTT＝音声認識と
//   TTS＝音声合成を担当）と WebSocket で接続する。お客様が話した内容を、
//   サイトのAIチャットと同じ Google Apps Script（?action=chat）へ中継し、
//   Claude が生成した返答を音声で読み上げる。予約の確定（スプレッドシートへの
//   書き込み）は Apps Script 側（#BOOK 指示）がそのまま担うため、Web予約・
//   AIチャット予約・電話予約の3経路がすべて同じ予約表・同じ予約ロジックに集約される。
//
//   ＝ このサーバー自体は Anthropic APIキーを保持しない（キーは Apps Script の
//      スクリプトプロパティ側にのみ存在）。橋渡しに徹する安全な構成。
//
// 必要な環境変数（.env.example 参照）：
//   CHAT_ENDPOINT  … Apps Script の /exec URL（data/chat-config.json と同じ値）
//   PORT           … 待受ポート（多くのホスティングが自動注入。既定 8080）
//   TTS_LANG       … 読み上げ言語（既定 ja-JP）
//   STT_LANG       … 音声認識言語（既定 ja-JP）
//   TTS_VOICE      … 任意。Twilioの音声名（例 Google.ja-JP-Neural2-B）
//   GREETING       … 任意。最初の挨拶（既定は下の DEFAULT_GREETING）
//   SHOP_TEL       … 任意。トラブル時の案内用電話番号（表示のみ）
//
// このディレクトリは Next.js のサイト本体（GitHub Pages）とは独立しており、
// Render / Railway / Fly.io などの Node が動くホスティングに別途デプロイする。
// =============================================================================

import http from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT) || 8080;
const CHAT_ENDPOINT = process.env.CHAT_ENDPOINT || "";
const TTS_LANG = process.env.TTS_LANG || "ja-JP";
const STT_LANG = process.env.STT_LANG || "ja-JP";
const TTS_VOICE = process.env.TTS_VOICE || ""; // 空なら Twilio 既定音声
const SHOP_TEL = process.env.SHOP_TEL || "";

const DEFAULT_GREETING =
  "お電話ありがとうございます。アロマダイアモンドのAI受付です。" +
  "ご予約、コースや料金、アクセスなど、ご用件をお話しください。";
const GREETING = process.env.GREETING || DEFAULT_GREETING;

if (!CHAT_ENDPOINT) {
  console.error(
    "[fatal] 環境変数 CHAT_ENDPOINT が未設定です。Apps Script の /exec URL を設定してください。"
  );
  process.exit(1);
}

// --- 会話履歴（通話ごと）。ConversationRelay は callSid 単位で1本のWSを張る。----
/** @type {Map<string, {role:"user"|"bot", text:string}[]>} */
const histories = new Map();

// XML特殊文字のエスケープ（TwiML生成用）。
function xmlEscape(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// AIチャット(app/_components/AiChat.jsx)と同じ履歴の詰め方に合わせる。
// 直近12件を "U:.. / A:.." 形式で連結し 1500 文字に丸める。
function buildHistory(msgs) {
  return msgs
    .slice(-12)
    .map((m) => `${m.role === "user" ? "U" : "A"}:${m.text}`)
    .join("\n")
    .slice(0, 1500);
}

// 読み上げ向けの軽い整形：Markdown記号・URL・絵文字などを落として自然な話し言葉に。
function sanitizeForSpeech(text = "") {
  let t = String(text);
  t = t.replace(/https?:\/\/\S+/g, "こちらのリンク"); // URLは読み上げない
  t = t.replace(/[*_`#>]/g, ""); // Markdown装飾
  t = t.replace(/^\s*[-・]\s?/gm, ""); // 箇条書き記号
  t = t.replace(/\[(.+?)\]\(.*?\)/g, "$1"); // [text](url) → text
  // 絵文字・記号系（BMP外の絵文字など）をざっくり除去
  t = t.replace(
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu,
    ""
  );
  t = t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return t;
}

// Apps Script の ?action=chat を呼ぶ（サーバー間通信なのでJSONPは不要）。
// callback を付けないと JSON が返る想定だが、環境差に備え両対応でパースする。
async function askChat(q, hist) {
  const u = new URL(CHAT_ENDPOINT);
  u.searchParams.set("action", "chat");
  u.searchParams.set("q", q);
  u.searchParams.set("h", hist);
  u.searchParams.set("_", Date.now().toString());

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(u, {
      method: "GET",
      redirect: "follow", // Apps Script は 302 でリダイレクトすることがある
      signal: ctrl.signal,
    });
    const body = await res.text();
    const data = parseMaybeJsonp(body);
    const reply =
      data && typeof data.reply === "string" && data.reply.trim()
        ? data.reply.trim()
        : "";
    return reply;
  } finally {
    clearTimeout(timer);
  }
}

// JSON もしくは "callback({...})" 形式のどちらでも中身を取り出す。
function parseMaybeJsonp(body) {
  const text = String(body || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    const m = text.match(/^[^(]*\((.*)\)\s*;?\s*$/s); // fn( ... )
    if (m) {
      try {
        return JSON.parse(m[1]);
      } catch (_) {}
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// HTTP サーバー：/ ヘルスチェック、/twiml で ConversationRelay を返す。
// -----------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/" || url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("AROMA DAIAMOND voice agent: OK");
    return;
  }

  // Twilio の着信Webhook（Voice URL）に設定する。TwiML を返す。
  if (url.pathname === "/twiml") {
    // WebSocket の公開URL。プロキシ配下でも https/wss を前提にホスト名から組む。
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const wsUrl = `wss://${host}/ws`;
    const voiceAttr = TTS_VOICE ? ` voice="${xmlEscape(TTS_VOICE)}"` : "";
    const twiml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Response>` +
      `<Connect>` +
      `<ConversationRelay ` +
      `url="${xmlEscape(wsUrl)}" ` +
      `welcomeGreeting="${xmlEscape(GREETING)}" ` +
      `language="${xmlEscape(TTS_LANG)}" ` +
      `ttsLanguage="${xmlEscape(TTS_LANG)}" ` +
      `transcriptionLanguage="${xmlEscape(STT_LANG)}"` +
      `${voiceAttr} ` +
      `interruptible="true" />` +
      `</Connect>` +
      `</Response>`;
    res.writeHead(200, { "Content-Type": "text/xml; charset=utf-8" });
    res.end(twiml);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

// -----------------------------------------------------------------------------
// WebSocket サーバー：Twilio ConversationRelay プロトコル。
//   受信: setup / prompt / interrupt / dtmf / error
//   送信: {type:"text", token, last} で読み上げ、{type:"end"} で終話。
// -----------------------------------------------------------------------------
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  let callSid = "unknown";

  const speak = (text, last = true) => {
    const clean = sanitizeForSpeech(text);
    if (!clean) return;
    ws.send(JSON.stringify({ type: "text", token: clean, last }));
  };

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (_) {
      return;
    }

    switch (msg.type) {
      case "setup": {
        callSid = msg.callSid || callSid;
        histories.set(callSid, []);
        console.log(
          `[call ${callSid}] setup from=${msg.from || "?"} to=${msg.to || "?"}`
        );
        // welcomeGreeting は TwiML 側で再生されるため、ここでは何も送らない。
        break;
      }

      case "prompt": {
        // お客様の発話（音声認識テキスト）。last=true で1区切り。
        const said = (msg.voicePrompt || "").trim();
        if (!said) break;
        const hist = histories.get(callSid) || [];
        console.log(`[call ${callSid}] user: ${said}`);

        let reply = "";
        try {
          reply = await askChat(said, buildHistory(hist));
        } catch (e) {
          console.error(`[call ${callSid}] chat error:`, e?.message || e);
        }

        if (!reply) {
          reply = SHOP_TEL
            ? `申し訳ございません。ただいまうまく聞き取れませんでした。` +
              `お急ぎの場合はお手数ですが、${SHOP_TEL} までお電話ください。`
            : `申し訳ございません。ただいまうまく聞き取れませんでした。もう一度お願いできますか。`;
        }

        hist.push({ role: "user", text: said });
        hist.push({ role: "bot", text: reply });
        histories.set(callSid, hist);

        console.log(`[call ${callSid}] bot: ${reply}`);
        speak(reply, true);
        break;
      }

      case "interrupt": {
        // お客様が被せて話したときの通知。ここでは特別な処理は不要。
        break;
      }

      case "dtmf": {
        // プッシュ音（番号入力）。必要なら分岐を追加可能。
        console.log(`[call ${callSid}] dtmf: ${msg.digit}`);
        break;
      }

      case "error": {
        console.error(`[call ${callSid}] relay error:`, msg.description || msg);
        break;
      }

      default:
        break;
    }
  });

  ws.on("close", () => {
    histories.delete(callSid);
    console.log(`[call ${callSid}] closed`);
  });

  ws.on("error", (e) => {
    console.error(`[call ${callSid}] ws error:`, e?.message || e);
  });
});

server.listen(PORT, () => {
  console.log(`AROMA DAIAMOND voice agent listening on :${PORT}`);
  console.log(`  TwiML:   /twiml   (Twilio の Voice Webhook に設定)`);
  console.log(`  WS:      /ws      (ConversationRelay 接続先)`);
  console.log(`  Chat:    ${CHAT_ENDPOINT}`);
});
